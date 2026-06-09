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
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold uppercase tracking-tight text-foreground">
            {title}
          </h1>
          {showScope && (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider hidden sm:inline-flex">
              {ENTITY_LABELS[scope]}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5 uppercase tracking-widest">
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-2 mt-2 sm:mt-0">{children}</div>}
    </div>
  );
}
