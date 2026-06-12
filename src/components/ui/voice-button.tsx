import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceButtonProps {
  isListening: boolean;
  isSupported: boolean;
  onClick: () => void;
  className?: string;
  size?: "sm" | "md";
}

export function VoiceButton({ isListening, isSupported, onClick, className, size = "md" }: VoiceButtonProps) {
  if (!isSupported) return null;

  const sizeClasses = size === "sm"
    ? "h-7 w-7"
    : "h-9 w-9";

  return (
    <button
      type="button"
      onClick={onClick}
      title={isListening ? "Stop listening" : "Speak to fill field"}
      className={cn(
        "rounded-md flex items-center justify-center transition-all shrink-0",
        isListening
          ? "bg-red-600/20 text-red-400 border border-red-600/40 animate-pulse"
          : "bg-accent/40 text-muted-foreground border border-border hover:text-primary hover:border-primary/40",
        sizeClasses,
        className
      )}
      data-testid="button-voice-input"
    >
      {isListening ? (
        <Loader2 className={size === "sm" ? "w-3.5 h-3.5 animate-spin" : "w-4 h-4 animate-spin"} />
      ) : (
        <Mic className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
      )}
    </button>
  );
}
