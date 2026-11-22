import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, FileImage, FileSpreadsheet, FileText, Home, LineChart, Monitor, Moon, Sun } from 'lucide-react';
import { Button, IconButton, cx } from './ui';

/** Shared frame of all modules: logo, module switcher, export menu, theme, toast. */

export type Theme = 'system' | 'light' | 'dark';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const t = localStorage.getItem('vs-theme');
      return t === 'light' || t === 'dark' ? t : 'system';
    } catch {
      return 'system';
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      if (theme === 'system') localStorage.removeItem('vs-theme');
      else localStorage.setItem('vs-theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  return [theme, setTheme] as const;
}

export function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-9 shrink-0" aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M7 22l6-6 4 4 8-9" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="25" cy="11" r="2" fill="#fff" />
    </svg>
  );
}

export function ExportMenu({ onExport }: { onExport: (t: 'png' | 'pdf' | 'csv') => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const items = [
    { type: 'pdf' as const, icon: <FileText size={16} />, label: 'PDF-Bericht' },
    { type: 'png' as const, icon: <FileImage size={16} />, label: 'Bild (PNG)' },
    { type: 'csv' as const, icon: <FileSpreadsheet size={16} />, label: 'Tabelle (CSV)' },
  ];

  return (
    <div ref={ref} className="relative">
      <Button variant="primary" onClick={() => setOpen((o) => !o)} aria-haspopup aria-expanded={open}>
        Export <ChevronDown size={14} className={cx('transition-transform', open && 'rotate-180')} />
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-card">
          {items.map((i) => (
            <button
              key={i.type}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onExport(i.type);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <span className="text-muted">{i.icon}</span>
              {i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ThemeToggle({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  const next: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
  const label: Record<Theme, string> = { system: 'Design: System', light: 'Design: Hell', dark: 'Design: Dunkel' };
  return (
    <IconButton label={`${label[theme]} (wechseln)`} onClick={() => onChange(next[theme])}>
      {theme === 'system' ? <Monitor size={17} /> : theme === 'light' ? <Sun size={17} /> : <Moon size={17} />}
    </IconButton>
  );
}

export type ModuleId = 'wealth' | 'buyrent';

export const MODULES: { id: ModuleId; path: string; title: string; subtitle: string; icon: ReactNode }[] = [
  { id: 'wealth', path: '/', title: 'Vermögens-Simulator', subtitle: 'Sparplan, Dividenden & deutsche Steuern', icon: <LineChart size={16} /> },
  { id: 'buyrent', path: '/kaufen-mieten', title: 'Kaufen oder Mieten', subtitle: 'Eigenheim gegen Miete plus Geldanlage', icon: <Home size={16} /> },
];

/** The module name in the header; a click opens the list of modules. */
export function ModuleSwitcher({ current, onSwitch }: { current: ModuleId; onSwitch: (id: ModuleId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const mod = MODULES.find((m) => m.id === current)!;
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup
        aria-expanded={open}
        title="Rechner wechseln"
        className="group flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-surface-2"
      >
        <span className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold tracking-tight text-ink">{mod.title}</h1>
          <p className="hidden truncate text-xs text-muted lg:block">{mod.subtitle}</p>
        </span>
        <ChevronDown size={15} className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 z-30 mt-2 w-72 overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-card">
          <p className="px-2.5 pb-1 pt-1.5 text-xs font-medium text-muted">Rechner</p>
          {MODULES.map((m) => (
            <button
              key={m.id}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                if (m.id !== current) onSwitch(m.id);
              }}
              className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
            >
              <span className={cx('mt-0.5 grid size-7 shrink-0 place-items-center rounded-md', m.id === current ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink-2')}>{m.icon}</span>
              <span className="min-w-0 flex-1">
                <span className={cx('block text-[13px]', m.id === current ? 'font-semibold text-ink' : 'text-ink-2')}>{m.title}</span>
                <span className="block text-xs text-muted">{m.subtitle}</span>
              </span>
              {m.id === current && <Check size={15} className="mt-1 shrink-0 text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Short confirmation at the bottom of the screen. */
export function Toast({ message }: { message: string | null }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      {message && (
        <div className="flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[13px] font-medium text-bg shadow-lg">
          <Check size={15} /> {message}
        </div>
      )}
    </div>
  );
}
