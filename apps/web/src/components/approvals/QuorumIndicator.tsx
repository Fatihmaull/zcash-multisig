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
  const progress = Math.min(1, Math.max(0, collected / required));
  const dashOffset = Math.round(circumference * (1 - progress) * 100) / 100;
  const isComplete = collected >= required;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg 
        width={size} 
        height={size} 
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90 drop-shadow-xs"
      >
        <defs>
          <linearGradient id="quorum-gold-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#f4b728" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <linearGradient id="quorum-complete-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>

        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-slate-200 dark:stroke-slate-800/80"
        />

        {/* Dynamic progress stroke */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          stroke={isComplete ? "url(#quorum-complete-gradient)" : "url(#quorum-gold-gradient)"}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-all duration-700 ease-out"
        />

        {/* Signer node dots around circle */}
        {Array.from({ length: total }).map((_, i) => {
          const angle = (i / total) * 2 * Math.PI;
          const dotDistance = radius;
          const cx = Math.round((size / 2 + dotDistance * Math.cos(angle)) * 100) / 100;
          const cy = Math.round((size / 2 + dotDistance * Math.sin(angle)) * 100) / 100;
          const isSigned = i < collected;

          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={4}
              className={`transition-colors duration-500 ${
                isSigned 
                  ? "fill-emerald-500 stroke-white dark:stroke-slate-950 stroke-[2]" 
                  : "fill-slate-300 dark:fill-slate-700 stroke-slate-100 dark:stroke-slate-900 stroke-[1.5]"
              }`}
            />
          );
        })}
      </svg>

      {/* Centered Quorum Text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
        <div className="flex items-baseline gap-0.5">
          <span className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight ${
            isComplete ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
          }`}>
            {collected}
          </span>
          <span className="text-xs text-[var(--text-muted)] font-mono">
            /{required}
          </span>
        </div>
        <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--text-muted)] font-medium mt-0.5">
          {isComplete ? "Quorum Met" : "Signatures"}
        </span>
      </div>
    </div>
  );
}
