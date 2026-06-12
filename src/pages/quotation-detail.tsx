import { useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetQuotation,
  useUpdateQuotation,
  useListQuotationItems,
  useCreateQuotationItem,
  useUpdateQuotationItem,
  useDeleteQuotationItem,
  getGetQuotationQueryKey,
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
import { ArrowLeft, Plus, Pencil, Trash2, Printer, Eye, X } from "lucide-react";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { useItemSuggestions } from "@/hooks/use-item-suggestions";
import agencyLogo from "@/assets/the-agency-logo.png";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-700 text-zinc-200",
  sent: "bg-blue-900 text-blue-200",
  approved: "bg-green-900 text-green-200",
  rejected: "bg-red-900 text-red-200",
};

function fmt3(n: number) { return n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }); }

interface ItemForm { description: string; qty: string; unitCost: string; isFoc: boolean; unit: string; }
const emptyItemForm: ItemForm = { description: "", qty: "1", unitCost: "0", isFoc: false, unit: "" };

type QuotationData = NonNullable<ReturnType<typeof useGetQuotation>["data"]>;
type ItemRow = { id: number; description: string; qty: number; unitCost: number; isFoc: boolean; unit: string | null; sortOrder: number };

function QuotationDocument({ quotation, items }: { quotation: QuotationData; items: ItemRow[] }) {
  const subTotal = items.reduce((s, i) => s + (i.isFoc ? 0 : i.qty * i.unitCost), 0);
  const vat = subTotal * (quotation.vatPercent / 100);
  const total = subTotal + vat;

  const tncList = (quotation.termsAndConditions ?? "")
    .split(/\r?\n/)
    .map((l: string) => l.replace(/^\s*[•\-*]\s*/, "").trim())
    .filter(Boolean);

  return (
    <div className="bg-white text-black font-sans text-[12px] w-full leading-snug">
      {/* Header — meta on left, logo block on right */}
      <div className="flex justify-between items-start mb-5">
        <div className="pt-2">
          <table className="text-[12px]">
            <tbody>
              <tr><td className="text-gray-700 font-semibold pr-6 py-0.5 align-top">To</td><td className="font-semibold align-top">{quotation.clientName}{quotation.clientCompany ? `, ${quotation.clientCompany}` : ""}</td></tr>
              <tr><td className="text-gray-700 font-semibold pr-6 py-0.5 align-top">Date</td><td className="align-top">{quotation.quotationDate}</td></tr>
              <tr><td className="text-gray-700 font-semibold pr-6 py-0.5 align-top">S. N</td><td className="font-bold align-top">{quotation.serialNumber}</td></tr>
              <tr><td className="text-gray-700 font-semibold pr-6 py-0.5 align-top">Subject</td><td className="align-top">{quotation.subject}</td></tr>
              {quotation.scopeOfWork && <tr><td className="text-gray-700 font-semibold pr-6 py-0.5 align-top">Scope of Work</td><td className="align-top whitespace-pre-wrap">{quotation.scopeOfWork}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-center overflow-hidden" style={{ width: 240, height: 120 }}>
          <img
            src={agencyLogo}
            alt="The Agency"
            className="block"
            style={{
              width: "180%",
              height: "180%",
              objectFit: "contain",
              filter: "invert(1) hue-rotate(180deg)",
              printColorAdjust: "exact",
              WebkitPrintColorAdjust: "exact",
            } as React.CSSProperties}
          />
        </div>
      </div>

      <div className="border-t-2 border-black mb-4" />

      {/* Items */}
      <table className="w-full text-[12px] mb-4 border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 px-2 py-1.5 text-center font-semibold w-10">No.</th>
            <th className="border border-gray-400 px-2 py-1.5 text-left font-semibold">Description</th>
            <th className="border border-gray-400 px-2 py-1.5 text-center font-semibold w-14">Qty</th>
            <th className="border border-gray-400 px-2 py-1.5 text-right font-semibold w-24">Unit Cost</th>
            <th className="border border-gray-400 px-2 py-1.5 text-right font-semibold w-28">Total Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id} className="align-top">
              <td className="border border-gray-400 px-2 py-1.5 text-center">{idx + 1}</td>
              <td className="border border-gray-400 px-2 py-1.5 whitespace-pre-wrap">{item.description}</td>
              <td className="border border-gray-400 px-2 py-1.5 text-center">{item.qty}</td>
              <td className="border border-gray-400 px-2 py-1.5 text-right tabular-nums">{item.isFoc ? <span className="text-green-700 font-semibold">FOC</span> : fmt3(item.unitCost)}</td>
              <td className="border border-gray-400 px-2 py-1.5 text-right tabular-nums">{item.isFoc ? <span className="text-green-700 font-semibold">FOC</span> : `${fmt3(item.qty * item.unitCost)} OMR`}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Payment Terms (left) + Totals (right) */}
      <div className="grid grid-cols-2 gap-6 mb-5">
        <div className="text-[11.5px] text-gray-800">
          {quotation.paymentTerms && (
            <>
              <span className="font-semibold">Payment Terms: </span>
              <span className="whitespace-pre-wrap">{quotation.paymentTerms}</span>
            </>
          )}
        </div>
        <table className="text-[12px] w-full">
          <tbody>
            <tr>
              <td className="px-2 py-1 text-right font-semibold text-gray-700 border border-gray-400 bg-gray-50">Sub Total</td>
              <td className="px-2 py-1 text-right font-semibold tabular-nums border border-gray-400 w-32">{fmt3(subTotal)} OMR</td>
            </tr>
            <tr>
              <td className="px-2 py-1 text-right font-semibold text-gray-700 border border-gray-400 bg-gray-50">Vat {quotation.vatPercent}%</td>
              <td className="px-2 py-1 text-right font-semibold tabular-nums border border-gray-400">{fmt3(vat)} OMR</td>
            </tr>
            <tr>
              <td className="px-2 py-1.5 text-right font-extrabold text-black border border-gray-700 bg-gray-100">Total Amount</td>
              <td className="px-2 py-1.5 text-right font-extrabold tabular-nums border border-gray-700 bg-gray-100">{fmt3(total)} OMR</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Terms & Conditions */}
      {tncList.length > 0 && (
        <div className="mb-5">
          <div className="font-semibold mb-1.5 text-gray-900 underline">Terms &amp; Conditions:</div>
          <ul className="list-disc pl-5 space-y-1 text-[11px] text-gray-800">
            {tncList.map((line: string, i: number) => (
              <li key={i} className="whitespace-pre-wrap leading-snug">{line}</li>
            ))}
          </ul>
          <p className="text-[11px] text-gray-800 mt-2 italic">
            This clause shall be effective upon the execution of this Quotation and shall be considered an integral part of the terms and conditions herein.
          </p>
        </div>
      )}

      {/* Signature */}
      <div className="mt-6 mb-4 break-inside-avoid">
        <div className="font-bold text-[12.5px] text-black">Dinesh Shetty</div>
        <div className="text-[11px] text-gray-700">Administration &amp; Accounts Manager</div>
      </div>

      <div className="text-[11.5px] italic text-gray-800 mb-4">
        Transforming Visions into Reality, Your Creative Partner in Success.
      </div>

      {/* Approval block */}
      <div className="mb-4 break-inside-avoid">
        <div className="text-[11.5px] text-gray-900 mb-2">To approve the quotation, please sign &amp; return it with the PO.</div>
        <table className="text-[11.5px] w-full max-w-md">
          <tbody>
            <tr><td className="font-semibold text-gray-700 pr-3 py-1 w-28">Received by:</td><td className="border-b border-gray-500"></td></tr>
            <tr><td className="font-semibold text-gray-700 pr-3 py-1">Date:</td><td className="border-b border-gray-500"></td></tr>
            <tr><td className="font-semibold text-gray-700 pr-3 py-1">Signature:</td><td className="border-b border-gray-500"></td></tr>
          </tbody>
        </table>
      </div>

      {/* Bank & validity footer */}
      <div className="border-t border-gray-400 pt-3 mt-4 text-[11px] text-gray-800 space-y-0.5 break-inside-avoid">
        <div><span className="font-semibold">Please Note:</span> All Cheques must be made payable to Modern Lifestyle</div>
        <div><span className="font-semibold">Bank Account Number:</span> 0323021625490018</div>
        <div><span className="font-semibold">Bank Account Name:</span> Modern Lifestyle</div>
        <div className="pt-1"><span className="font-semibold">Quotation Validity:</span> 7 days</div>
      </div>
    </div>
  );
}

function PrintView({ quotation, items }: { quotation: QuotationData; items: ItemRow[] }) {
  return (
    <div className="hidden print:block p-8 min-h-screen">
      <QuotationDocument quotation={quotation} items={items} />
    </div>
  );
}

export default function QuotationDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10);
  const [, setLocation] = useLocation();
  const { data: quotation, isLoading: qLoading } = useGetQuotation(id, { query: { enabled: !!id, queryKey: getGetQuotationQueryKey(id) } });
  const { data: items, isLoading: iLoading } = useListQuotationItems(id, { query: { enabled: !!id, queryKey: getListQuotationItemsQueryKey(id) } });
  const updateQuotation = useUpdateQuotation();
  const createItem = useCreateQuotationItem();
  const updateItem = useUpdateQuotationItem();
  const deleteItem = useDeleteQuotationItem();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const suggestions = useItemSuggestions();

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyItemForm);
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [fieldValue, setFieldValue] = useState("");
  const [previewOpen, setPreviewOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("preview") === "1";
  });

  function openCreateItem() { setEditingItemId(null); setForm(emptyItemForm); setItemDialogOpen(true); }
  function openEditItem(item: NonNullable<typeof items>[0]) {
    setEditingItemId(item.id);
    setForm({ description: item.description, qty: String(item.qty), unitCost: String(item.unitCost), isFoc: item.isFoc, unit: item.unit ?? "" });
    setItemDialogOpen(true);
  }

  async function handleItemSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { description: form.description, qty: parseFloat(form.qty) || 1, unitCost: parseFloat(form.unitCost) || 0, isFoc: form.isFoc, unit: form.unit || null };
    if (editingItemId) {
      await updateItem.mutateAsync({ id, itemId: editingItemId, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListQuotationItemsQueryKey(id) }); toast({ title: "Item updated" }); setItemDialogOpen(false); },
        onError: () => toast({ title: "Error", variant: "destructive" }),
      });
    } else {
      await createItem.mutateAsync({ id, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListQuotationItemsQueryKey(id) }); toast({ title: "Item added" }); setItemDialogOpen(false); },
        onError: () => toast({ title: "Error", variant: "destructive" }),
      });
    }
  }

  async function handleDeleteItem(itemId: number) {
    await deleteItem.mutateAsync({ id, itemId }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListQuotationItemsQueryKey(id) }); toast({ title: "Item deleted" }); setDeleteItemId(null); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }

  async function handleStatusChange(status: string) {
    await updateQuotation.mutateAsync({ id, data: { status: status as "draft" | "sent" | "approved" | "rejected" } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetQuotationQueryKey(id) }); toast({ title: "Status updated" }); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }

  async function handleFieldSave(field: string, value: string) {
    await updateQuotation.mutateAsync({ id, data: { [field]: value || null } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetQuotationQueryKey(id) }); toast({ title: "Updated" }); setEditingField(null); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }

  const rows = (items ?? []) as unknown as ItemRow[];
  const subTotal = rows.reduce((s, i) => s + (i.isFoc ? 0 : i.qty * i.unitCost), 0);
  const vat = subTotal * ((quotation?.vatPercent ?? 5) / 100);
  const total = subTotal + vat;

  if (qLoading || iLoading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (!quotation) return <div className="py-20 text-center text-muted-foreground">Quotation not found.</div>;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Print view (hidden on screen) */}
      <PrintView quotation={quotation} items={rows} />

      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/quotations")} data-testid="button-back-quotations">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold uppercase tracking-tight font-mono" data-testid="text-quotation-sn">S.N. {quotation.serialNumber}</h1>
              <span className={`px-2 py-1 rounded text-xs font-medium uppercase tracking-wider ${STATUS_COLORS[quotation.status] ?? ""}`}>{quotation.status}</span>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">{quotation.clientName}{quotation.clientCompany ? ` — ${quotation.clientCompany}` : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setPreviewOpen(true)} className="gap-2 uppercase tracking-wider text-xs font-bold" data-testid="button-preview-quotation">
            <Eye className="w-4 h-4" /> Preview
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2 uppercase tracking-wider text-xs font-bold" data-testid="button-print-quotation">
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button onClick={openCreateItem} className="gap-2 bg-primary text-primary-foreground uppercase tracking-wider text-xs font-bold" data-testid="button-add-quotation-item">
            <Plus className="w-4 h-4" /> Add Item
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        {/* Items + Totals */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Header info */}
          <div className="bg-card border border-card-border rounded-lg p-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Subject</div>
                <div className="text-sm text-foreground font-medium" data-testid="text-quotation-subject">{quotation.subject}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Date</div>
                <div className="text-sm text-foreground font-mono">{quotation.quotationDate}</div>
              </div>
              {quotation.scopeOfWork && (
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Scope of Work</div>
                  <div className="text-sm text-foreground">{quotation.scopeOfWork}</div>
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-card border border-card-border rounded-lg overflow-auto">
            {rows.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">No items. Add items above.</div>
            ) : (
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium w-8">#</th>
                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Description</th>
                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Qty</th>
                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Unit</th>
                    <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Unit Cost</th>
                    <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Total</th>
                    <th className="px-4 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item, idx) => (
                    <tr key={item.id} className="border-b border-card-border/50 hover:bg-accent/10 transition-colors" data-testid={`row-q-item-${item.id}`}>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{idx + 1}</td>
                      <td className="px-4 py-3 text-foreground font-medium">{item.description}</td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{item.qty}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{item.unit ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-mono text-xs text-muted-foreground">{item.isFoc ? <span className="text-green-400 font-semibold">FOC</span> : fmt3(item.unitCost)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-mono text-xs font-semibold text-primary">{item.isFoc ? <span className="text-green-400">FOC</span> : fmt3(item.qty * item.unitCost)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditItem(item)} data-testid={`button-edit-q-item-${item.id}`}><Pencil className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteItemId(item.id)} data-testid={`button-delete-q-item-${item.id}`}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Totals */}
          <div className="bg-card border border-card-border rounded-lg p-5 flex flex-col items-end gap-2">
            <div className="w-64 flex flex-col gap-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Sub Total</span><span className="font-mono">OMR {fmt3(subTotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">VAT {quotation.vatPercent}%</span><span className="font-mono text-primary">OMR {fmt3(vat)}</span></div>
              <div className="border-t border-border pt-2 flex justify-between text-base font-bold"><span>Total</span><span className="font-mono text-primary">OMR {fmt3(total)}</span></div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <div className="bg-card border border-card-border rounded-lg p-5">
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Status</h3>
            <Select value={quotation.status} onValueChange={handleStatusChange}>
              <SelectTrigger data-testid="select-quotation-status-update"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["draft", "sent", "approved", "rejected"].map((s) => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-card border border-card-border rounded-lg p-5 flex flex-col gap-4">
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground">Payment Terms</h3>
            {editingField === "paymentTerms" ? (
              <div className="flex flex-col gap-2">
                <Textarea value={fieldValue} onChange={(e) => setFieldValue(e.target.value)} rows={3} />
                <div className="flex gap-2">
                  <Button size="sm" className="bg-primary text-primary-foreground text-xs" onClick={() => handleFieldSave("paymentTerms", fieldValue)} data-testid="button-save-payment-terms">Save</Button>
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => setEditingField(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="group flex items-start gap-2 cursor-pointer" onClick={() => { setEditingField("paymentTerms"); setFieldValue(quotation.paymentTerms ?? ""); }}>
                <p className="text-sm text-foreground flex-1">{quotation.paymentTerms ?? <span className="text-muted-foreground italic">Click to add...</span>}</p>
                <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
              </div>
            )}
          </div>

          <div className="bg-card border border-card-border rounded-lg p-5 flex flex-col gap-4">
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground">Terms & Conditions</h3>
            {editingField === "termsAndConditions" ? (
              <div className="flex flex-col gap-2">
                <Textarea value={fieldValue} onChange={(e) => setFieldValue(e.target.value)} rows={4} />
                <div className="flex gap-2">
                  <Button size="sm" className="bg-primary text-primary-foreground text-xs" onClick={() => handleFieldSave("termsAndConditions", fieldValue)} data-testid="button-save-tnc">Save</Button>
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => setEditingField(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="group flex items-start gap-2 cursor-pointer" onClick={() => { setEditingField("termsAndConditions"); setFieldValue(quotation.termsAndConditions ?? ""); }}>
                <p className="text-sm text-foreground flex-1 whitespace-pre-wrap line-clamp-4">{quotation.termsAndConditions ?? <span className="text-muted-foreground italic">Click to add...</span>}</p>
                <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
              </div>
            )}
          </div>

          <div className="bg-card border border-card-border rounded-lg p-5 text-xs text-muted-foreground space-y-1.5">
            <div>Currency: <span className="text-foreground font-mono">{quotation.currency}</span></div>
            <div>VAT: <span className="text-foreground font-mono">{quotation.vatPercent}%</span></div>
            <div>Items: <span className="text-foreground font-mono">{rows.length}</span></div>
            <div>Created: <span className="text-foreground font-mono">{new Date(quotation.createdAt).toLocaleDateString()}</span></div>
          </div>
        </div>
      </div>

      {/* Item Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="uppercase tracking-wider text-sm font-bold">{editingItemId ? "Edit Item" : "Add Item"}</DialogTitle></DialogHeader>
          <form onSubmit={handleItemSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Description *</Label>
              <AutocompleteInput
                value={form.description}
                onChange={(v) => setForm((f) => ({ ...f, description: v }))}
                suggestions={suggestions}
                required
                data-testid="input-q-item-description"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Qty *</Label>
                <Input type="number" min="0" step="0.01" value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} required data-testid="input-q-item-qty" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Unit Cost</Label>
                <Input type="number" min="0" step="0.001" value={form.unitCost} onChange={(e) => setForm((f) => ({ ...f, unitCost: e.target.value }))} disabled={form.isFoc} data-testid="input-q-item-unit-cost" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Unit</Label>
                <Input placeholder="Nos" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} data-testid="input-q-item-unit" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isFoc" checked={form.isFoc} onChange={(e) => setForm((f) => ({ ...f, isFoc: e.target.checked }))} className="w-4 h-4 accent-primary" data-testid="checkbox-q-item-foc" />
              <Label htmlFor="isFoc">Free of Charge (FOC)</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setItemDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createItem.isPending || updateItem.isPending} className="bg-primary text-primary-foreground uppercase tracking-wider text-xs font-bold" data-testid="button-submit-q-item">
                {editingItemId ? "Update" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Item Confirm */}
      <Dialog open={deleteItemId !== null} onOpenChange={() => setDeleteItemId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Item?</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteItemId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteItemId && handleDeleteItem(deleteItemId)} disabled={deleteItem.isPending} data-testid="button-confirm-delete-q-item">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Preview Overlay */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-900 print:hidden" data-testid="quotation-preview-overlay">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-6 py-3 bg-zinc-950 border-b border-zinc-800 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Document Preview</span>
              <span className="text-xs text-zinc-500 font-mono">S.N. {quotation.serialNumber}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setPreviewOpen(false); setTimeout(() => window.print(), 100); }}
                className="gap-2 uppercase tracking-wider text-xs font-bold border-zinc-700 text-zinc-200 hover:bg-zinc-800"
              >
                <Printer className="w-3.5 h-3.5" /> Print / Export PDF
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPreviewOpen(false)}
                className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Paper preview area */}
          <div className="flex-1 overflow-y-auto py-10 px-4" style={{ background: "hsl(0 0% 15%)" }}>
            <div className="mx-auto max-w-[794px]">
              {/* A4-like paper shadow */}
              <div className="bg-white rounded shadow-2xl p-[48px] min-h-[1123px]">
                <QuotationDocument quotation={quotation} items={rows} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
