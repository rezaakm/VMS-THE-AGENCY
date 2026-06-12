import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, Search } from "lucide-react";

// Reusable Real History Suggest component (extracted for use across Quotations, Cost Sheets, Calculator, etc.)
export function HistorySuggest({ onUsePrice, compact = false }: { onUsePrice: (price: number, desc?: string) => void; compact?: boolean }) {
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
    <div className={compact ? "space-y-2" : "bg-card border border-card-border rounded-xl p-5"}>
      {!compact && (
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Real History Suggest (from imported Cost Sheets)</h2>
        </div>
      )}

      <div className="flex gap-2 mb-3">
        <Input
          placeholder="Search description for historical pricing…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
          className="flex-1"
        />
        <Button variant="outline" size="icon" onClick={() => search(query)} disabled={loading}>
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-auto pr-1 text-sm">
          {results.map((r, idx) => (
            <div key={idx} className="bg-background border border-border rounded-lg p-3 flex flex-col gap-1.5">
              <div className="font-medium truncate">{r.description}</div>
              <div className="flex flex-wrap gap-3 text-xs">
                <div>Used <span className="font-mono font-semibold">{r.count}</span>×</div>
                <div>Avg: <span className="font-mono">OMR {r.avgSell}</span></div>
                <div>Last: <span className="font-mono">OMR {r.lastSell}</span></div>
                <div className={`px-2 py-0.5 rounded border text-[10px] ${
                  Math.abs(r.variancePct || 0) < 5 ? "bg-green-900/50 text-green-300 border-green-800" :
                  (r.variancePct || 0) > 0 ? "bg-orange-900/50 text-orange-300 border-orange-800" :
                  "bg-blue-900/50 text-blue-300 border-blue-800"
                }`}>
                  {(r.variancePct || 0) >= 0 ? "+" : ""}{(r.variancePct || 0).toFixed(1)}% var
                </div>
              </div>
              <div className="flex gap-2 mt-1">
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onUsePrice(r.lastSell, r.description)}>
                  Use Last
                </Button>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onUsePrice(r.avgSell, r.description)}>
                  Use Avg
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && <div className="text-xs text-muted-foreground">Searching real history...</div>}
      {!loading && query.length > 1 && results.length === 0 && (
        <div className="text-xs text-muted-foreground">No matches yet — import more cost sheets.</div>
      )}
    </div>
  );
}
