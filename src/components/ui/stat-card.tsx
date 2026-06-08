import { type ElementType } from "react";
import { Card, CardContent } from "./card";
import { Skeleton } from "./skeleton";

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
    <Card className={`transition-shadow hover:shadow-md ${className ?? ""}`}>
      <CardContent className="flex items-center gap-4 p-5">
        {Icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          {loading ? (
            <Skeleton className="mt-1.5 h-7 w-28" />
          ) : (
            <p
              className={`mt-0.5 text-xl font-bold tabular-nums ${
                trend === "up"
                  ? "text-emerald-400"
                  : trend === "down"
                  ? "text-red-400"
                  : ""
              }`}
            >
              {value}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
