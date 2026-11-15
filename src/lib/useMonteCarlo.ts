import { useCallback, useEffect, useRef, useState } from 'react';
import type { SimulationConfig } from '../types';
import type { MonteCarloResult, SafeWithdrawal } from './montecarlo';

type Reply<T> = { id: number; kind: 'progress'; progress: number } | { id: number; kind: 'done'; result: T } | { id: number; kind: 'error'; error: string };

/**
 * Runs one job at a time in a Web Worker, so the page stays responsive.
 * A new job replaces a running one (the worker is restarted).
 */
class JobRunner<T> {
  private worker: Worker | null = null;
  private busy = false;
  private id = 0;

  run(msg: object, onDone: (r: { result: T | null; error: string | null }) => void, onProgress?: (p: number) => void) {
    if (this.busy) this.dispose();
    if (!this.worker) this.worker = new Worker(new URL('./mc.worker.ts', import.meta.url), { type: 'module' });
    const id = ++this.id;
    this.busy = true;
    this.worker.onmessage = (e: MessageEvent<Reply<T>>) => {
      const m = e.data;
      if (m.id !== id) return;
      if (m.kind === 'progress') return onProgress?.(m.progress);
      this.busy = false;
      onDone(m.kind === 'done' ? { result: m.result, error: null } : { result: null, error: m.error });
    };
    this.worker.onerror = (e) => {
      this.busy = false;
      onDone({ result: null, error: e.message || 'Berechnung fehlgeschlagen' });
    };
    this.worker.postMessage({ ...msg, id });
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.busy = false;
  }
}

export interface McState {
  enabled: boolean;
  result: MonteCarloResult | null;
  running: boolean;
  progress: number;
  error: string | null;
}

/** Monte Carlo for the current settings; recalculated shortly after every change. */
export function useMonteCarlo(config: SimulationConfig): McState {
  const runner = useRef<JobRunner<MonteCarloResult> | null>(null);
  const [state, setState] = useState<Omit<McState, 'enabled'>>({ result: null, running: false, progress: 0, error: null });
  const key = config.monteCarlo.enabled ? JSON.stringify(config) : null;

  useEffect(() => {
    if (!key) {
      runner.current?.dispose();
      return;
    }
    setState((s) => ({ ...s, running: true, progress: 0 }));
    const t = setTimeout(() => {
      runner.current ??= new JobRunner<MonteCarloResult>();
      runner.current.run(
        { kind: 'run', cfg: JSON.parse(key) },
        ({ result, error }) => setState((s) => ({ result: result ?? s.result, running: false, progress: 1, error })),
        (progress) => setState((s) => ({ ...s, progress })),
      );
    }, 250);
    return () => clearTimeout(t);
  }, [key]);

  useEffect(() => () => runner.current?.dispose(), []);

  return { ...state, enabled: !!key };
}

export interface SafeState {
  result: SafeWithdrawal | null;
  key: string | null; // settings the result belongs to
  running: boolean;
  progress: number;
  error: string | null;
}

/** The safe withdrawal is calculated on request only, because it takes a few seconds. */
export function useSafeWithdrawal() {
  const runner = useRef<JobRunner<SafeWithdrawal | null> | null>(null);
  const [state, setState] = useState<SafeState>({ result: null, key: null, running: false, progress: 0, error: null });

  const start = useCallback((cfg: SimulationConfig, probability: number) => {
    const key = safeKey(cfg, probability);
    setState({ result: null, key, running: true, progress: 0, error: null });
    runner.current ??= new JobRunner<SafeWithdrawal | null>();
    runner.current.run(
      { kind: 'safe', cfg, probability },
      ({ result, error }) => setState({ result, key, running: false, progress: 1, error }),
      (progress) => setState((s) => ({ ...s, progress })),
    );
  }, []);

  useEffect(() => () => runner.current?.dispose(), []);
  return { ...state, start };
}

export function safeKey(cfg: SimulationConfig, probability: number) {
  return JSON.stringify([cfg, probability]);
}
