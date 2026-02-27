import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequestTyped } from "@/lib/queryClient";

interface ParsedQuery {
  keywords: string[];
  vendor: string | null;
  category: string | null;
  price_min: number | null;
  price_max: number | null;
  date_from: string | null;
  date_to: string | null;
  exclude_terms: string[];
  sort: { field: string; dir: "asc" | "desc" }[];
  limit: number;
}

interface AISearchBarProps {
  onFiltersApplied: (filters: ParsedQuery) => void;
  placeholder?: string;
}

export function AISearchBar({ onFiltersApplied, placeholder = "Try: 'Show active vendors in Technology category'" }: AISearchBarProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!query.trim()) {
      toast({
        title: "Empty query",
        description: "Please enter a search query",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequestTyped<ParsedQuery>("/api/ai/parse-query", {
        method: "POST",
        body: JSON.stringify({ query }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      onFiltersApplied(response);
      
      toast({
        title: "Filters applied",
        description: "AI has parsed your query successfully",
      });
    } catch (error) {
      console.error("AI search error:", error);
      toast({
        title: "Search failed",
        description: "Could not process your query. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleSearch();
    }
  };

  return (
    <div className="flex gap-2 w-full">
      <div className="relative flex-1">
        <Sparkles className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-primary" />
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading}
          className="pl-10"
          data-testid="input-ai-search"
        />
      </div>
      <Button
        onClick={handleSearch}
        disabled={isLoading || !query.trim()}
        data-testid="button-ai-search"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Searching...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            AI Search
          </>
        )}
      </Button>
    </div>
  );
}
