"use client";

interface ProgressRingProps {
  completed: number;
  total: number;
  size?: number;
  strokeWidth?: number;
}

export default function ProgressRing({
  completed,
  total,
  size = 110,
  strokeWidth = 10,
}: ProgressRingProps) {
  const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  const isComplete = percent === 100 && total > 0;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <defs>
          <linearGradient id="mRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4FA3FF" />
            <stop offset="50%" stopColor="#0B3A82" />
            <stop offset="100%" stopColor="#E4101E" />
          </linearGradient>
          <filter id="mGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#1A1C22"
          strokeWidth={strokeWidth}
          fill="transparent"
        />

        {/* Progress stroke */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#mRingGradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-300 ease-out"
          style={{
            filter: isComplete ? "url(#mGlow)" : "none",
          }}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-heading font-extrabold text-2xl tracking-tighter text-white">
          {percent}%
        </span>
        <span className="text-[10px] uppercase font-semibold text-[#8A92A3] tracking-widest -mt-1">
          {completed}/{total}
        </span>
      </div>
    </div>
  );
}

