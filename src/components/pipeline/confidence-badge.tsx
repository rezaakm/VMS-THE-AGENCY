import { CONFIDENCE_COLORS, CONFIDENCE_DOT_COLORS, type ConfidenceBucket } from "@/lib/confidence";
import { pipelineService } from "@/services/pipeline-service";

interface ConfidenceBadgeProps {
  score: number;
  size?: 'sm' | 'md';
  showDot?: boolean;
  className?: string;
}

export function ConfidenceBadge({
  score,
  size = 'md',
  showDot = true,
  className = ''
}: ConfidenceBadgeProps) {
  const bucket = pipelineService.getConfidenceBucket(score);

  const sizeClasses = {
    sm: "text-[10px] px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
  };

  const dotSizeClasses = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-medium border ${CONFIDENCE_COLORS[bucket]} ${sizeClasses[size]} ${className}`}
    >
      {showDot && (
        <span className={`rounded-full ${CONFIDENCE_DOT_COLORS[bucket]} ${dotSizeClasses[size]}`} />
      )}
      {score}%
    </span>
  );
}