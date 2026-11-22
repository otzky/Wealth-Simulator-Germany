import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/defaults';
import { InputError } from './scenario';
import { readShareLink, shareLink } from './share';
import { MemoryPlanStore } from './store';
import { AgentTools } from './tools';

const fresh = () => new AgentTools(new MemoryPlanStore(), 'http://app/');
const retire = { initialCapital: 200000, monthlySavings: 1000, withdrawal: { enabled: true, startYear: 2050, mode: 'fixed', monthlyNet: 2500 } };

describe('agent tools', () => {
  it('explains a missing saved plan when it is asked for explicitly', () => {
    expect(() => fresh().simulate({ base: 'saved' })).toThrow(/import_link/);
  });

  it('simulates from defaults and reports assumed key fields', () => {
    const r = fresh().simulate({ base: 'defaults', changes: { monthlySavings: 800 } });
    expect(r.changed.monthlySavings).toEqual({ from: defaultConfig().monthlySavings, to: 800 });
    expect(r.notes.join(' ')).toMatch(/Standardwerte angenommen/);
    expect(r.end.value).toBeGreaterThan(r.end.invested);
    expect(r.app_link.startsWith('http://app/#s=')).toBe(true);
  });

  it('rejects unknown fields instead of ignoring them', () => {
    expect(() => fresh().simulate({ base: 'defaults', changes: { monthlySaving: 800 } })).toThrow(InputError);
    expect(() => fresh().simulate({ base: 'defaults', changes: { withdrawal: { amount: 1 } } })).toThrow(InputError);
  });

  it('builds on earlier results and replaces lists', () => {
    const t = fresh();
    const a = t.simulate({ base: 'defaults', changes: { lumpSums: [{ year: 2030, amount: 50000, label: 'Erbe' }] } });
    const b = t.simulate({ base: `result:${a.result_id}`, changes: { monthlySavings: 900 } });
    expect(Object.keys(b.changed)).toEqual(['monthlySavings']);
    const c = t.simulate({ base: `result:${a.result_id}`, changes: { lumpSums: [] } });
    expect(c.end.value).toBeLessThan(a.end.value);
  });

  it('round-trips app share links into the plan store', () => {
    const t = fresh();
    const cfg = { ...defaultConfig(), monthlySavings: 1234 };
    expect((readShareLink(shareLink(cfg, 'http://x/')) as { monthlySavings: number }).monthlySavings).toBe(1234);
    t.plans({ action: 'import_link', link: shareLink(cfg), name: 'Ich' });
    expect(t.plans({ action: 'list' })).toMatchObject({ default: 'Ich' });
    const r = t.simulate({});
    expect(r.base).toMatch(/Ich/);
    expect(r.changed).toEqual({});
  });

  it('saves results as plans and switches the default', () => {
    const t = fresh();
    const r = t.simulate({ base: 'defaults', changes: { monthlySavings: 700 } });
    t.plans({ action: 'save', name: 'A', base: `result:${r.result_id}`, make_default: true });
    t.plans({ action: 'save', name: 'B', base: 'plan:A', changes: { monthlySavings: 900 } });
    expect(t.simulate({}).changed).toEqual({});
    t.plans({ action: 'set_default', name: 'B' });
    expect((t.plans({ action: 'get' }) as { config: ReturnType<typeof defaultConfig> }).config.monthlySavings).toBe(900);
    t.plans({ action: 'delete', name: 'B' });
    expect(() => t.simulate({ base: 'plan:B' })).toThrow(InputError);
  });

  it('solves the withdrawal for a wanted end wealth', () => {
    const r = fresh().solve({ base: 'defaults', changes: { ...retire, withdrawal: { startYear: 2050, lifeExpectancy: 90, endWealth: 100000 } }, target: 'withdrawal_for_end_wealth' });
    const a = r.answer as { monthly_net_first_year: number };
    expect(a.monthly_net_first_year).toBeGreaterThan(1000);
  });

  it('solves the savings needed for a goal', () => {
    const r = fresh().solve({ base: 'defaults', changes: { goal: { wealth: 1000000 } }, target: 'goal', variable: 'savings' });
    const a = r.answer as { required: number; reachable: boolean };
    expect(a.reachable).toBe(true);
    expect(a.required).toBeGreaterThan(0);
  });

  it('runs Monte Carlo reproducibly, with a safe withdrawal', () => {
    const t = fresh();
    const a = t.monteCarlo({ base: 'defaults', changes: retire, safe_probability: 0.9 }) as Record<string, any>;
    const b = t.monteCarlo({ base: 'defaults', changes: retire }) as Record<string, any>;
    expect(a.success.rate).toBe(b.success.rate);
    expect(a.success.rate).toBeGreaterThan(0);
    expect(a.safe_withdrawal.available).toBe(true);
    expect(a.value_percentiles.at(-1).p90).toBeGreaterThan(a.value_percentiles.at(-1).p10);
  }, 30000);

  it('compares scenarios side by side', () => {
    const r = fresh().compare({
      scenarios: [
        { name: '500', base: 'defaults', changes: { monthlySavings: 500 } },
        { name: '1000', base: 'defaults', changes: { monthlySavings: 1000 } },
      ],
    });
    expect((r.scenarios[1].end_value as number) > (r.scenarios[0].end_value as number)).toBe(true);
  });

  it('describes every key field', () => {
    const d = fresh().describe();
    const paths = d.fields.map((f) => f.path);
    for (const p of ['monthlySavings', 'withdrawal.endWealth', 'monteCarlo.volatility', 'lumpSums']) expect(paths).toContain(p);
  });
});

describe('starting from scratch', () => {
  it('falls back to standard values when nothing is saved and asks for personal data', () => {
    const r = fresh().simulate({ changes: { monthlySavings: 600 } });
    expect(r.base).toMatch(/neue Rechnung/);
    const n = r.notes.join(' ');
    expect(n).toMatch(/bitte bei der Person erfragen: .*birthDate/);
    expect(n).toMatch(/initialCapital/);
    expect(n).not.toMatch(/erfragen: [^.]*monthlySavings/);
  });

  it('uses the saved plan with "auto" once there is one, but "defaults" still starts fresh', () => {
    const t = fresh();
    t.plans({ action: 'save', name: 'P', base: 'defaults', changes: { monthlySavings: 1111 }, make_default: true });
    expect(t.simulate({}).base).toMatch(/P/);
    expect(t.simulate({ base: 'defaults' }).changed.monthlySavings).toBeUndefined();
  });

  it('accepts age as a shortcut for the birth date', () => {
    const r = fresh().simulate({ changes: { age: 30, initialCapital: 20000, monthlySavings: 800, totalReturn: 6 } });
    expect((r as unknown as { milestones: { age: number }[] }).milestones[0].age).toBe(30);
    expect(r.notes.join(' ')).not.toMatch(/erfragen/);
    expect(() => fresh().simulate({ changes: { age: 30, birthDate: '1990-01-01' } })).toThrow(InputError);
  });

  it('compares scenarios on shared base data', () => {
    const r = fresh().compare({
      changes: { age: 30, initialCapital: 20000, monthlySavings: 800 },
      scenarios: [
        { name: '5 %', changes: { totalReturn: 5 } },
        { name: '7 %', changes: { totalReturn: 7 } },
        { name: '7 % + 200 €', changes: { totalReturn: 7, monthlySavings: 1000 } },
      ],
    });
    const v = r.scenarios.map((s) => s.end_value as number);
    expect(v[0]).toBeLessThan(v[1]);
    expect(v[1]).toBeLessThan(v[2]);
    expect(r.scenarios[0].end_age).toBe(r.scenarios[1].end_age);
  });
});

describe('different people', () => {
  type R = { milestones: { age: number }[]; horizon: { end_age: number }; withdrawals: { phase: { start_age: number } | null } | null; notes: string[] };
  const run = (changes: object) => fresh().simulate({ changes }) as unknown as R;

  it('a newborn runs until retirement without date problems', () => {
    const r = run({ age: 0, initialCapital: 0, monthlySavings: 100, totalReturn: 7 });
    expect(r.milestones[0].age).toBe(0);
    expect(r.horizon.end_age).toBe(67);
    expect(r.notes.join(' ')).not.toMatch(/Geburtsdatum liegt nicht/);
  });

  it('a 25-year-old saver runs until 67, not just 30 years', () => {
    expect(run({ age: 25, initialCapital: 5000, monthlySavings: 300, totalReturn: 7 }).horizon.end_age).toBe(67);
  });

  it('withdrawal.startAge starts when the person really has that age', () => {
    const r = run({ age: 45, initialCapital: 150000, monthlySavings: 1500, totalReturn: 6, withdrawal: { enabled: true, startAge: 60, monthlyNet: 3000 } });
    expect(r.withdrawals?.phase?.start_age).toBe(60);
    expect(r.notes.join(' ')).not.toMatch(/ungültig/);
  });

  it('a retiree withdraws right away until the life expectancy', () => {
    const r = run({ age: 70, initialCapital: 500000, monthlySavings: 0, totalReturn: 5, withdrawal: { enabled: true, monthlyNet: 2500 } });
    expect(r.withdrawals?.phase?.start_age).toBe(70);
    expect(r.horizon.end_age).toBe(90);
  });

  it('someone older than the default life expectancy gets a longer horizon', () => {
    const r = run({ age: 88, initialCapital: 200000, monthlySavings: 0, totalReturn: 4, withdrawal: { enabled: true, monthlyNet: 1000 } });
    expect(r.horizon.end_age).toBeGreaterThan(88);
  });
});

describe('hosted without storage', () => {
  const stateless = () => new AgentTools(new MemoryPlanStore(), 'https://x.example/', true);

  it('result ids carry the configuration, so another instance can continue', () => {
    const a = stateless().simulate({ changes: { age: 35, initialCapital: 50000, monthlySavings: 1000, totalReturn: 7 } });
    expect(a.result_id.startsWith('x')).toBe(true);
    const b = stateless().simulate({ base: `result:${a.result_id}`, changes: { monthlySavings: 1500 } });
    expect(Object.keys(b.changed)).toEqual(['monthlySavings']);
    expect(b.horizon.end_age).toBe(a.horizon.end_age);
  });

  it('takes a plan straight from an app link', () => {
    const t = stateless();
    const a = t.simulate({ changes: { age: 40, initialCapital: 80000, monthlySavings: 700 } });
    expect(t.simulate({ base: `link:${a.app_link}` }).end.value).toBe(a.end.value);
    expect(() => t.simulate({ base: 'link:https://x.example/#s=kaputt' })).toThrow(InputError);
  });

  it('compares buying and renting, with tipping points and a link back to the app', () => {
    const t = fresh();
    const a = t.buyVsRent({ changes: { price: 350000, rent: 1300, equity: 80000, interest: 3.5, totalReturn: 6, state: 'NW' } }) as Record<string, any>;
    expect(a.notes).toEqual([]);
    expect(a.purchase_costs.transfer_tax_rate).toBe(6.5);
    expect(a.config.invest.totalReturn).toBe(6);
    expect(a.tipping_points.length).toBeGreaterThan(4);
    expect(a.app_link).toMatch(/^http:\/\/app\/kaufen-mieten#k=/);
    const b = t.buyVsRent({ link: a.app_link }) as Record<string, any>;
    expect(b.wealth_buy).toBe(a.wealth_buy);
    expect(b.wealth_rent).toBe(a.wealth_rent);
  });

  it('names assumed values, corrected values and unknown fields', () => {
    const t = fresh();
    const r = t.buyVsRent({ changes: { price: 300000, repayment: 99 }, tipping_points: false }) as Record<string, any>;
    expect(r.notes.join(' ')).toMatch(/rent = 1200/);
    expect(r.notes.join(' ')).toMatch(/repayment: 99 ist nicht möglich/);
    expect(r.tipping_points).toBeUndefined();
    expect(() => t.buyVsRent({ changes: { kaufpreis: 1 } })).toThrow(/Unbekannte Felder/);
  });

  it('runs buy-vs-rent scenarios side by side', () => {
    const r = fresh().buyVsRent({ changes: { price: 400000, rent: 1200, equity: 100000, interest: 4 }, scenarios: [{ name: 'Basis' }, { name: 'Hohe Miete', changes: { rent: 2000 } }] }) as Record<string, any>;
    expect(r.scenarios).toHaveLength(2);
    expect(r.scenarios[1].wealth_rent).toBeLessThan(r.scenarios[0].wealth_rent);
  });
});
