import { type ElementType } from "react";
import { Card } from "./card";
import { Skeleton } from "./skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  title,
  value,
  icon: Icon,
  loading,
  trend,
  delta,
  sub,
  accent,
  className,
}: {
  title: string;
  value?: string;
  icon?: ElementType;
  loading: boolean;
  trend?: "up" | "down" | "neutral";
  /** small trend/delta text e.g. "+12%" */
  delta?: string;
  /** small caption under the value */
  sub?: string;
  /** color the value: positive/negative/info — meaning only */
  accent?: "positive" | "negative" | "info" | "default";
  className?: string;
}) {
  const valueColor =
    accent === "positive"
      ? "text-emerald-400"
      : accent === "negative"
      ? "text-rose-400"
      : accent === "info"
      ? "text-blue-400"
      : trend === "up"
      ? "text-emerald-400"
      : trend === "down"
      ? "text-rose-400"
      : "text-foreground";

  return (
    <Card className={cn("hover:border-primary/25", className)}>
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="t-label truncate text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="mt-2 h-6 w-24" />
          ) : (
            <div className="mt-1.5 flex items-baseline gap-2">
              <p className={cn("t-value tabular-nums", valueColor)}>{value}</p>
              {delta && (
                <span
                  className={cn(
                    "text-[11px] font-medium tabular-nums",
                    trend === "up"
                      ? "text-emerald-400"
                      : trend === "down"
                      ? "text-rose-400"
                      : "text-muted-foreground"
                  )}
                >
                  {delta}
                </span>
              )}
            </div>
          )}
          {sub && !loading && (
            <p className="t-caption mt-0.5 text-muted-foreground/70">{sub}</p>
          )}
        </div>
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
            {trend === "up" ? (
              <TrendingUp className="h-4 w-4 text-emerald-400/70" />
            ) : trend === "down" ? (
              <TrendingDown className="h-4 w-4 text-rose-400/70" />
            ) : (
              <Icon className="h-4 w-4" />
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
