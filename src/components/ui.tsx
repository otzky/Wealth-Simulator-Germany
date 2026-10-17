import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { formatNumber, parseNumber } from '../lib/format';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export function Card({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <div id={id} className={cx('rounded-2xl border border-line bg-surface shadow-card', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label="Erklärung"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="rounded-full text-muted transition-colors hover:text-ink focus-visible:text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Info size={13} />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-30 mb-2 w-64 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-xs leading-relaxed font-normal text-ink-2 shadow-card"
        >
          {children}
        </span>
      )}
    </span>
  );
}

interface FieldShellProps {
  label: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, htmlFor, trailing, children, className }: FieldShellProps) {
  return (
    <div className={cx('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2">
          {label}
          {hint && <Hint>{hint}</Hint>}
        </label>
        {trailing}
      </div>
      {children}
    </div>
  );
}

const inputBase =
  'w-full rounded-lg border border-line bg-surface-2 text-[14px] text-ink transition-colors placeholder:text-muted hover:border-line-strong focus:border-accent focus:bg-surface focus:outline-none focus:ring-3 focus:ring-accent-soft';

interface NumberInputProps {
  id?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  suffix?: string;
  min?: number;
  max?: number;
  allowEmpty?: boolean;
  placeholder?: string;
  className?: string;
  size?: 'md' | 'sm';
  'aria-label'?: string;
}

/** Text-based number input that accepts German formatting ("1.000,50") and updates live. */
export function NumberInput({ id, value, onChange, suffix, min, max, allowEmpty, placeholder, className, size = 'md', ...rest }: NumberInputProps) {
  const [text, setText] = useState(value == null ? '' : formatNumber(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(value == null ? '' : formatNumber(value));
  }, [value, focused]);

  const clampV = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));

  return (
    <div className={cx('relative', className)}>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={rest['aria-label']}
        placeholder={placeholder}
        value={text}
        onFocus={(e) => {
          setFocused(true);
          requestAnimationFrame(() => e.target.select());
        }}
        onChange={(e) => {
          setText(e.target.value);
          const v = parseNumber(e.target.value);
          if (v != null) onChange(clampV(v));
          else if (allowEmpty && e.target.value.trim() === '') onChange(null);
        }}
        onBlur={() => {
          setFocused(false);
          const v = parseNumber(text);
          if (v == null) {
            if (allowEmpty) onChange(null);
            setText(value == null || allowEmpty ? '' : formatNumber(value));
          } else {
            onChange(clampV(v));
            setText(formatNumber(clampV(v)));
          }
        }}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
          e.preventDefault();
          const cur = value ?? 0;
          const mag = Math.abs(cur) >= 10_000 ? 1000 : Math.abs(cur) >= 1000 ? 100 : Math.abs(cur) >= 50 ? 10 : Math.abs(cur) >= 10 ? 1 : 0.1;
          const step = e.shiftKey ? mag * 10 : mag;
          const next = clampV(Math.round((cur + (e.key === 'ArrowUp' ? step : -step)) * 100) / 100);
          onChange(next);
          setText(formatNumber(next));
        }}
        className={cx(
          inputBase,
          'tnum',
          size === 'md' ? 'h-10 px-3' : 'h-9 px-2.5 text-[13px]',
          suffix && (size === 'md' ? 'pr-10' : 'pr-8'),
        )}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-muted">{suffix}</span>
      )}
    </div>
  );
}

export function NumberField(props: Omit<NumberInputProps, 'id'> & { label: ReactNode; hint?: ReactNode; className?: string }) {
  const id = useId();
  const { label, hint, className, ...input } = props;
  return (
    <Field label={label} hint={hint} htmlFor={id} className={className}>
      <NumberInput id={id} {...input} />
    </Field>
  );
}

interface SliderFieldProps {
  label: ReactNode;
  hint?: ReactNode;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  inputMax?: number;
  inputMin?: number;
}

/** A slider for quick exploration plus an exact input. */
export function SliderField({ label, hint, value, onChange, min, max, step, suffix, inputMax, inputMin }: SliderFieldProps) {
  const id = useId();
  const fill = `${((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100}%`;
  return (
    <Field
      label={label}
      hint={hint}
      htmlFor={id}
      trailing={
        <NumberInput
          id={id}
          size="sm"
          value={value}
          onChange={(v) => onChange(v ?? 0)}
          suffix={suffix}
          min={inputMin ?? min}
          max={inputMax ?? max}
          className="w-28"
        />
      }
    >
      <input
        type="range"
        className="slider block"
        aria-label={typeof label === 'string' ? label : undefined}
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        style={{ ['--fill' as string]: fill }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  );
}

export function TextInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputBase, 'h-10 px-3', className)} />;
}

export function Select<T extends string | number>({
  value,
  onChange,
  options,
  id,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  id?: string;
  size?: 'md' | 'sm';
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div className={cx('relative', className)}>
      <select
        id={id}
        aria-label={ariaLabel}
        value={String(value)}
        onChange={(e) => {
          const opt = options.find((o) => String(o.value) === e.target.value);
          if (opt) onChange(opt.value);
        }}
        className={cx(inputBase, 'tnum appearance-none pr-8', size === 'md' ? 'h-10 pl-3' : 'h-9 pl-2.5 text-[13px]')}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted" />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  size?: 'md' | 'sm';
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cx('flex rounded-lg bg-surface-3/70 p-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'flex-1 rounded-md font-medium whitespace-nowrap transition-all focus-visible:outline-2 focus-visible:outline-accent',
              size === 'md' ? 'h-8 px-3 text-[13px]' : 'h-7 px-2.5 text-xs',
              active ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-[13px] font-medium text-ink-2">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-snug text-muted">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          checked ? 'bg-accent' : 'bg-line-strong',
        )}
      >
        <span
          className={cx(
            'inline-block size-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

export function Section({
  icon,
  title,
  summary,
  defaultOpen = true,
  children,
}: {
  icon: ReactNode;
  title: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <section className="border-b border-line last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-center gap-3 px-5 py-4 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-2">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-ink">{title}</span>
          {summary && !open && <span className="tnum block truncate text-xs text-muted">{summary}</span>}
        </span>
        <ChevronDown size={16} className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      <div id={bodyId} hidden={!open} className="space-y-4 px-5 pb-5">
        {children}
      </div>
    </section>
  );
}

export function IconButton({
  children,
  label,
  onClick,
  variant = 'ghost',
  className,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  variant?: 'ghost' | 'danger';
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors focus-visible:outline-2 focus-visible:outline-accent',
        variant === 'danger' ? 'hover:bg-critical-soft hover:text-critical' : 'hover:bg-surface-2 hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  className,
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'sm';
  className?: string;
  'aria-haspopup'?: boolean;
  'aria-expanded'?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        size === 'md' ? 'h-9 px-3.5 text-[13px]' : 'h-8 px-2.5 text-xs',
        variant === 'primary' && 'bg-accent text-accent-ink hover:bg-accent-hover',
        variant === 'secondary' && 'border border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-2',
        variant === 'ghost' && 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  );
}
