/**
 * Pipeline Acceptance Test — hits live Supabase
 *
 * Walks through the full pipeline:
 *   1. Create a test enquiry
 *   2. Build a cost sheet from the enquiry
 *   3. Approve the cost sheet (generates quotation)
 *   4. Verify quotation was created
 *   5. Clean up test data
 *
 * Requires env vars in .env.local:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 *   VITE_TEST_EMAIL, VITE_TEST_PASSWORD
 *
 * Run: npm run test:acceptance
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PipelineService } from "../pipeline-service";
import { supabase } from "@/lib/supabase";

const testEmail = import.meta.env.VITE_TEST_EMAIL;
const testPassword = import.meta.env.VITE_TEST_PASSWORD;

if (!testEmail || !testPassword) {
  throw new Error(
    "Missing VITE_TEST_EMAIL or VITE_TEST_PASSWORD in .env.local — needed for authenticated Supabase access"
  );
}

// Track IDs for cleanup
const cleanup = {
  enquiryId: null as string | null,
  costSheetId: null as string | null,
  quotationId: null as string | null,
};

beforeAll(async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });
  if (error) throw new Error(`Auth failed: ${error.message}`);
  console.log(`  ✓ Authenticated as: ${data.user?.email}, role: ${data.user?.role}`);

  // Verify session is active
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new Error("No active session after sign-in");
  console.log(`  ✓ Session confirmed, expires: ${session.session.expires_at}`);
});

afterAll(async () => {
  // Clean up in reverse dependency order
  if (cleanup.quotationId) {
    await supabase
      .from("quotation_items")
      .delete()
      .eq("quotationId", cleanup.quotationId);
    await supabase
      .from("quotations")
      .delete()
      .eq("id", cleanup.quotationId);
  }
  if (cleanup.costSheetId) {
    await supabase
      .from("cost_sheet_items")
      .delete()
      .eq("costSheetId", cleanup.costSheetId);
    await supabase
      .from("cost_sheets")
      .delete()
      .eq("id", cleanup.costSheetId);
  }
  if (cleanup.enquiryId) {
    await supabase
      .from("enquiries")
      .delete()
      .eq("id", cleanup.enquiryId);
  }
  await supabase.auth.signOut();
});

describe("Pipeline Acceptance (live Supabase)", () => {
  const service = new PipelineService();
  const TEST_PREFIX = "[ACCEPTANCE-TEST]";

  it("Step 1: Create a test enquiry", async () => {
    const { data, error } = await supabase
      .from("enquiries")
      .insert({
        title: `${TEST_PREFIX} Exhibition Booth Build`,
        client: `${TEST_PREFIX} Test Client`,
        description:
          "Booth structure 6x4m\nLighting package\nFlooring carpet tiles\nGraphics wall wrap",
        status: "new",
        source: "acceptance_test",
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data.id).toBeTruthy();
    expect(data.status).toBe("new");

    cleanup.enquiryId = String(data.id);
    console.log(`  ✓ Enquiry created: id=${data.id}`);
  });

  it("Step 2: Build cost sheet from enquiry", async () => {
    expect(cleanup.enquiryId).toBeTruthy();

    const { data: enquiry } = await supabase
      .from("enquiries")
      .select("*")
      .eq("id", cleanup.enquiryId!)
      .single();

    expect(enquiry).toBeTruthy();

    const result = await service.buildCostSheetFromEnquiry({
      enquiry: enquiry!,
    });

    expect(result.sheet).toBeTruthy();
    expect(result.sheet.id).toBeTruthy();
    expect(result.items.length).toBeGreaterThanOrEqual(1);

    cleanup.costSheetId = result.sheet.id;
    console.log(
      `  ✓ Cost sheet created: id=${result.sheet.id}, items=${result.items.length}`
    );

    // Verify enquiry status changed to drafting
    const { data: updated } = await supabase
      .from("enquiries")
      .select("status")
      .eq("id", cleanup.enquiryId!)
      .single();

    expect(updated?.status).toBe("drafting");
    console.log(`  ✓ Enquiry status updated to: ${updated?.status}`);
  }, 30_000);

  it("Step 3: Approve cost sheet (generates quotation)", async () => {
    expect(cleanup.costSheetId).toBeTruthy();

    const result = await service.approveCostSheet({
      sheetId: cleanup.costSheetId!,
      action: "approved",
    });

    expect(result.quotation).toBeTruthy();
    expect(result.quotation.id).toBeTruthy();

    cleanup.quotationId = result.quotation.id;
    console.log(`  ✓ Quotation generated: id=${result.quotation.id}`);

    // Verify cost sheet status
    const { data: sheet } = await supabase
      .from("cost_sheets")
      .select("status, approved_by, approved_at")
      .eq("id", cleanup.costSheetId!)
      .single();

    expect(sheet?.status).toBe("approved");
    expect(sheet?.approved_by).toBe("reza");
    expect(sheet?.approved_at).toBeTruthy();
    console.log(`  ✓ Cost sheet status: ${sheet?.status}`);
  }, 30_000);

  it("Step 4: Verify quotation has items", async () => {
    expect(cleanup.quotationId).toBeTruthy();

    const { data: quotation } = await supabase
      .from("quotations")
      .select("*")
      .eq("id", cleanup.quotationId!)
      .single();

    expect(quotation).toBeTruthy();
    expect(quotation.cost_sheet_id || quotation.costSheetId).toBe(
      cleanup.costSheetId
    );
    console.log(
      `  ✓ Quotation verified: total=${quotation.totalAmount || quotation.total_amount}`
    );

    const { data: items } = await supabase
      .from("quotation_items")
      .select("*")
      .eq("quotationId", cleanup.quotationId!);

    expect(items).toBeTruthy();
    expect(items!.length).toBeGreaterThanOrEqual(1);
    console.log(`  ✓ Quotation items: ${items!.length}`);
  });

  it("Step 5: Verify enquiry status is quoted", async () => {
    expect(cleanup.enquiryId).toBeTruthy();

    const { data: enquiry } = await supabase
      .from("enquiries")
      .select("status")
      .eq("id", cleanup.enquiryId!)
      .single();

    expect(enquiry?.status).toBe("quoted");
    console.log(`  ✓ Enquiry final status: ${enquiry?.status}`);
  });
});
