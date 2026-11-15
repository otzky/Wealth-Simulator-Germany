import sys, json, numpy as np
from load import load
d, v = load(sys.argv[1]); r = np.diff(np.log(v)); T = len(r)
f = json.load(open('fit.json'))['2']; mu = np.array(f['mu']); sd = np.array(f['sd']); P = np.array(f['P'])
share = np.array([P[1,0], P[0,1]]) / (P[0,1] + P[1,0])
rng = np.random.default_rng(5)
def sim(n_paths, length, model):
    out = np.empty((n_paths, length))
    if model == 'rsln':
        s = (rng.random(n_paths) >= share[0]).astype(int)
        for t in range(length):
            out[:, t] = rng.normal(mu[s], sd[s])
            sw = rng.random(n_paths) < np.where(s == 0, P[0,1], P[1,0]); s = np.where(sw, 1 - s, s)
    else:
        out = rng.normal(r.mean(), r.std(), (n_paths, length))
    return out
def roll(x, w):  # rolling w-year annualised log growth
    c = np.concatenate([[0], np.cumsum(x)]); return (c[w*12:] - c[:-w*12]) / w
print('Rolling windows, annualised return (CAGR) in the real data vs. 2.000 simulated 56-year histories')
for w in (10, 20, 30):
    h = np.exp(roll(r, w)) - 1
    sims = sim(2000, T, 'rsln'); simsl = sim(2000, T, 'ln')
    lo = np.array([np.exp(roll(x, w)).min() - 1 for x in sims]); hi = np.array([np.exp(roll(x, w)).max() - 1 for x in sims])
    lol = np.array([np.exp(roll(x, w)).min() - 1 for x in simsl]); hil = np.array([np.exp(roll(x, w)).max() - 1 for x in simsl])
    print(f'{w}y: real min {h.min()*100:5.1f}% max {h.max()*100:5.1f}% | regime: min median {np.median(lo)*100:5.1f}% (real at pct {np.mean(lo < h.min())*100:3.0f}), max median {np.median(hi)*100:5.1f}% (pct {np.mean(hi < h.max())*100:3.0f}) | lognormal: min median {np.median(lol)*100:5.1f}% (pct {np.mean(lol < h.min())*100:3.0f}), max median {np.median(hil)*100:5.1f}% (pct {np.mean(hil < h.max())*100:3.0f})')
# dispersion across paths after 38 years
for name in ('rsln', 'ln'):
    x = sim(20000, 38*12, name).sum(1)
    print(name, '38y: sd of log %.2f, p10/median factor %.2f' % (x.std(), np.exp(np.quantile(x, .1) - np.median(x))))
