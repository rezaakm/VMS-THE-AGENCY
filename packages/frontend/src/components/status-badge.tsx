import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusConfig = {
    active: {
      variant: "default" as const,
      className: "bg-secondary text-secondary-foreground hover:bg-secondary",
      label: "Active",
    },
    inactive: {
      variant: "default" as const,
      className: "bg-destructive/10 text-destructive hover:bg-destructive/10",
      label: "Inactive",
    },
    pending: {
      variant: "default" as const,
      className: "bg-chart-4/10 text-chart-4 hover:bg-chart-4/10",
      label: "Pending",
    },
    expired: {
      variant: "default" as const,
      className: "bg-destructive/10 text-destructive hover:bg-destructive/10",
      label: "Expired",
    },
    renewed: {
      variant: "default" as const,
      className: "bg-secondary text-secondary-foreground hover:bg-secondary",
      label: "Renewed",
    },
  };

  const config = statusConfig[status.toLowerCase() as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <Badge
      variant={config.variant}
      className={cn("no-default-hover-elevate no-default-active-elevate", config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
