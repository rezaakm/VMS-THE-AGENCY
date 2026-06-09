import { createContext, useContext, useState, type ReactNode } from "react";

export type EntityScope = "group" | "agency" | "fitnessbay";

export const ENTITY_LABELS: Record<EntityScope, string> = {
  group: "Group (Consolidated)",
  agency: "The Agency",
  fitnessbay: "Fitness Bay",
};

interface EntityScopeContextValue {
  scope: EntityScope;
  setScope: (s: EntityScope) => void;
  /** Supabase entity filter value, or null for group (both) */
  entityFilter: string | null;
}

const EntityScopeContext = createContext<EntityScopeContextValue>({
  scope: "group",
  setScope: () => {},
  entityFilter: null,
});

export function EntityScopeProvider({ children }: { children: ReactNode }) {
  const [scope, setScope] = useState<EntityScope>("group");

  const entityFilter = scope === "group" ? null : scope;

  return (
    <EntityScopeContext.Provider value={{ scope, setScope, entityFilter }}>
      {children}
    </EntityScopeContext.Provider>
  );
}

export function useEntityScope() {
  return useContext(EntityScopeContext);
}
