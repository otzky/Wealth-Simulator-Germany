import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, FolderOpen, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { cx } from './ui';

/** What the menu needs of a scenario; the inputs themselves stay with the module. */
export interface ScenarioItem {
  id: string;
  name: string;
  updatedAt: number;
}

interface Props {
  items: ScenarioItem[];
  activeId: string;
  onSwitch: (id: string) => void;
  onCreate: (kind: 'blank' | 'copy') => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  onReset: () => void;
}

const dateFmt = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' });

/** Switch between scenarios saved in this browser, create, rename and delete them. */
export default function ScenarioMenu({ items, activeId, onSwitch, onCreate, onRename, onDelete, onDeleteAll, onReset }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null); // scenario id, 'all' or 'reset'
  const ref = useRef<HTMLDivElement>(null);
  const active = items.find((i) => i.id === activeId) ?? items[0];

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setConfirm(null);
      return;
    }
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && !editing && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open, editing]);

  const startRename = (s: ScenarioItem) => {
    setConfirm(null);
    setEditing(s.id);
    setDraft(s.name);
  };
  const commitRename = () => {
    if (editing && draft.trim()) onRename(editing, draft.trim().slice(0, 60));
    setEditing(null);
  };
  const sorted = [...items].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup
        aria-expanded={open}
        title="Szenarien"
        className="flex h-9 min-w-0 max-w-[16rem] items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-ink transition-colors hover:bg-surface-2"
      >
        <FolderOpen size={15} className="shrink-0 text-muted" />
        <span className="truncate">{active.name}</span>
        <ChevronDown size={14} className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-2 w-[19rem] overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          <div className="px-3.5 pb-1.5 pt-3">
            <p className="text-[13px] font-semibold text-ink">Szenarien</p>
            <p className="text-xs text-muted">Nur in diesem Browser gespeichert, nicht auf einem Server.</p>
          </div>

          <ul className="scroll-thin max-h-72 overflow-y-auto px-1.5 py-1">
            {sorted.map((s) => {
              const isActive = s.id === active.id;
              if (editing === s.id) {
                return (
                  <li key={s.id} className="flex items-center gap-1 px-1.5 py-1">
                    <input
                      autoFocus
                      value={draft}
                      maxLength={60}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') setEditing(null);
                      }}
                      aria-label="Name des Szenarios"
                      className="h-8 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2 text-[13px] text-ink outline-none focus:border-accent"
                    />
                    <IconAction label="Speichern" onClick={commitRename}>
                      <Check size={15} />
                    </IconAction>
                    <IconAction label="Abbrechen" onClick={() => setEditing(null)}>
                      <X size={15} />
                    </IconAction>
                  </li>
                );
              }
              return (
                <li key={s.id} className="group flex items-center gap-1 rounded-lg hover:bg-surface-2">
                  <button
                    type="button"
                    onClick={() => {
                      onSwitch(s.id);
                      setOpen(false);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left"
                  >
                    <Check size={14} className={cx('shrink-0', isActive ? 'text-accent' : 'invisible')} />
                    <span className="min-w-0">
                      <span className={cx('block truncate text-[13px]', isActive ? 'font-semibold text-ink' : 'text-ink-2')}>{s.name}</span>
                      <span className="block text-[11px] text-muted">geändert {dateFmt.format(s.updatedAt)}</span>
                    </span>
                  </button>
                  {confirm === s.id ? (
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(s.id);
                        setConfirm(null);
                      }}
                      className="mr-1.5 shrink-0 rounded-md bg-critical px-2 py-1 text-xs font-medium text-white"
                    >
                      Löschen
                    </button>
                  ) : (
                    <span className="mr-1 flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      <IconAction label={`„${s.name}“ umbenennen`} onClick={() => startRename(s)}>
                        <Pencil size={14} />
                      </IconAction>
                      <IconAction label={`„${s.name}“ löschen`} onClick={() => setConfirm(s.id)}>
                        <Trash2 size={14} />
                      </IconAction>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="border-t border-line p-1.5">
            <MenuAction
              icon={<Plus size={15} />}
              onClick={() => {
                onCreate('blank');
                setOpen(false);
              }}
            >
              Neues Szenario
              <span className="ml-1 text-muted">· Standardwerte</span>
            </MenuAction>
            <MenuAction
              icon={<Copy size={15} />}
              onClick={() => {
                onCreate('copy');
                setOpen(false);
              }}
            >
              <span className="truncate">„{active.name}“ kopieren</span>
            </MenuAction>
            {confirm === 'reset' ? (
              <div className="flex items-center gap-2 px-2 py-1.5">
                <p className="flex-1 text-xs text-ink-2">Auf Standardwerte setzen?</p>
                <button type="button" onClick={() => setConfirm(null)} className="rounded-md px-2 py-1 text-xs text-muted hover:text-ink">
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onReset();
                    setOpen(false);
                  }}
                  className="rounded-md bg-ink px-2 py-1 text-xs font-medium text-surface"
                >
                  Zurücksetzen
                </button>
              </div>
            ) : (
              <MenuAction icon={<RotateCcw size={15} />} onClick={() => setConfirm('reset')}>
                <span className="truncate">„{active.name}“ zurücksetzen</span>
              </MenuAction>
            )}
          </div>

          <div className="border-t border-line p-1.5">
            {confirm === 'all' ? (
              <div className="flex items-center gap-2 px-2 py-1.5">
                <p className="flex-1 text-xs text-ink-2">Alle Szenarien aus diesem Browser löschen?</p>
                <button type="button" onClick={() => setConfirm(null)} className="rounded-md px-2 py-1 text-xs text-muted hover:text-ink">
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteAll();
                    setOpen(false);
                  }}
                  className="rounded-md bg-critical px-2 py-1 text-xs font-medium text-white"
                >
                  Alle löschen
                </button>
              </div>
            ) : (
              <MenuAction icon={<Trash2 size={15} />} danger onClick={() => setConfirm('all')}>
                Alle Szenarien löschen
              </MenuAction>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface-3 hover:text-ink"
    >
      {children}
    </button>
  );
}

function MenuAction({ icon, onClick, danger, children }: { icon: React.ReactNode; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-surface-2',
        danger ? 'text-critical' : 'text-ink-2 hover:text-ink',
      )}
    >
      <span className={cx('shrink-0', danger ? 'text-critical' : 'text-muted')}>{icon}</span>
      {children}
    </button>
  );
}
