import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leading,
  trailing,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <button
      className={cx('ms-button', `ms-button-${variant}`, `ms-button-${size}`, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="ms-spinner" aria-hidden="true" /> : leading}
      <span>{children}</span>
      {!loading && trailing}
    </button>
  );
}

export function Card({ className, children, interactive = false, ...props }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return <div className={cx('ms-card', interactive && 'ms-card-interactive', className)} {...props}>{children}</div>;
}

export function Badge({ tone = 'blue', children, className }: { tone?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'neutral'; children: ReactNode; className?: string }) {
  return <span className={cx('ms-badge', `ms-badge-${tone}`, className)}>{children}</span>;
}

export function Field({ label, hint, error, leading, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string; leading?: ReactNode }) {
  return (
    <label className={cx('ms-field', error && 'ms-field-error', className)}>
      <span className="ms-field-label">{label}</span>
      <span className="ms-input-wrap">{leading && <span className="ms-field-leading">{leading}</span>}<input {...props} /></span>
      {error ? <small className="ms-field-message">{error}</small> : hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function Progress({ value, label, showValue = true }: { value: number; label?: string; showValue?: boolean }) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className="ms-progress">
      {(label || showValue) && <div className="ms-progress-head"><span>{label}</span>{showValue && <b>{safe}%</b>}</div>}
      <div className="ms-progress-track"><i style={{ width: `${safe}%` }} /></div>
    </div>
  );
}

export function Stat({ label, value, change, icon }: { label: string; value: string; change?: string; icon?: ReactNode }) {
  return <Card className="ms-stat"><div className="ms-stat-icon">{icon}</div><div><small>{label}</small><strong>{value}</strong>{change && <span>{change}</span>}</div></Card>;
}

export function EmptyState({ icon = '◇', title, description, action }: { icon?: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="ms-empty"><span>{icon}</span><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function Skeleton({ width = '100%', height = 16, radius = 10 }: { width?: string | number; height?: number; radius?: number }) {
  return <span className="ms-skeleton" style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}
