export function Spinner({ label = 'Memuat...' }: { label?: string }) {
  return (
    <div className="spinner-wrap" role="status" aria-label={label}>
      <span className="spinner" aria-hidden="true" />
      <span className="spinner-label">{label}</span>
    </div>
  );
}

export function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="progress-track" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-fill" style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function SkeletonRow() {
  return <div className="skeleton-row" aria-hidden="true" />;
}
