import { type ReactNode } from "react";
import { useEntityScope, ENTITY_LABELS } from "@/hooks/use-entity-scope";
import { Badge } from "./badge";

export function PageHeader({
  title,
  description,
  children,
  showScope = false,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  showScope?: boolean;
}) {
  const { scope } = useEntityScope();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h1 className="t-page-title text-foreground truncate">
            {title}
          </h1>
          {showScope && (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider hidden sm:inline-flex shrink-0">
              {ENTITY_LABELS[scope]}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}
