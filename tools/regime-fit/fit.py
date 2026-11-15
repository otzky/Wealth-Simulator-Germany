"""Regime-switching lognormal (RSLN) models for monthly log returns, fitted by EM (Baum-Welch)."""
import json, sys
import numpy as np
from scipy.stats import norm
from load import load


def forward_backward(r, mu, sd, P, pi):
    T, K = len(r), len(mu)
    B = norm.pdf(r[:, None], mu[None, :], sd[None, :])
    alpha = np.zeros((T, K)); c = np.zeros(T)
    a = pi * B[0]; c[0] = a.sum(); alpha[0] = a / c[0]
    for t in range(1, T):
        a = (alpha[t - 1] @ P) * B[t]; c[t] = a.sum(); alpha[t] = a / c[t]
    beta = np.ones((T, K))
    for t in range(T - 2, -1, -1):
        beta[t] = (P @ (B[t + 1] * beta[t + 1])) / c[t + 1]
    gamma = alpha * beta
    xi = np.zeros((K, K))
    for t in range(T - 1):
        x = alpha[t][:, None] * P * (B[t + 1] * beta[t + 1])[None, :] / c[t + 1]
        xi += x
    return np.log(c).sum(), gamma, xi


def stationary(P):
    w, v = np.linalg.eig(P.T)
    s = np.real(v[:, np.argmin(abs(w - 1))]); return s / s.sum()


def fit(r, K, seed, iters=2000):
    rng = np.random.default_rng(seed)
    q = np.sort(rng.choice(r, K, replace=False))
    mu = q.copy(); sd = np.full(K, r.std()) * rng.uniform(0.5, 1.5, K)
    P = np.full((K, K), 0.05 / max(1, K - 1)); np.fill_diagonal(P, 0.95)
    pi = np.full(K, 1 / K)
    ll_old = -np.inf
    for _ in range(iters):
        ll, g, xi = forward_backward(r, mu, sd, P, pi)
        w = g.sum(0)
        mu = (g * r[:, None]).sum(0) / w
        sd = np.sqrt((g * (r[:, None] - mu) ** 2).sum(0) / w)
        sd = np.maximum(sd, 0.004)
        P = xi / xi.sum(1, keepdims=True)
        pi = stationary(P)  # start from the long-run distribution
        if ll - ll_old < 1e-9: break
        ll_old = ll
    o = np.argsort(-mu / sd)  # order: calm/good first
    return dict(ll=ll, mu=mu[o], sd=sd[o], P=P[np.ix_(o, o)], gamma=g[:, o])


def best(r, K, n=60):
    fits = [fit(r, K, s) for s in range(n)]
    return max(fits, key=lambda f: f['ll'])


if __name__ == '__main__':
    d, v = load(sys.argv[1])
    r = np.diff(np.log(v))
    T = len(r)
    out = {}
    # one regime = plain lognormal
    ll1 = norm.logpdf(r, r.mean(), r.std()).sum()
    print(f'K=1  ll={ll1:.1f}  params=2  BIC={-2*ll1+2*np.log(T):.1f}  AIC={-2*ll1+4:.1f}')
    for K in (2, 3):
        f = best(r, K)
        k = K * 2 + K * (K - 1)
        print(f"K={K}  ll={f['ll']:.1f}  params={k}  BIC={-2*f['ll']+k*np.log(T):.1f}  AIC={-2*f['ll']+2*k:.1f}")
        s = stationary(f['P'])
        for i in range(K):
            dur = 1 / (1 - f['P'][i, i])
            print(f"   regime {i+1}: mu={f['mu'][i]:+.4f}/mo ({f['mu'][i]*12*100:+.1f}%/yr)  sd={f['sd'][i]:.4f}/mo ({f['sd'][i]*np.sqrt(12)*100:.1f}%/yr)"
                  f"  stay={f['P'][i,i]:.4f}  avg duration={dur:.1f} mo  share={s[i]*100:.0f}%")
        print('   P=', np.round(f['P'], 4).tolist())
        out[K] = dict(ll=f['ll'], mu=f['mu'].tolist(), sd=f['sd'].tolist(), P=f['P'].tolist(), stationary=s.tolist())
        np.save(f'gamma{K}.npy', f['gamma'])
    # Hardy S&P 500 1956-99 (RSLN-2) evaluated on this data
    hm = np.array([0.0126, -0.0185]); hs = np.array([0.0350, 0.0748])
    hP = np.array([[1 - 0.0398, 0.0398], [0.3798, 1 - 0.3798]])
    llh, _, _ = forward_backward(r, hm, hs, hP, stationary(hP))
    print(f'Hardy S&P RSLN-2 on MSCI data: ll={llh:.1f}')
    out['hardy_ll_on_msci'] = llh
    out['lognormal_ll'] = ll1
    json.dump(out, open('fit.json', 'w'), indent=1)
