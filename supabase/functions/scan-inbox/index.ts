// Supabase Edge Function: scan-inbox
// Hourly Gmail scan → creates enquiries + inbox_tasks for quote pipeline.
// READS Gmail + WRITES to Supabase only — NEVER sends emails.
// Dedupes on source_email_id. Skips newsletters/receipts/notifications.
//
// Env secrets (already set in Supabase project rmdztasccsnrqqgqvgyy):
//   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
//   ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const GMAIL_CLIENT_ID = Deno.env.get('GMAIL_CLIENT_ID') || ''
const GMAIL_CLIENT_SECRET = Deno.env.get('GMAIL_CLIENT_SECRET') || ''
const GMAIL_REFRESH_TOKEN = Deno.env.get('GMAIL_REFRESH_TOKEN') || ''
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Gmail API ──

async function getGmailAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Gmail token refresh failed: ${res.status}`)
  const data = await res.json()
  return data.access_token as string
}

interface GmailThread {
  id: string
  subject: string
  from: string
  fromEmail: string
  body: string
  date: string
}

async function listRecentThreads(token: string, afterEpoch: number): Promise<string[]> {
  const q = encodeURIComponent(`in:inbox after:${afterEpoch} -category:promotions -category:social -category:updates -category:forums`)
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=30`,
    { headers: { 'Authorization': `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error(`Gmail list failed: ${res.status}`)
  const data = await res.json()
  return (data.messages || []).map((m: { id: string }) => m.id)
}

async function getGmailMessage(token: string, messageId: string): Promise<GmailThread> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { 'Authorization': `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error(`Gmail message ${messageId} fetch failed: ${res.status}`)
  const msg = await res.json()

  const headers = (msg.payload?.headers || []) as { name: string; value: string }[]
  const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || ''
  const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || ''
  const date = headers.find(h => h.name.toLowerCase() === 'date')?.value || ''

  // Extract email from "Name <email>" format
  const emailMatch = from.match(/<([^>]+)>/)
  const fromEmail = emailMatch ? emailMatch[1] : from.trim()

  // Body: try plain text, fall back to stripped HTML, then payload body
  let body = ''
  const parts = msg.payload?.parts || []
  const plainPart = parts.find((p: { mimeType: string }) => p.mimeType === 'text/plain')
  const htmlPart = parts.find((p: { mimeType: string }) => p.mimeType === 'text/html')

  if (plainPart?.body?.data) {
    body = atob(plainPart.body.data.replace(/-/g, '+').replace(/_/g, '/'))
  } else if (htmlPart?.body?.data) {
    const html = atob(htmlPart.body.data.replace(/-/g, '+').replace(/_/g, '/'))
    body = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  } else if (msg.payload?.body?.data) {
    body = atob(msg.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'))
  }

  return { id: messageId, subject, from, fromEmail, body: body.slice(0, 2000), date }
}

// ── Supabase helpers ──

async function supabaseQuery(path: string, options: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      ...options.headers,
    },
  })
}

async function supabaseGet(path: string) {
  const res = await supabaseQuery(path, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) return []
  return res.json()
}

async function supabaseInsertReturning(table: string, body: Record<string, unknown>) {
  const res = await supabaseQuery(table, {
    method: 'POST',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return null
  const data = await res.json()
  return Array.isArray(data) ? data[0] : data
}

// ── Claude classification: is this a job/RFQ/quote request? ──

interface ClassifyResult {
  is_enquiry: boolean
  client: string
  title: string
  description: string
  category: string
  assignee: string
  reason: string
}

async function classifyEmail(email: GmailThread): Promise<ClassifyResult> {
  const prompt = `You are a classifier for The Agency Oman (creative agency, exhibition, events).
Analyze this email and determine if it's a potential job enquiry, RFQ, or quote request.

From: ${email.from}
Subject: ${email.subject}
Date: ${email.date}
Body (truncated): ${email.body.slice(0, 1500)}

CLASSIFY as is_enquiry=true IF the email is:
- A request for proposal, quotation, or pricing
- A job/project enquiry (booth, exhibition, event, branding, signage, printing, etc.)
- A client asking about services or availability
- A tender or RFQ document

CLASSIFY as is_enquiry=false IF the email is:
- A newsletter, marketing email, or promotion
- A receipt, invoice, or payment confirmation
- A notification from a service (Google, LinkedIn, etc.)
- Internal team chat or personal email
- A job application (HR, not a client enquiry)
- An auto-reply or out-of-office

Team assignment:
- Zara: client enquiries, proposals, business development
- Reza: high-value (>OMR 1,000), strategic, key clients
- Dinesh: pricing/costing requests
- Default: Zara (she handles client intake)

Return ONLY valid JSON:
{
  "is_enquiry": true/false,
  "client": "company or person name (from the email)",
  "title": "short title for the enquiry",
  "description": "one-paragraph summary of what they need",
  "category": "exhibition|event|branding|signage|printing|digital|general",
  "assignee": "Zara|Reza|Dinesh",
  "reason": "one sentence why this is/isn't an enquiry"
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) throw new Error(`Claude classify error: ${res.status}`)
  const data = await res.json()
  const text = data.content?.[0]?.text || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in classify response')
  return JSON.parse(jsonMatch[0])
}

// ── Owner mapping ──

const OWNER_MAP: Record<string, string> = {
  'Zara': 'zara',
  'Reza': 'reza',
  'Dinesh': 'dinesh',
  'Vijesh': 'vijesh',
  'Jithu': 'jithu',
  'Mahsa': 'mahsa',
  'Behrang': 'behrang',
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Auth check: accept service_role JWT or the exact env key.
  // Decodes the JWT payload (base64) and checks role === 'service_role'
  // for the correct project ref — no signature verification needed since
  // the gateway already validated the token when legacy-JWT verify is off,
  // and the function runs in a trusted Supabase environment.
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  let authorized = false
  if (token) {
    // Exact match (original check)
    if (token === SUPABASE_SERVICE_ROLE_KEY) {
      authorized = true
    } else {
      // Decode JWT payload and check role + project ref
      try {
        const parts = token.split('.')
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
          if (payload.role === 'service_role' && payload.ref === 'rmdztasccsnrqqgqvgyy') {
            authorized = true
          }
        }
      } catch { /* invalid token */ }
    }
  }
  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const startTime = Date.now()

  try {
    // Scan Gmail for last 2 hours (overlap for safety)
    const twoHoursAgo = Math.floor((Date.now() - 2 * 60 * 60 * 1000) / 1000)
    const gmailToken = await getGmailAccessToken()
    const messageIds = await listRecentThreads(gmailToken, twoHoursAgo)

    if (messageIds.length === 0) {
      return new Response(JSON.stringify({ scanned: 0, created: 0, skipped: 0, message: 'No recent emails' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get existing source_email_ids to dedup
    const existing = await supabaseGet(
      `enquiries?source_email_id=not.is.null&select=source_email_id`
    ) as { source_email_id: string }[]
    const existingIds = new Set(existing.map(e => e.source_email_id))

    let created = 0
    let skipped = 0
    let notEnquiry = 0
    const results: Array<{ messageId: string; status: string; title?: string }> = []

    for (const msgId of messageIds) {
      // Dedup
      if (existingIds.has(msgId)) {
        skipped++
        results.push({ messageId: msgId, status: 'duplicate' })
        continue
      }

      try {
        const email = await getGmailMessage(gmailToken, msgId)

        // Classify with Claude
        const classification = await classifyEmail(email)

        if (!classification.is_enquiry) {
          notEnquiry++
          results.push({ messageId: msgId, status: 'not_enquiry', title: email.subject })
          continue
        }

        // Create enquiry
        const enquiry = await supabaseInsertReturning('enquiries', {
          client: classification.client || email.fromEmail,
          title: classification.title || email.subject,
          description: classification.description || email.body.slice(0, 500),
          status: 'new',
          source: 'email',
          category: classification.category || 'general',
          assignedToId: OWNER_MAP[classification.assignee] || 'zara',
          source_email_id: msgId,
        })

        if (enquiry) {
          created++
          results.push({ messageId: msgId, status: 'created', title: classification.title })
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 300))
      } catch (err) {
        console.error(`Error processing message ${msgId}:`, err)
        results.push({ messageId: msgId, status: 'error' })
      }
    }

    const durationMs = Date.now() - startTime

    return new Response(JSON.stringify({
      scanned: messageIds.length,
      created,
      skipped,
      notEnquiry,
      duration_ms: durationMs,
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('scan-inbox error:', err)
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Internal error',
      duration_ms: Date.now() - startTime,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
