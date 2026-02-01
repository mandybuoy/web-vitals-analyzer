'use client';

interface ScoreGaugeProps {
  score: number;
  size?: number;
  label?: string;
  animate?: boolean;
}

function getColor(score: number): string {
  if (score >= 90) return '#0cce6b';
  if (score >= 50) return '#ffa400';
  return '#ff4e42';
}

function getLabel(score: number): string {
  if (score >= 90) return 'Good';
  if (score >= 50) return 'Needs Work';
  return 'Poor';
}

export default function ScoreGauge({ score, size = 120, label, animate = true }: ScoreGaugeProps) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getColor(score);
  const strokeWidth = 5;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 100 100" className="transform -rotate-90">
          <circle
            cx="50" cy="50" r={radius}
            fill="none" stroke="rgba(232,233,215,0.08)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx="50" cy="50" r={radius}
            fill="none" stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={animate ? offset : circumference}
            style={{ transition: animate ? 'stroke-dashoffset 1.5s ease-out' : 'none' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-sans leading-brand"
            style={{ color, fontSize: size * 0.28, fontWeight: 400 }}
          >
            {Math.round(score)}
          </span>
          <span className="text-[9px] text-vecton-beige/50 mt-0.5 uppercase tracking-widest">
            {getLabel(score)}
          </span>
        </div>
      </div>
      {label && (
        <span className="text-[11px] text-vecton-beige/60 tracking-widest uppercase">
          {label}
        </span>
      )}
    </div>
  );
}
