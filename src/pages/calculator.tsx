import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Delete, Search, TrendingUp } from "lucide-react";
import { useItemSuggestions } from "@/hooks/use-item-suggestions";

const RATES: Record<string, number> = {
  OMR: 1,
  USD: 2.597,
  AED: 0.1022,
};

function fmt(n: number, dp = 3) {
  if (!isFinite(n)) return "Error";
  return n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

interface HistoryEntry { expr: string; result: string; }

export default function Calculator() {
  const [display, setDisplay] = useState("0");
  const [expr, setExpr] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [vatRate, setVatRate] = useState("5");
  const [vatBase, setVatBase] = useState("");
  const [vatIncluded, setVatIncluded] = useState(false);
  const [marginCost, setMarginCost] = useState("");
  const [marginPct, setMarginPct] = useState("");
  const [convAmount, setConvAmount] = useState("");
  const [convFrom, setConvFrom] = useState("USD");
  const [convTo, setConvTo] = useState("OMR");

  const append = useCallback((val: string) => {
    setDisplay((d) => {
      const next = d === "0" && val !== "." ? val : d + val;
      return next;
    });
  }, []);

  const clear = () => { setDisplay("0"); setExpr(""); };
  const backspace = () => setDisplay((d) => (d.length > 1 ? d.slice(0, -1) : "0"));
  const setOp = (op: string) => {
    setExpr(display + " " + op + " ");
    setDisplay("0");
  };

  const evaluate = () => {
    try {
      const full = expr + display;
      // Safe eval via Function
      const result = Function('"use strict"; return (' + full + ')')() as number;
      const resultStr = fmt(result);
      setHistory((h) => [{ expr: full, result: resultStr }, ...h].slice(0, 20));
      setDisplay(resultStr.replace(/,/g, ""));
      setExpr("");
    } catch {
      setDisplay("Error");
    }
  };

  const pct = () => setDisplay((d) => fmt(parseFloat(d) / 100, 6).replace(/,/g, ""));

  // VAT
  const vatAmount = vatBase ? parseFloat(vatBase) * (parseFloat(vatRate) / 100) : 0;
  const vatResult = vatIncluded
    ? { base: vatBase ? parseFloat(vatBase) / (1 + parseFloat(vatRate) / 100) : 0, tax: 0 }
    : { base: vatBase ? parseFloat(vatBase) : 0, tax: vatAmount };
  const vatTotal = vatIncluded
    ? parseFloat(vatBase || "0")
    : (parseFloat(vatBase || "0") + vatAmount);

  // Margin
  const marginSellPrice = marginCost && marginPct
    ? parseFloat(marginCost) / (1 - parseFloat(marginPct) / 100)
    : 0;
  const markupSellPrice = marginCost && marginPct
    ? parseFloat(marginCost) * (1 + parseFloat(marginPct) / 100)
    : 0;

  // Conversion
  const convResult = convAmount && RATES[convFrom] && RATES[convTo]
    ? (parseFloat(convAmount) * RATES[convTo]) / RATES[convFrom]
    : 0;

  const CalcBtn = ({ label, onClick, className = "", span = 1 }: { label: React.ReactNode; onClick: () => void; className?: string; span?: number }) => (
    <button
      onClick={onClick}
      className={`h-12 rounded-lg text-sm font-semibold transition-all active:scale-95 flex items-center justify-center
        ${span === 2 ? "col-span-2" : ""}
        ${className || "bg-card border border-card-border text-foreground hover:bg-accent/40"}`}
      data-testid={`calc-btn-${String(label).replace(/\s+/g, "-")}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold uppercase tracking-tight" data-testid="text-calculator-title">Calculator</h1>
        <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest">Business Calculations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Calculator */}
        <div className="lg:col-span-1 flex flex-col gap-3">
          <div className="bg-card border border-card-border rounded-xl p-4">
            {/* Display */}
            <div className="mb-3 text-right">
              <div className="text-xs text-muted-foreground font-mono h-5">{expr}</div>
              <div className="text-3xl font-bold font-mono text-foreground tracking-tight mt-1 truncate" data-testid="calc-display">{display}</div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <CalcBtn label="AC" onClick={clear} className="bg-destructive/20 text-destructive border-destructive/30 hover:bg-destructive/30" />
              <CalcBtn label="%" onClick={pct} className="bg-accent/30 text-muted-foreground border-border hover:bg-accent/50" />
              <CalcBtn label={<Delete className="w-4 h-4" />} onClick={backspace} className="bg-accent/30 text-muted-foreground border-border hover:bg-accent/50" />
              <CalcBtn label="÷" onClick={() => setOp("/")} className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/30" />

              {["7", "8", "9"].map((n) => <CalcBtn key={n} label={n} onClick={() => append(n)} />)}
              <CalcBtn label="×" onClick={() => setOp("*")} className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/30" />

              {["4", "5", "6"].map((n) => <CalcBtn key={n} label={n} onClick={() => append(n)} />)}
              <CalcBtn label="−" onClick={() => setOp("-")} className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/30" />

              {["1", "2", "3"].map((n) => <CalcBtn key={n} label={n} onClick={() => append(n)} />)}
              <CalcBtn label="+" onClick={() => setOp("+")} className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/30" />

              <CalcBtn label="0" onClick={() => append("0")} span={2} />
              <CalcBtn label="." onClick={() => append(".")} />
              <CalcBtn label="=" onClick={evaluate} className="bg-primary text-primary-foreground hover:bg-primary/90" />
            </div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">History</span>
                <button onClick={() => setHistory([])} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Clear</button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between text-xs border-b border-border pb-1.5">
                    <span className="text-muted-foreground font-mono">{h.expr}</span>
                    <span className="text-foreground font-mono font-semibold">{h.result}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Business Calculators */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* VAT Calculator */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">VAT Calculator</h2>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>VAT Rate %</Label>
                  <Input type="number" value={vatRate} onChange={(e) => setVatRate(e.target.value)} data-testid="input-vat-rate" />
                </div>
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label>Amount (OMR)</Label>
                  <Input type="number" placeholder="Enter amount..." value={vatBase} onChange={(e) => setVatBase(e.target.value)} data-testid="input-vat-amount" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setVatIncluded(false)} className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider border transition-colors ${!vatIncluded ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>Exclusive</button>
                <button onClick={() => setVatIncluded(true)} className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider border transition-colors ${vatIncluded ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>Inclusive</button>
              </div>
              {vatBase && (
                <div className="bg-background border border-border rounded-lg p-4 space-y-2">
                  {vatIncluded ? (
                    <>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Base Amount</span><span className="font-mono font-semibold">OMR {fmt(vatResult.base)}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">VAT ({vatRate}%)</span><span className="font-mono text-primary">{fmt(parseFloat(vatBase || "0") - vatResult.base)}</span></div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Sub Total</span><span className="font-mono">{fmt(parseFloat(vatBase || "0"))}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">VAT ({vatRate}%)</span><span className="font-mono text-primary">{fmt(vatResult.tax)}</span></div>
                    </>
                  )}
                  <Separator />
                  <div className="flex justify-between text-sm font-bold"><span>Total</span><span className="font-mono text-primary text-base">OMR {fmt(vatTotal)}</span></div>
                </div>
              )}
            </div>
          </div>

          {/* Margin Calculator */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Margin / Markup Calculator</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="flex flex-col gap-1.5">
                <Label>Cost Price (OMR)</Label>
                <Input type="number" placeholder="0.000" value={marginCost} onChange={(e) => setMarginCost(e.target.value)} data-testid="input-margin-cost" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Desired %</Label>
                <Input type="number" placeholder="e.g. 30" value={marginPct} onChange={(e) => setMarginPct(e.target.value)} data-testid="input-margin-pct" />
              </div>
            </div>
            {marginCost && marginPct && (
              <div className="bg-background border border-border rounded-lg p-4 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Margin Sell Price</div>
                  <div className="text-xl font-bold font-mono text-primary">OMR {fmt(marginSellPrice)}</div>
                  <div className="text-xs text-muted-foreground mt-1">({marginPct}% margin on sell price)</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Markup Sell Price</div>
                  <div className="text-xl font-bold font-mono text-primary">OMR {fmt(markupSellPrice)}</div>
                  <div className="text-xs text-muted-foreground mt-1">({marginPct}% markup on cost)</div>
                </div>
              </div>
            )}
          </div>

          {/* Currency Converter */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Currency Converter</h2>
            <div className="grid grid-cols-3 gap-3 items-end">
              <div className="flex flex-col gap-1.5">
                <Label>Amount</Label>
                <Input type="number" placeholder="0.000" value={convAmount} onChange={(e) => setConvAmount(e.target.value)} data-testid="input-conv-amount" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>From</Label>
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={convFrom} onChange={(e) => setConvFrom(e.target.value)} data-testid="select-conv-from">
                  {Object.keys(RATES).map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>To</Label>
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={convTo} onChange={(e) => setConvTo(e.target.value)} data-testid="select-conv-to">
                  {Object.keys(RATES).map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            {convAmount && (
              <div className="mt-4 bg-background border border-border rounded-lg p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{convFrom} {convAmount} =</div>
                <div className="text-2xl font-bold font-mono text-primary">{convTo} {fmt(convResult)}</div>
                <div className="text-xs text-muted-foreground mt-2">Rates: 1 USD ≈ 0.385 OMR · 1 AED ≈ 0.1022 OMR (approximate)</div>
              </div>
            )}
          </div>

          {/* Real History Suggest — the protection feature powered by imported accountant cost sheets */}
          <HistorySuggest onUsePrice={(price) => setMarginCost(String(price))} />
        </div>
      </div>
    </div>
  );
}

// History Suggest Panel (Quotation Wizard style — real data variance)
function HistorySuggest({ onUsePrice }: { onUsePrice: (price: number) => void }) {
  const suggestions = useItemSuggestions();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async (q: string) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const apiBase = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
      const res = await fetch(`${apiBase}/suggestions/price-history?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-card-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Real History Suggest (from imported Cost Sheets)</h2>
        <span className="text-[10px] text-muted-foreground/60 ml-auto">Variance protection</span>
      </div>

      <div className="flex gap-2 mb-3">
        <Input
          placeholder="Search description (LED, catering, truss, branding...)"
          value={query}
          onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
          className="flex-1"
          data-testid="input-history-search"
        />
        <Button variant="outline" size="icon" onClick={() => search(query)} disabled={loading}>
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-auto pr-1">
          {results.map((r, idx) => {
            const variance = r.lastSell && r.avgSell ? ((r.lastSell - r.avgSell) / r.avgSell) * 100 : 0;
            const varianceColor = Math.abs(variance) < 5 ? "bg-green-900/50 text-green-300 border-green-800" :
                                  variance > 0 ? "bg-orange-900/50 text-orange-300 border-orange-800" :
                                  "bg-blue-900/50 text-blue-300 border-blue-800";
            return (
              <div key={idx} className="bg-background border border-border rounded-lg p-3 text-sm flex flex-col gap-1.5">
                <div className="font-medium text-foreground truncate">{r.description}</div>
                <div className="flex flex-wrap gap-3 text-xs">
                  <div>Used <span className="font-mono font-semibold">{r.count}</span>×</div>
                  <div>Avg Sell: <span className="font-mono font-semibold">OMR {r.avgSell}</span></div>
                  <div>Last: <span className="font-mono font-semibold">OMR {r.lastSell}</span></div>
                  <div className={`px-2 py-0.5 rounded border text-[10px] ${varianceColor}`}>
                    {variance >= 0 ? "+" : ""}{variance.toFixed(1)}% vs avg
                  </div>
                </div>
                <div className="flex gap-2 mt-1">
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onUsePrice(r.lastSell)}>
                    Use Last
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onUsePrice(r.avgSell)}>
                    Use Avg
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {loading && <div className="text-xs text-muted-foreground">Searching imported history...</div>}
      {!loading && query && results.length === 0 && (
        <div className="text-xs text-muted-foreground">No history yet — run the importer on your cost sheets first.</div>
      )}
      <div className="text-[10px] text-muted-foreground/60 mt-2">Data from your real accountant imports. Variance = last used vs historical average.</div>
    </div>
  );
}
