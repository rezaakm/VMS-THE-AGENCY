import { useState } from "react";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequestTyped } from "@/lib/queryClient";

interface EstimateItem {
  item: string;
  qty: number;
  tags: string[];
  budget: number | null;
}

interface EstimateExtractorDialogProps {
  onItemsExtracted: (items: EstimateItem[]) => void;
}

export function EstimateExtractorDialog({ onItemsExtracted }: EstimateExtractorDialogProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [extractedItems, setExtractedItems] = useState<EstimateItem[]>([]);
  const { toast } = useToast();

  const handleExtract = async () => {
    if (!text.trim()) {
      toast({
        title: "Empty input",
        description: "Please paste a client brief or email",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const items = await apiRequestTyped<EstimateItem[]>("/api/ai/extract-estimate", {
        method: "POST",
        body: JSON.stringify({ text }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      setExtractedItems(items);
      
      toast({
        title: "Items extracted",
        description: `Found ${items.length} item${items.length !== 1 ? "s" : ""} from the brief`,
      });
    } catch (error) {
      console.error("Extract error:", error);
      toast({
        title: "Extraction failed",
        description: "Could not extract items. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseItems = () => {
    onItemsExtracted(extractedItems);
    setOpen(false);
    setText("");
    setExtractedItems([]);
  };

  const handleCancel = () => {
    setOpen(false);
    setText("");
    setExtractedItems([]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-extract-estimate">
          <FileText className="h-4 w-4 mr-2" />
          Extract from Email
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Extract Items from Client Brief
          </DialogTitle>
          <DialogDescription>
            Paste a client email or brief, and AI will extract the requested items, quantities, and budgets
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            placeholder="Example: We need 2 fabric backdrops 4x3 meters and 1 truss stage light under 800 OMR total."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-32"
            disabled={isLoading}
            data-testid="textarea-client-brief"
          />

          {extractedItems.length > 0 && (
            <div className="border rounded-md p-4 bg-muted/30">
              <h4 className="font-semibold mb-3 text-sm">Extracted Items:</h4>
              <div className="space-y-2">
                {extractedItems.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-2 bg-background rounded border" data-testid={`extracted-item-${idx}`}>
                    <div className="flex-1">
                      <div className="font-medium">{item.item}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Quantity: {item.qty}
                        {item.budget && ` • Budget: ${item.budget} OMR`}
                      </div>
                      {item.tags.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {item.tags.map((tag, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading} data-testid="button-cancel-extract">
            Cancel
          </Button>
          {extractedItems.length === 0 ? (
            <Button onClick={handleExtract} disabled={isLoading || !text.trim()} data-testid="button-run-extract">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Extracting...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Extract Items
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleUseItems} data-testid="button-use-items">
              Use These Items
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
