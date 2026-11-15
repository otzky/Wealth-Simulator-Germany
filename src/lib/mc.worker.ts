/// <reference lib="webworker" />
import type { SimulationConfig } from '../types';
import { runMonteCarlo, solveSafeWithdrawal } from './montecarlo';

export type McRequest =
  | { id: number; kind: 'run'; cfg: SimulationConfig }
  | { id: number; kind: 'safe'; cfg: SimulationConfig; probability: number };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<McRequest>) => {
  const msg = e.data;
  const progress = (share: number) => ctx.postMessage({ id: msg.id, kind: 'progress', progress: share });
  try {
    if (msg.kind === 'run') {
      const result = runMonteCarlo(msg.cfg, progress);
      ctx.postMessage({ id: msg.id, kind: 'done', result }, [
        result.paths.buffer,
        result.success.buffer,
        result.paidAll.buffer,
        result.endValues.buffer,
        result.depletedAge.buffer,
      ]);
    } else {
      ctx.postMessage({ id: msg.id, kind: 'done', result: solveSafeWithdrawal(msg.cfg, msg.probability, progress) });
    }
  } catch (err) {
    ctx.postMessage({ id: msg.id, kind: 'error', error: err instanceof Error ? err.message : String(err) });
  }
};
