import clsx from 'clsx';
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

export { clsx as cx };

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'outline';
const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand whitespace-nowrap';
const btnVariants: Record<BtnVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand/90 shadow-sm',
  accent: 'bg-accent text-white hover:bg-accent/90 shadow-sm',
  secondary: 'bg-sand-100 text-ink hover:bg-sand-200',
  outline: 'border border-sand-300 bg-white text-ink hover:bg-sand-50',
  ghost: 'text-ink/70 hover:bg-sand-100 hover:text-ink',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
};
const btnSizes = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' };

export function buttonClass(variant: BtnVariant = 'primary', size: keyof typeof btnSizes = 'md', extra?: string) {
  return clsx(btnBase, btnVariants[variant], btnSizes[size], extra);
}

export function Button({ variant = 'primary', size = 'md', className, ...p }: ComponentProps<'button'> & { variant?: BtnVariant; size?: keyof typeof btnSizes }) {
  return <button className={buttonClass(variant, size, className)} {...p} />;
}

export function LinkButton({ variant = 'primary', size = 'md', className, ...p }: ComponentProps<typeof Link> & { variant?: BtnVariant; size?: keyof typeof btnSizes }) {
  return <Link className={buttonClass(variant, size, className)} {...p} />;
}

export function Card({ className, ...p }: ComponentProps<'div'>) {
  return <div className={clsx('rounded-2xl border border-sand-200 bg-white shadow-card', className)} {...p} />;
}

export function CardHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex items-start justify-between gap-3 border-b border-sand-100 px-5 py-4', className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-stone-450">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', className)}>
      {children}
    </span>
  );
}

const fieldBase =
  'w-full rounded-xl border border-sand-300 bg-white px-3.5 text-sm text-ink placeholder:text-stone-400 transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:bg-sand-50';

export function Input({ className, ...p }: ComponentProps<'input'>) {
  return <input className={clsx(fieldBase, 'h-11', className)} {...p} />;
}
export function Select({ className, ...p }: ComponentProps<'select'>) {
  return <select className={clsx(fieldBase, 'h-11 pe-8', className)} {...p} />;
}
export function Textarea({ className, ...p }: ComponentProps<'textarea'>) {
  return <textarea className={clsx(fieldBase, 'min-h-[96px] py-3 leading-relaxed', className)} {...p} />;
}

export function Field({ label, hint, children, className, required }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string; required?: boolean }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink/80">
        {label}
        {required && <span className="ms-0.5 text-rose-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-450">{hint}</span>}
    </label>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-medium tracking-wide text-accent">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-450">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-sand-100 text-stone-450">{icon}</div>}
      <p className="text-sm font-medium text-ink/80">{title}</p>
      {children && <div className="mt-2 text-sm text-stone-450">{children}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon, tone = 'default' }: { label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: 'default' | 'warn' | 'good' | 'brand' }) {
  const tones = {
    default: 'bg-white',
    brand: 'bg-brand text-white border-brand',
    warn: 'bg-white',
    good: 'bg-white',
  };
  const iconTones = {
    default: 'bg-sand-100 text-ink/70',
    brand: 'bg-white/10 text-white',
    warn: 'bg-rose-50 text-rose-600',
    good: 'bg-emerald-50 text-emerald-700',
  };
  return (
    <div className={clsx('rounded-2xl border border-sand-200 p-4 shadow-card', tones[tone])}>
      <div className="flex items-start justify-between gap-2">
        <span className={clsx('text-[13px]', tone === 'brand' ? 'text-white/75' : 'text-stone-450')}>{label}</span>
        {icon && <span className={clsx('grid h-8 w-8 place-items-center rounded-lg', iconTones[tone])}>{icon}</span>}
      </div>
      <div className="mt-2 text-[26px] font-semibold leading-none tracking-tight tabular-nums">{value}</div>
      {hint && <div className={clsx('mt-1.5 text-xs', tone === 'brand' ? 'text-white/65' : 'text-stone-450')}>{hint}</div>}
    </div>
  );
}

export function KeyValue({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="shrink-0 text-stone-450">{label}</span>
      <span className="text-end font-medium text-ink">{children}</span>
    </div>
  );
}

export function Alert({ tone = 'info', children, className }: { tone?: 'info' | 'warn' | 'error' | 'success'; children: ReactNode; className?: string }) {
  const tones = {
    info: 'bg-sky-50 text-sky-900 border-sky-200',
    warn: 'bg-amber-50 text-amber-900 border-amber-200',
    error: 'bg-rose-50 text-rose-900 border-rose-200',
    success: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  };
  return <div className={clsx('rounded-xl border px-4 py-3 text-sm', tones[tone], className)}>{children}</div>;
}
