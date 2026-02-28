'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { MessageSquare, X, Send, Loader2, Bot, User, ChevronDown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolResults?: Array<{ tool: string; result: any }>;
  loading?: boolean;
}

interface ToolResult {
  tool: string;
  result: any;
}

const QUICK_ACTIONS = [
  'Show me the margin summary',
  'Which estimates are at risk?',
  'List my top vendors',
  'Sync from Google Drive',
  'Create a cost estimate for a 3x2m fabric banner',
];

export default function AiAssistantPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm the VMS AI Assistant. I can help you navigate the app, query your data, create cost estimates, and more.\n\nTry asking me something or use a quick action below." },
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const getAuthHeader = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    return token ? `Bearer ${token}` : '';
  };

  const handleToolResult = useCallback((tool: string, result: any) => {
    if (result?.action === 'navigate' && result?.route) {
      setTimeout(() => router.push(result.route), 500);
    }
    if (result?.action === 'syncDrive') {
      fetch(`${API_URL}/cost-sheets/drive/sync`, {
        method: 'POST',
        headers: { Authorization: getAuthHeader() },
      }).then((r) => r.json()).then((data) => {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last.role === 'assistant') {
            return [...prev.slice(0, -1), {
              ...last,
              content: last.content + `\n\nDrive sync complete: ${data.filesProcessed || 0} files processed.`,
            }];
          }
          return prev;
        });
      });
    }
  }, [router]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;
    setInput('');

    const userMsg: Message = { role: 'user', content: text };
    const assistantMsg: Message = { role: 'assistant', content: '', loading: true };

    // Snapshot current messages before the state update so the API receives
    // the full history including the new user message.
    const historyForApi = [...messages.filter((m) => !m.loading), userMsg]
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    try {
      const resp = await fetch(`${API_URL}/ai-assistant/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: getAuthHeader(),
        },
        body: JSON.stringify({
          messages: historyForApi,
          context: { page: pathname },
        }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let accContent = '';
      const accToolResults: ToolResult[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'text') {
              accContent += event.content;
              setMessages((prev) => [
                ...prev.slice(0, -1),
                { role: 'assistant', content: accContent, loading: false, toolResults: accToolResults },
              ]);
            } else if (event.type === 'tool_result') {
              accToolResults.push({ tool: event.tool, result: event.result });
              handleToolResult(event.tool, event.result);
              setMessages((prev) => [
                ...prev.slice(0, -1),
                { role: 'assistant', content: accContent, loading: false, toolResults: [...accToolResults] },
              ]);
            } else if (event.type === 'done') {
              setMessages((prev) => [
                ...prev.slice(0, -1),
                { role: 'assistant', content: accContent || '(no response)', loading: false, toolResults: accToolResults },
              ]);
            } else if (event.type === 'error') {
              accContent += `\n\n*Error: ${event.content}*`;
              setMessages((prev) => [
                ...prev.slice(0, -1),
                { role: 'assistant', content: accContent, loading: false },
              ]);
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: `Error: ${err.message}. Make sure the backend is running and OPENAI_API_KEY is set.`, loading: false },
      ]);
    } finally {
      setStreaming(false);
    }
  }, [messages, streaming, pathname, handleToolResult]);

  const renderToolResult = (tr: ToolResult) => {
    const { tool, result } = tr;
    if (result?.action === 'navigate') {
      return (
        <div key={tool} className="text-xs bg-blue-50 dark:bg-blue-950/30 border border-blue-200 rounded p-2 mt-1">
          Navigating to <span className="font-mono font-medium">{result.route}</span>…
        </div>
      );
    }
    if (result?.vendors || result?.orders || result?.estimates || result?.materials || result?.sheets || result?.contracts) {
      const items: any[] = result.vendors || result.orders || result.estimates || result.materials || result.sheets || result.contracts || [];
      return (
        <div key={tool} className="text-xs bg-muted rounded p-2 mt-1 max-h-32 overflow-y-auto">
          <div className="font-medium mb-1 text-muted-foreground">{items.length} results from {tool}</div>
          {items.slice(0, 5).map((item: any, i: number) => (
            <div key={i} className="truncate">{item.name || item.title || item.orderNumber || item.contractNumber || JSON.stringify(item).substring(0, 60)}</div>
          ))}
          {items.length > 5 && <div className="text-muted-foreground">+{items.length - 5} more</div>}
        </div>
      );
    }
    if (result?.totalEstimates !== undefined) {
      return (
        <div key={tool} className="text-xs bg-muted rounded p-2 mt-1">
          <div>{result.totalEstimates} estimates — avg margin: <strong>{result.avgMargin}%</strong> — <span className="text-red-600">{result.atRisk} at risk</span></div>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 100); }}
          className="fixed bottom-6 right-6 z-50 bg-primary text-primary-foreground rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity"
          title="AI Assistant (Ctrl+K)"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[600px] bg-background border rounded-xl shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground rounded-t-xl">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <span className="font-semibold">VMS AI Assistant</span>
              <span className="text-xs opacity-70">Ctrl+K</span>
            </div>
            <button onClick={() => setOpen(false)} className="opacity-70 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                  <div className={`rounded-xl px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground ml-auto' : 'bg-muted'}`}>
                    {msg.loading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span className="text-xs">Thinking…</span>
                      </div>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-inherit">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                  {msg.toolResults && msg.toolResults.map((tr) => renderToolResult(tr))}
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2">
              <div className="text-xs text-muted-foreground mb-1">Quick actions:</div>
              <div className="flex flex-wrap gap-1">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action}
                    onClick={() => sendMessage(action)}
                    className="text-xs bg-muted hover:bg-muted/80 rounded-full px-2.5 py-1 transition-colors"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t p-3 flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder="Ask anything about your data…"
              className="flex-1 text-sm bg-muted rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary"
              disabled={streaming}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={streaming || !input.trim()}
              className="w-8 h-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center disabled:opacity-40 hover:opacity-90 flex-shrink-0"
            >
              {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
