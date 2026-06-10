import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetCostSheet,
  useListCostSheetItems,
  useCreateCostSheetItem,
  useUpdateCostSheetItem,
  useDeleteCostSheetItem,
  useCreateQuotation,
  useCreateQuotationItem,
  useGetEnquiry,
  useListVendors,
  getGetCostSheetQueryKey,
  getListCostSheetItemsQueryKey,
  getListQuotationsQueryKey,
  getListQuotationItemsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Pencil, Trash2, FileText, Printer, Download } from "lucide-react";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { VoiceButton } from "@/components/ui/voice-button";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { useItemSuggestions } from "@/hooks/use-item-suggestions";
import { HistorySuggest } from "@/components/history-suggest";

interface ItemForm {
  description: string;
  qty: string;
  vendorUnitCost: string;
  sellUnitCost: string;
  unit: string;
  vendorId: string;
  notes: string;
}
const emptyItemForm: ItemForm = { description: "", qty: "1", vendorUnitCost: "0", sellUnitCost: "0", unit: "", vendorId: "", notes: "" };

function fmt(n: number) { return n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }); }

export default function CostSheetDetail() {
  const params = useParams<{ id: string }>();
  // cost_sheets primary key is a UUID string — do NOT parseInt it (that yields
  // NaN / a wrong partial number and makes the lookup fail with "not found").
  const id = params.id;
  const [, setLocation] = useLocation();
  const { data: sheet, isLoading: sheetLoading } = useGetCostSheet(id, { query: { enabled: !!id, queryKey: getGetCostSheetQueryKey(id) } });
  const { data: items, isLoading: itemsLoading } = useListCostSheetItems(id, { query: { enabled: !!id, queryKey: getListCostSheetItemsQueryKey(id) } });
  const { data: vendors } = useListVendors();
  const createItem = useCreateCostSheetItem();
  const updateItem = useUpdateCostSheetItem();
  const deleteItem = useDeleteCostSheetItem();
  const createQuotation = useCreateQuotation();
  const createQuotationItem = useCreateQuotationItem();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | string | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyItemForm);
  const [deleteItemId, setDeleteItemId] = useState<number | string | null>(null);
  const [generatingQuotation, setGeneratingQuotation] = useState(false);
  const [genDialogOpen, setGenDialogOpen] = useState(false);
  const [genForm, setGenForm] = useState({ clientName: "", clientCompany: "", subject: "", serialNumber: "" });

  // Inline editing for true spreadsheet maker feel (Quotation Wizard style)
  const [inlineEditId, setInlineEditId] = useState<number | string | null>(null);
  const [inlineForm, setInlineForm] = useState<any>({});

  const { data: linkedEnquiry } = useGetEnquiry(sheet?.enquiryId ?? 0, {
    query: { enabled: !!sheet?.enquiryId },
  });

  const suggestions = useItemSuggestions();

  const descriptionVoice = useVoiceInput({
    onResult: (transcript) => setForm((f) => ({ ...f, description: transcript })),
  });
  const notesVoice = useVoiceInput({
    onResult: (transcript) => setForm((f) => ({ ...f, notes: transcript })),
  });

  const vendorMap = Object.fromEntries((vendors ?? []).map((v) => [v.id, `${v.name} — ${v.company}`]));

  function openCreate() {
    setEditingItemId(null);
    setForm(emptyItemForm);
    setDialogOpen(true);
  }

  function openEdit(item: NonNullable<typeof items>[0]) {
    setEditingItemId(item.id);
    setForm({
      description: item.description,
      qty: String(item.qty),
      vendorUnitCost: String(item.vendorUnitCost),
      sellUnitCost: String(item.sellUnitCost),
      unit: item.unit ?? "",
      vendorId: item.vendorId ? String(item.vendorId) : "",
      notes: item.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function handleItemSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      description: form.description,
      qty: parseFloat(form.qty) || 1,
      vendorUnitCost: parseFloat(form.vendorUnitCost) || 0,
      sellUnitCost: parseFloat(form.sellUnitCost) || 0,
      unit: form.unit || null,
      vendorId: form.vendorId && form.vendorId !== "none" ? parseInt(form.vendorId, 10) : null,
      notes: form.notes || null,
    };
    if (editingItemId) {
      await updateItem.mutateAsync({ id, itemId: editingItemId, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListCostSheetItemsQueryKey(id) }); toast({ title: "Item updated" }); setDialogOpen(false); },
        onError: () => toast({ title: "Error", variant: "destructive" }),
      });
    } else {
      await createItem.mutateAsync({ id, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListCostSheetItemsQueryKey(id) }); toast({ title: "Item added" }); setDialogOpen(false); },
        onError: () => toast({ title: "Error", variant: "destructive" }),
      });
    }
  }

  async function handleDeleteItem(itemId: number | string) {
    await deleteItem.mutateAsync({ id, itemId }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListCostSheetItemsQueryKey(id) }); toast({ title: "Item deleted" }); setDeleteItemId(null); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }

  function startInlineEdit(item: any) {
    setInlineEditId(item.id);
    setInlineForm({
      description: item.description,
      qty: String(item.qty),
      vendorUnitCost: String(item.vendorUnitCost),
      sellUnitCost: String(item.sellUnitCost),
      unit: item.unit ?? "",
      vendorId: item.vendorId ? String(item.vendorId) : "none",
      notes: item.notes ?? "",
    });
  }

  async function saveInlineEdit() {
    if (!inlineEditId) return;
    const payload = {
      description: inlineForm.description,
      qty: parseFloat(inlineForm.qty) || 1,
      vendorUnitCost: parseFloat(inlineForm.vendorUnitCost) || 0,
      sellUnitCost: parseFloat(inlineForm.sellUnitCost) || 0,
      unit: inlineForm.unit || null,
      vendorId: inlineForm.vendorId && inlineForm.vendorId !== "none" ? parseInt(inlineForm.vendorId, 10) : null,
      notes: inlineForm.notes || null,
    };
    await updateItem.mutateAsync({ id, itemId: inlineEditId, data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCostSheetItemsQueryKey(id) });
        toast({ title: "Saved inline" });
        setInlineEditId(null);
      },
      onError: () => toast({ title: "Error saving", variant: "destructive" }),
    });
  }

  function cancelInlineEdit() {
    setInlineEditId(null);
    setInlineForm({});
  }

  function openGenDialog() {
    if (!sheet) return;
    const sn = `QT-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900))}`;
    setGenForm({
      clientName: linkedEnquiry?.clientName ?? "",
      clientCompany: linkedEnquiry?.clientCompany ?? "",
      subject: sheet.title,
      serialNumber: sn,
    });
    setGenDialogOpen(true);
  }

  async function handleGenerateQuotation(e: React.FormEvent) {
    e.preventDefault();
    if (!sheet) return;
    setGeneratingQuotation(true);
    const today = new Date().toISOString().split("T")[0];
    try {
      const q = await createQuotation.mutateAsync({
        data: {
          serialNumber: genForm.serialNumber,
          enquiryId: sheet.enquiryId ?? null,
          clientName: genForm.clientName,
          clientCompany: genForm.clientCompany || null,
          subject: genForm.subject,
          quotationDate: today,
          vatPercent: 5,
          paymentTerms: "50% advance with LPO, balance on delivery/completion",
          termsAndConditions: null,
          status: "draft",
          currency: "OMR",
        },
      });
      // Auto-copy all cost sheet items into quotation items
      const costItems = items ?? [];
      for (const item of costItems) {
        await createQuotationItem.mutateAsync({
          id: q.id,
          data: {
            description: item.description,
            qty: item.qty,
            unitCost: item.sellUnitCost,
            isFoc: false,
            unit: item.unit ?? null,
          },
        });
      }
      queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListQuotationItemsQueryKey(q.id) });
      toast({
        title: `Quotation created from Cost Sheet`,
        description: `All sell prices copied. Now edit/print using your provided template (logo, formatting) in the Quotation screen.`
      });
      setGenDialogOpen(false);
      setLocation(`/quotations/${q.id}`);
    } catch {
      toast({ title: "Error creating quotation", variant: "destructive" });
    } finally {
      setGeneratingQuotation(false);
    }
  }

  const rows = items ?? [];
  const totalVendorCost = rows.reduce((s, i) => s + i.vendorUnitCost * i.qty, 0);
  const totalSellCost = rows.reduce((s, i) => s + i.sellUnitCost * i.qty, 0);
  const margin = totalSellCost > 0 ? ((totalSellCost - totalVendorCost) / totalSellCost) * 100 : 0;
  const vatAmount = totalSellCost * 0.05;
  const grandTotal = totalSellCost + vatAmount;

  function exportCsv() {
    if (!sheet) return;
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ["#", "Description", "Qty", "Unit", "Vendor", "Vendor Unit Cost (OMR)", "Sell Unit Price (OMR)", "Total Vendor (OMR)", "Total Sell (OMR)", "Margin %", "Notes"];
    const lines = [header.map(escape).join(",")];
    rows.forEach((item, i) => {
      const sellTotal = item.sellUnitCost * item.qty;
      const vendorTotal = item.vendorUnitCost * item.qty;
      const m = sellTotal > 0 ? ((sellTotal - vendorTotal) / sellTotal) * 100 : 0;
      lines.push([
        String(i + 1),
        item.description,
        String(item.qty),
        item.unit ?? "",
        item.vendorId ? (vendorMap[item.vendorId] ?? "") : "",
        item.vendorUnitCost.toFixed(3),
        item.sellUnitCost.toFixed(3),
        vendorTotal.toFixed(3),
        sellTotal.toFixed(3),
        m.toFixed(1),
        item.notes ?? "",
      ].map(escape).join(","));
    });
    lines.push("");
    lines.push([escape(""), escape("Total Vendor Cost"), "", "", "", "", "", totalVendorCost.toFixed(3), "", "", ""].join(","));
    lines.push([escape(""), escape("Total Sell Price"), "", "", "", "", "", "", totalSellCost.toFixed(3), "", ""].join(","));
    lines.push([escape(""), escape("VAT (5%)"), "", "", "", "", "", "", vatAmount.toFixed(3), "", ""].join(","));
    lines.push([escape(""), escape("Grand Total"), "", "", "", "", "", "", grandTotal.toFixed(3), "", ""].join(","));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = sheet.title.replace(/[^\w\-]+/g, "_").slice(0, 60);
    a.href = url;
    a.download = `CostSheet_${safeName}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "CSV downloaded" });
  }

  function printSheet() {
    window.print();
  }

  if (sheetLoading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (!sheet) return <div className="py-20 text-center text-muted-foreground">Cost sheet not found.</div>;

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2.5 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setLocation("/cost-sheets")} data-testid="button-back-cost-sheets">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <div className="t-label text-muted-foreground mb-1">Internal cost sheet · vendor costs → client quotation</div>
            <h1 className="t-page-title text-foreground truncate" data-testid="text-cost-sheet-title">{sheet.title}</h1>
            {sheet.notes && <p className="text-xs text-muted-foreground mt-0.5">{sheet.notes}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden shrink-0">
          <Button onClick={exportCsv} disabled={rows.length === 0} variant="outline" size="sm" className="gap-1.5 text-xs font-semibold" data-testid="button-export-csv">
            <Download className="w-4 h-4" /> CSV
          </Button>
          <Button onClick={printSheet} disabled={rows.length === 0} variant="outline" size="sm" className="gap-1.5 text-xs font-semibold" data-testid="button-print-cost-sheet">
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button onClick={openCreate} variant="outline" size="sm" className="gap-1.5 text-xs font-semibold" data-testid="button-add-item">
            <Plus className="w-4 h-4" /> Add Item
          </Button>
          <Button onClick={openGenDialog} disabled={rows.length === 0} size="sm" className="gap-1.5 bg-primary text-primary-foreground text-xs font-semibold" data-testid="button-generate-quotation">
            <FileText className="w-4 h-4" /> Create Quotation
          </Button>
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block print-header">
        <h1 className="text-2xl font-bold uppercase">The Agency — Internal Cost Sheet</h1>
        <div className="text-sm mt-1">{sheet.title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">Generated {new Date().toLocaleDateString("en-GB")}</div>
        <hr className="my-3" />
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Items", value: String(rows.length), valueClass: "text-foreground" },
          { label: "Total Vendor Cost", value: `OMR ${fmt(totalVendorCost)}`, valueClass: "text-foreground tabular-nums" },
          { label: "Total Sell Price", value: `OMR ${fmt(totalSellCost)}`, valueClass: "text-foreground tabular-nums" },
          { label: "Gross Margin", value: `${margin.toFixed(1)}%`, valueClass: `tabular-nums ${margin >= 0 ? "text-emerald-400" : "text-rose-400"}` },
          { label: "VAT (5%)", value: `OMR ${fmt(vatAmount)}`, valueClass: "text-muted-foreground tabular-nums" },
          { label: "Grand Total", value: `OMR ${fmt(grandTotal)}`, valueClass: "text-primary tabular-nums", highlight: true },
        ].map((s) => (
          <div key={s.label} className={`rounded-lg p-4 ${s.highlight ? "bg-primary/10 border border-primary/30" : "bg-card border border-card-border"}`}>
            <div className="t-label text-muted-foreground mb-1.5">{s.label}</div>
            <div className={`t-value ${s.valueClass}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Items Table */}
      <div className="bg-card border border-card-border rounded-lg overflow-auto">
        {itemsLoading ? (
          <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground text-sm">No items yet. Add one above.</div>
        ) : (
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-card/95 backdrop-blur sticky top-0 z-10">
              <tr className="border-b border-card-border">
                {[
                  { h: "Description", align: "text-left" },
                  { h: "Qty", align: "text-right" },
                  { h: "Unit", align: "text-left" },
                  { h: "Vendor", align: "text-left" },
                  { h: "Vendor Cost", align: "text-right" },
                  { h: "Sell Price", align: "text-right" },
                  { h: "Total Sell", align: "text-right" },
                  { h: "Margin", align: "text-right" },
                  { h: "", align: "text-right" },
                ].map((c, i) => (
                  <th key={i} className={`${c.align} px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap`}>{c.h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const sellTotal = item.sellUnitCost * item.qty;
                const vendorTotal = item.vendorUnitCost * item.qty;
                const itemMargin = sellTotal > 0 ? ((sellTotal - vendorTotal) / sellTotal) * 100 : 0;
                const isEditing = inlineEditId === item.id;
                return (
                  <tr key={item.id} className="border-b border-card-border/50 hover:bg-accent/10 transition-colors" data-testid={`row-item-${item.id}`}>
                    {isEditing ? (
                      <>
                        <td className="px-2 py-2">
                          <Input value={inlineForm.description} onChange={(e) => setInlineForm((f: any) => ({ ...f, description: e.target.value }))} className="h-8 text-sm" />
                        </td>
                        <td className="px-2 py-2">
                          <Input type="number" step="0.01" value={inlineForm.qty} onChange={(e) => setInlineForm((f: any) => ({ ...f, qty: e.target.value }))} className="h-8 w-20 text-sm font-mono" />
                        </td>
                        <td className="px-2 py-2">
                          <Input value={inlineForm.unit} onChange={(e) => setInlineForm((f: any) => ({ ...f, unit: e.target.value }))} className="h-8 w-20 text-sm" placeholder="Unit" />
                        </td>
                        <td className="px-2 py-2">
                          <Select value={inlineForm.vendorId} onValueChange={(v) => setInlineForm((f: any) => ({ ...f, vendorId: v }))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {(vendors ?? []).map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-2">
                          <Input type="number" step="0.001" value={inlineForm.vendorUnitCost} onChange={(e) => setInlineForm((f: any) => ({ ...f, vendorUnitCost: e.target.value }))} className="h-8 w-24 text-sm font-mono" />
                        </td>
                        <td className="px-2 py-2">
                          <Input type="number" step="0.001" value={inlineForm.sellUnitCost} onChange={(e) => setInlineForm((f: any) => ({ ...f, sellUnitCost: e.target.value }))} className="h-8 w-24 text-sm font-mono" />
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-primary font-mono text-xs font-semibold">{fmt(sellTotal)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-xs">
                          <span className={itemMargin >= 0 ? "text-emerald-400" : "text-rose-400"}>{itemMargin.toFixed(1)}%</span>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" className="h-7 text-xs" onClick={saveInlineEdit}>Save</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelInlineEdit}>Cancel</Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-foreground font-medium max-w-[200px]">
                          <div className="truncate">{item.description}</div>
                          {item.notes && <div className="text-xs text-muted-foreground truncate">{item.notes}</div>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{item.qty}</td>
                        <td className="px-4 py-3 text-muted-foreground">{item.unit ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{item.vendorId ? vendorMap[item.vendorId] ?? "—" : "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground font-mono text-xs">{fmt(item.vendorUnitCost)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground font-mono text-xs">{fmt(item.sellUnitCost)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-primary font-mono text-xs font-semibold">{fmt(sellTotal)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-xs">
                          <span className={itemMargin >= 0 ? "text-emerald-400" : "text-rose-400"}>{itemMargin.toFixed(1)}%</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startInlineEdit(item)} data-testid={`button-inline-edit-${item.id}`}><Pencil className="w-3 h-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteItemId(item.id)} data-testid={`button-delete-item-${item.id}`}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick Add Row - Fast maker style like your Quotation Wizard */}
      <div className="bg-card border border-card-border rounded-lg p-4 print:hidden">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Quick Add Line Item (fast builder mode)</div>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const quickDesc = (document.getElementById('quick-desc') as HTMLInputElement)?.value || '';
          const quickVendorCost = parseFloat((document.getElementById('quick-vendor') as HTMLInputElement)?.value || '0') || 0;
          const quickSell = parseFloat((document.getElementById('quick-sell') as HTMLInputElement)?.value || '0') || 0;
          if (!quickDesc) return;
          await createItem.mutateAsync({
            id,
            data: {
              description: quickDesc,
              qty: 1,
              vendorUnitCost: quickVendorCost,
              sellUnitCost: quickSell,
              unit: null,
              vendorId: null,
              notes: null,
            }
          });
          queryClient.invalidateQueries({ queryKey: getListCostSheetItemsQueryKey(id) });
          (document.getElementById('quick-desc') as HTMLInputElement).value = '';
          (document.getElementById('quick-vendor') as HTMLInputElement).value = '';
          (document.getElementById('quick-sell') as HTMLInputElement).value = '';
          toast({ title: "Quick item added with costs - edit row for more details or use History Suggest" });
        }} className="flex gap-2 items-end">
          <div className="flex-[2]">
            <Input id="quick-desc" placeholder="Description (e.g. LED Wall 3x4m)" className="h-9" data-testid="quick-add-desc" />
          </div>
          <div className="w-28">
            <Input id="quick-vendor" type="number" step="0.001" placeholder="Vendor Cost" className="h-9 font-mono text-xs" data-testid="quick-add-vendor" />
          </div>
          <div className="w-28">
            <Input id="quick-sell" type="number" step="0.001" placeholder="Sell Price" className="h-9 font-mono text-xs" data-testid="quick-add-sell" />
          </div>
          <Button type="submit" className="h-9 uppercase tracking-wider text-xs font-bold">+ Add</Button>
          <Button type="button" variant="outline" className="h-9" onClick={openCreate}>Full Wizard</Button>
        </form>
        <p className="text-[10px] text-muted-foreground mt-2">Use this for speed. Click "Full Details" or edit row for vendor costs, sell prices, history suggest, etc.</p>
      </div>

      {/* Sticky Maker Action Bar - Cost Sheet first, then Next to Quotation on your template */}
      {rows.length > 0 && (
        <div className="sticky bottom-4 z-50 bg-card border border-primary/30 rounded-xl p-4 shadow-lg print:hidden">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Cost Sheet ready with {rows.length} items</div>
              <div className="text-xs text-muted-foreground">All internal costs captured. Ready for client quotation using your templates &amp; logos from Google Drive.</div>
            </div>
            <Button
              onClick={openGenDialog}
              className="gap-2 bg-primary text-primary-foreground uppercase tracking-wider text-sm font-bold px-8 py-3 h-auto"
              data-testid="button-finish-and-next"
            >
              Finish Cost Sheet &amp; Create Quotation / Estimate →
            </Button>
          </div>
        </div>
      )}

      {/* Item Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wider text-sm font-bold">{editingItemId ? "Edit Item" : "Add Item"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleItemSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label>Description *</Label>
                <div className="flex items-center gap-1.5">
                  {descriptionVoice.isListening && <span className="text-xs text-red-400 animate-pulse">Listening...</span>}
                  <VoiceButton isListening={descriptionVoice.isListening} isSupported={descriptionVoice.isSupported} onClick={descriptionVoice.toggle} size="sm" />
                </div>
              </div>
              <AutocompleteInput
                value={form.description}
                onChange={(v) => setForm((f) => ({ ...f, description: v }))}
                suggestions={suggestions}
                required
                data-testid="input-item-description"
              />
              {/* Real history suggest while building the cost sheet - pull real pricing from your imported data */}
              <div className="mt-2">
                <HistorySuggest
                  onUsePrice={(price, desc) => {
                    if (desc) setForm((f) => ({ ...f, description: desc }));
                    setForm((f) => ({ ...f, sellUnitCost: price.toFixed(3) }));
                  }}
                  compact
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Qty *</Label>
                <Input type="number" min="0" step="0.01" value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} required data-testid="input-item-qty" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Unit</Label>
                <Input placeholder="Nos, Hrs, Days" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} data-testid="input-item-unit" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Vendor</Label>
                <Select value={form.vendorId} onValueChange={(v) => setForm((f) => ({ ...f, vendorId: v === "none" ? "" : v }))}>
                  <SelectTrigger data-testid="select-item-vendor"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(vendors ?? []).map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Vendor Unit Cost (OMR)</Label>
                <Input type="number" min="0" step="0.001" value={form.vendorUnitCost} onChange={(e) => setForm((f) => ({ ...f, vendorUnitCost: e.target.value }))} data-testid="input-item-vendor-cost" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Sell Unit Price (OMR)</Label>
                <Input type="number" min="0" step="0.001" value={form.sellUnitCost} onChange={(e) => setForm((f) => ({ ...f, sellUnitCost: e.target.value }))} data-testid="input-item-sell-cost" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} data-testid="input-item-notes" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createItem.isPending || updateItem.isPending} className="bg-primary text-primary-foreground uppercase tracking-wider text-xs font-bold" data-testid="button-submit-item">
                {editingItemId ? "Update" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteItemId !== null} onOpenChange={() => setDeleteItemId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Item?</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">This cannot be undone.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteItemId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteItemId && handleDeleteItem(deleteItemId)} disabled={deleteItem.isPending} data-testid="button-confirm-delete-item">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Quotation Dialog - the "Next" step after Cost Sheet */}
      <Dialog open={genDialogOpen} onOpenChange={setGenDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wider text-sm font-bold">Next: Create Quotation / Estimate</DialogTitle>
            <p className="text-xs text-muted-foreground pt-1">
              Cost Sheet complete. All {rows.length} items will be copied to the client-facing quotation using the sell prices. This will use your provided quotation template (logo, formatting, terms) once wired.
            </p>
          </DialogHeader>
          <form onSubmit={handleGenerateQuotation} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Serial Number *</Label>
              <Input value={genForm.serialNumber} onChange={(e) => setGenForm((f) => ({ ...f, serialNumber: e.target.value }))} required data-testid="input-gen-sn" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Client Name *</Label>
                <Input value={genForm.clientName} onChange={(e) => setGenForm((f) => ({ ...f, clientName: e.target.value }))} required placeholder="e.g. Ahmed Al Balushi" data-testid="input-gen-client" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Company</Label>
                <Input value={genForm.clientCompany} onChange={(e) => setGenForm((f) => ({ ...f, clientCompany: e.target.value }))} placeholder="Optional" data-testid="input-gen-company" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Subject *</Label>
              <Input value={genForm.subject} onChange={(e) => setGenForm((f) => ({ ...f, subject: e.target.value }))} required data-testid="input-gen-subject" />
            </div>
            <div className="bg-muted/30 border border-border rounded-md px-4 py-3 text-xs text-muted-foreground space-y-1">
              <div className="font-medium text-foreground mb-1.5">Items to be included</div>
              {rows.map((item, i) => (
                <div key={item.id} className="flex justify-between gap-2">
                  <span className="truncate">{i + 1}. {item.description}</span>
                  <span className="font-mono shrink-0">OMR {item.sellUnitCost.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setGenDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={generatingQuotation} className="bg-primary text-primary-foreground uppercase tracking-wider text-xs font-bold" data-testid="button-confirm-generate">
                {generatingQuotation ? "Generating…" : "Generate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
