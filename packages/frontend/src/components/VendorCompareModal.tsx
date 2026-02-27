import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface VendorStats {
  vendor: string;
  avgUnitCost: number;
  avgTotalCost: number;
  avgLeadTime: number;
  totalJobs: number;
  rating: number;
  recentItems: { description: string; totalCost: number; date: string }[];
}

export const VendorCompareModal = () => {
  const [vendor1, setVendor1] = useState("");
  const [vendor2, setVendor2] = useState("");
  const [stats, setStats] = useState<{ v1: VendorStats | null; v2: VendorStats | null }>({ v1: null, v2: null });
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAskingAI, setIsAskingAI] = useState(false);

  const compareVendors = async () => {
    if (!vendor1 || !vendor2) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/compare-vendors?v1=${encodeURIComponent(vendor1)}&v2=${encodeURIComponent(vendor2)}`);
      const data = await res.json();
      setStats({ v1: data.v1, v2: data.v2 });
    } catch (error) {
      console.error("Failed to compare vendors:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const askAI = async () => {
    if (!aiQuestion.trim()) return;
    setIsAskingAI(true);
    try {
      const res = await fetch("/api/vendor-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: aiQuestion, vendor1, vendor2 }),
      });
      const { answer } = await res.json();
      setAiAnswer(answer);
    } catch (error) {
      console.error("Failed to ask AI:", error);
      setAiAnswer("Sorry, I couldn't process your question. Please try again.");
    } finally {
      setIsAskingAI(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start" data-testid="button-vendor-compare">
          <Sparkles className="mr-2 h-4 w-4" />
          Compare Vendors + AI
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vendor Comparison & AI Assistant</DialogTitle>
        </DialogHeader>

        {/* Vendor Inputs */}
        <div className="flex gap-2 mb-4">
          <Input 
            placeholder="Vendor 1 (e.g. Vijesh Lighting)" 
            value={vendor1} 
            onChange={(e) => setVendor1(e.target.value)} 
            data-testid="input-vendor1"
          />
          <Input 
            placeholder="Vendor 2 (e.g. Rehan Events)" 
            value={vendor2} 
            onChange={(e) => setVendor2(e.target.value)} 
            data-testid="input-vendor2"
          />
          <Button onClick={compareVendors} disabled={isLoading} data-testid="button-compare">
            {isLoading ? "Loading..." : "Compare"}
          </Button>
        </div>

        {/* Stats Grid */}
        {stats.v1 && stats.v2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {[stats.v1, stats.v2].map((s, i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle className="text-lg">{s!.vendor}</CardTitle>
                  {s!.rating > 0 && (
                    <Badge variant={i === 0 ? "default" : "secondary"}>{s!.rating}/5 ★</Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div><strong>Avg Unit Cost:</strong> {s!.avgUnitCost.toFixed(2)} OMR</div>
                  <div><strong>Avg Total Cost:</strong> {s!.avgTotalCost.toFixed(2)} OMR</div>
                  {s!.avgLeadTime > 0 && (
                    <div><strong>Avg Lead Time:</strong> {s!.avgLeadTime.toFixed(1)} days</div>
                  )}
                  <div><strong>Total Jobs:</strong> {s!.totalJobs}</div>
                  {s!.recentItems.length > 0 && (
                    <div className="pt-2 border-t">
                      <strong>Recent Items:</strong>
                      <ul className="text-xs space-y-1 mt-1">
                        {s!.recentItems.slice(0, 3).map((item, idx) => (
                          <li key={idx}>• {item.description}: {item.totalCost} OMR ({item.date})</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* AI Assistant */}
        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" />
            Ask AI
          </h4>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Who's cheaper for backdrops under 500 OMR?"
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && askAI()}
              data-testid="input-ai-question"
            />
            <Button onClick={askAI} disabled={isAskingAI} data-testid="button-ask-ai">
              {isAskingAI ? "Asking..." : "Ask"}
            </Button>
          </div>
          {aiAnswer && (
            <Card className="mt-3 bg-purple-50 dark:bg-purple-950">
              <CardContent className="pt-4 text-sm" data-testid="text-ai-answer">
                <strong>AI:</strong> {aiAnswer}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
