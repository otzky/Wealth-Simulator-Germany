import sys, json, numpy as np
from scipy.stats import norm, skew, kurtosis
from load import load
from fit import forward_backward, stationary
d, v = load(sys.argv[1]); r = np.diff(np.log(v)); T = len(r)
fj = json.load(open('fit.json'))
m2 = fj['2']
mu = np.array(m2['mu']); sd = np.array(m2['sd']); P = np.array(m2['P'])

# --- standard errors from the numerical Hessian (mu, log sd, logit of switching probability)
def unpack(th):
    mu = th[0:2]; sd = np.exp(th[2:4]); p12, p21 = 1/(1+np.exp(-th[4])), 1/(1+np.exp(-th[5]))
    P = np.array([[1-p12, p12], [p21, 1-p21]]); return mu, sd, P
def ll(th):
    mu, sd, P = unpack(th); return forward_backward(r, mu, sd, P, stationary(P))[0]
th = np.array([mu[0], mu[1], np.log(sd[0]), np.log(sd[1]), np.log(P[0,1]/(1-P[0,1])), np.log(P[1,0]/(1-P[1,0]))])
h = 1e-4; n = 6; H = np.zeros((n, n))
for i in range(n):
    for j in range(n):
        e = np.zeros(n); f = np.zeros(n); e[i] = h; f[j] = h
        H[i, j] = (ll(th+e+f) - ll(th+e-f) - ll(th-e+f) + ll(th-e-f)) / (4*h*h)
cov = np.linalg.inv(-H); se = np.sqrt(np.diag(cov))
# delta method back to natural units
se_sd = sd * se[2:4]; p = np.array([P[0,1], P[1,0]]); se_p = p*(1-p)*se[4:6]
print('2-regime estimates (standard error):')
print('  calm  mu %.4f (%.4f)  sd %.4f (%.4f)  p12 %.4f (%.4f)' % (mu[0], se[0], sd[0], se_sd[0], p[0], se_p[0]))
print('  crisis mu %.4f (%.4f)  sd %.4f (%.4f)  p21 %.4f (%.4f)' % (mu[1], se[1], sd[1], se_sd[1], p[1], se_p[1]))
print('Hardy S&P 1956-99: calm mu .0126 (.002) sd .0350 (.001) p12 .0398 (.015) | crisis mu -.0185 (.014) sd .0748 (.009) p21 .3798 (.123)')

# --- simulation check: does the model reproduce the history?
def stats(x):  # x: monthly log returns
    lv = np.concatenate([[0], np.cumsum(x)])
    peak = np.maximum.accumulate(lv); dd = np.exp(lv - peak) - 1
    under = 0; longest = 0
    for k in range(len(lv)):
        under = under + 1 if lv[k] < peak[k] - 1e-12 else 0; longest = max(longest, under)
    yr = np.exp(np.add.reduceat(x[:len(x)//12*12], np.arange(0, len(x)//12*12, 12))) - 1
    w10 = np.array([x[k:k+120].sum() for k in range(0, len(x)-119)])
    return dict(sd_year=yr.std(ddof=1), worst_year=yr.min(), years_below_m25=(yr < -0.25).sum(), maxdd=dd.min(),
                longest_underwater_mo=longest, share_10y_below_3pct=(np.exp(w10/10) - 1 < 0.03).mean(),
                skew=skew(x), kurt=kurtosis(x))
obs = stats(r)
rng = np.random.default_rng(1)
def sim_rsln(mu, sd, P):
    s = rng.choice(2, p=stationary(P)); out = np.empty(T)
    for t in range(T):
        out[t] = rng.normal(mu[s], sd[s]); s = rng.choice(2, p=P[s])
    return out
models = {'lognormal (heute)': lambda: rng.normal(r.mean(), r.std(), T), 'RSLN-2 MSCI': lambda: sim_rsln(mu, sd, P)}
N = 1500
print('\nObserved MSCI World 1970-2026 vs. 1.500 simulated histories of the same length:')
print('%-28s %10s   %-24s %-24s' % ('statistic', 'observed', 'lognormal (today): median [5-95%] / pct', 'RSLN-2: median [5-95%] / pct'))
res = {k: [stats(f()) for _ in range(N)] for k, f in models.items()}
for key in obs:
    line = '%-28s %10.3f' % (key, obs[key])
    for k in models:
        a = np.array([s[key] for s in res[k]])
        line += '   %8.3f [%7.3f,%7.3f] %3.0f%%' % (np.median(a), np.quantile(a, .05), np.quantile(a, .95), (a < obs[key]).mean()*100)
    print(line)
