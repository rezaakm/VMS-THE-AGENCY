import { UserCircle } from "lucide-react";

export default function Clients() {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">Clients</h1>
        <p className="text-muted-foreground mt-1 text-sm uppercase tracking-widest">Client directory — coming in Phase 3</p>
      </div>
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <UserCircle className="w-12 h-12 text-muted-foreground/40" />
        <p className="text-sm">Client module will be built in Phase 3</p>
      </div>
    </div>
  );
}
