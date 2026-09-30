"use client";

interface QuorumIndicatorProps {
  collected: number;
  required: number;
  total: number;
  size?: number;
}

export function QuorumIndicator({
  collected,
  required,
  total,
  size = 140,
}: QuorumIndicatorProps) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.round(2 * Math.PI * radius * 100) / 100;
  const safeRequired = required > 0 ? required : 1;
  const progress = Math.min(1, Math.max(0, collected / safeRequired));
  const dashOffset = Math.round(circumference * (1 - progress) * 100) / 100;
  const isComplete = required > 0 && collected >= required;
  const stroke = isComplete ? "var(--success)" : "var(--warning)";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          stroke="var(--border-default)"
        />

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          stroke={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />

        {Array.from({ length: total }).map((_, i) => {
          const angle = (i / total) * 2 * Math.PI;
          const cx = Math.round((size / 2 + radius * Math.cos(angle)) * 100) / 100;
          const cy = Math.round((size / 2 + radius * Math.sin(angle)) * 100) / 100;
          const isSigned = i < collected;

          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={4}
              fill={isSigned ? "var(--success)" : "var(--border-strong)"}
              stroke="var(--bg-card)"
              strokeWidth={2}
            />
          );
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
        <div className="flex items-baseline gap-0.5">
          <span
            className="text-2xl sm:text-3xl font-bold font-mono tracking-tight"
            style={{ color: isComplete ? "var(--success-text)" : "var(--warning-text)" }}
          >
            {collected}
          </span>
          <span className="text-xs text-[var(--text-muted)] font-mono">/{required}</span>
        </div>
        <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--text-muted)] font-medium mt-0.5">
          {isComplete ? "Quorum Met" : "Signatures"}
        </span>
      </div>
    </div>
  );
}
