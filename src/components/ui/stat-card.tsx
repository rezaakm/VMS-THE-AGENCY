import { type ElementType } from "react";
import { Card, CardContent } from "./card";
import { Skeleton } from "./skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";

export function StatCard({
  title,
  value,
  icon: Icon,
  loading,
  trend,
  className,
}: {
  title: string;
  value?: string;
  icon?: ElementType;
  loading: boolean;
  trend?: "up" | "down" | "neutral";
  className?: string;
}) {
  return (
    <Card className={`transition-all duration-300 hover:shadow-md hover:border-primary/20 ${className ?? ""}`}>
      <CardContent className="flex items-center gap-4 p-4 sm:p-5">
        {Icon && (
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          {loading ? (
            <Skeleton className="mt-1.5 h-6 sm:h-7 w-24 sm:w-28" />
          ) : (
            <div className="flex items-center gap-1.5 mt-0.5">
              <p
                className={`text-lg sm:text-xl font-bold tabular-nums ${
                  trend === "up"
                    ? "text-emerald-400"
                    : trend === "down"
                    ? "text-rose-400"
                    : ""
                }`}
              >
                {value}
              </p>
              {trend === "up" && <TrendingUp className="w-3.5 h-3.5 text-emerald-400/60" />}
              {trend === "down" && <TrendingDown className="w-3.5 h-3.5 text-rose-400/60" />}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
