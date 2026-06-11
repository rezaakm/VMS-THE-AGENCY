import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // @replit
  // Whitespace-nowrap: Badges should never wrap.
  "whitespace-nowrap inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" +
  " hover-elevate ",
  {
    variants: {
      variant: {
        default:
          // @replit shadow-xs instead of shadow, no hover because we use hover-elevate
          "border-transparent bg-primary text-primary-foreground shadow-xs",
        secondary:
          // @replit no hover because we use hover-elevate
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          // @replit shadow-xs instead of shadow, no hover because we use hover-elevate
          "border-transparent bg-destructive text-destructive-foreground shadow-xs",
          // @replit shadow-xs" - use badge outline variable
        outline: "text-foreground border [border-color:var(--badge-outline)]",
        success:
          "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
        warning:
          "border-amber-500/30 bg-amber-500/15 text-amber-400",
        danger:
          "border-rose-500/30 bg-rose-500/15 text-rose-400",
        info:
          "border-blue-500/30 bg-blue-500/15 text-blue-400",
        neutral:
          "border-zinc-500/30 bg-zinc-500/15 text-zinc-300",
        ai:
          "border-violet-500/30 bg-violet-500/15 text-violet-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/**
 * Single source of truth: map a status string -> Badge variant.
 * green = paid/approved/accepted/positive
 * amber = pending/draft/sent/warning
 * red   = overdue/rejected/failed/negative
 * blue  = informational
 */
export type StatusVariant =
  | "success" | "warning" | "danger" | "info" | "neutral" | "ai";

/**
 * Canonical status -> variant overrides. Checked first so the quotation
 * 6-stage workflow always maps to its intended colour regardless of the
 * generic keyword heuristics below.
 *   preparing        -> warning (amber)
 *   sent             -> info    (blue)
 *   follow_up        -> ai      (purple)
 *   waiting_approval -> warning (amber)
 *   approved         -> success (emerald)
 *   rejected         -> danger  (red)
 */
const STATUS_VARIANTS: Record<string, StatusVariant> = {
  preparing: "warning",
  sent: "info",
  follow_up: "ai",
  waiting_approval: "warning",
  approved: "success",
  rejected: "danger",
};

/**
 * Human labels for status strings that contain underscores or need custom
 * wording. Anything not listed falls back to spaced Title Case.
 */
export const STATUS_LABELS: Record<string, string> = {
  preparing: "Preparing",
  sent: "Sent",
  follow_up: "Last Follow-up",
  waiting_approval: "Waiting Approval",
  approved: "Approved",
  rejected: "Rejected",
};

/** Render a status string as a friendly label ("follow_up" -> "Last Follow-up"). */
export function statusLabel(status?: string | null): string {
  const raw = (status ?? "").toString().trim();
  if (!raw) return "—";
  const key = raw.toLowerCase();
  if (STATUS_LABELS[key]) return STATUS_LABELS[key];
  // Generic: underscores/dashes -> spaces, Title Case each word.
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function statusVariant(status?: string | null): StatusVariant {
  const s = (status ?? "").toLowerCase().trim();
  if (!s) return "neutral";
  if (STATUS_VARIANTS[s]) return STATUS_VARIANTS[s];
  if (/(paid|approved|accepted|active|posted|complete|completed|won|success|cleared)/.test(s))
    return "success";
  if (/(pending|draft|sent|review|in[\s-]?progress|partial|open|hold|on[\s-]?hold|preparing|waiting)/.test(s))
    return "warning";
  if (/(overdue|rejected|failed|cancel|cancelled|declined|lost|void|error|unpaid)/.test(s))
    return "danger";
  if (/(pipeline|ai|forecast|suggested|follow[\s_-]?up)/.test(s))
    return "ai";
  return "info";
}

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

/** Status pill that derives its color from a status string. */
function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const label = statusLabel(status);
  return (
    <Badge
      variant={statusVariant(status)}
      className={cn("text-[10px] uppercase tracking-wider font-medium px-2 py-0.5", className)}
    >
      {label}
    </Badge>
  );
}

export { Badge, StatusBadge, badgeVariants }
