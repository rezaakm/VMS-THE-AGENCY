import { Dumbbell } from "lucide-react";

export default function FitnessBay() {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">Fitness Bay</h1>
        <p className="text-muted-foreground mt-1 text-sm uppercase tracking-widest">P&L, Virtual Bank, Partner Split — coming in Phase 4</p>
      </div>
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <Dumbbell className="w-12 h-12 text-muted-foreground/40" />
        <p className="text-sm">Fitness Bay section will be built in Phase 4</p>
      </div>
    </div>
  );
}
