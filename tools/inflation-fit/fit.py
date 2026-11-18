import csv, sys, numpy as np
y, p = zip(*[(int(r['year']), float(r['inflation'])) for r in csv.DictReader(open('cpi.csv'))])
y = np.array(y); p = np.array(p)
print('n', len(p), 'mean %.2f sd %.2f min %.1f max %.1f' % (p.mean(), p.std(ddof=1), p.min(), p.max()))
# AR(1) by OLS
X = np.c_[np.ones(len(p)-1), p[:-1]]; b, *_ = np.linalg.lstsq(X, p[1:], rcond=None)
res = p[1:] - X @ b; phi = b[1]; mu = b[0]/(1-phi); se = res.std(ddof=2)
cov = se**2 * np.linalg.inv(X.T @ X)
print('AR1 phi %.3f (±%.3f) mu %.2f sigma_eps %.2f  stationary sd %.2f' % (phi, np.sqrt(cov[1,1]), mu, se, se/np.sqrt(1-phi**2)))
# half-life
print('half-life years %.1f' % (np.log(.5)/np.log(phi)))
# sub-period check
for a, z in [(1970, 1997), (1998, 2025)]:
    m = (y >= a) & (y <= z); q = p[m]
    Xs = np.c_[np.ones(len(q)-1), q[:-1]]; bs, *_ = np.linalg.lstsq(Xs, q[1:], rcond=None); r = q[1:] - Xs @ bs
    print(a, z, 'phi %.2f sigma %.2f mean %.2f' % (bs[1], r.std(ddof=2), q.mean()))
# MSCI calendar-year log returns
rows = list(csv.reader(open('sys.argv[1]', encoding='utf-8-sig')))[1:]
d = [r[0] for r in rows]; v = np.array([float(r[1]) for r in rows])
dec = {int(s[3:]): v[i] for i, s in enumerate(d) if s.startswith('12.')}
ret = {yy: np.log(dec[yy]/dec[yy-1]) for yy in dec if yy-1 in dec}
common = [yy for yy in y[1:] if yy in ret]
e = {yy: res[list(y[1:]).index(yy)] for yy in common}
R = np.array([ret[yy] for yy in common]); E = np.array([e[yy] for yy in common])
print('years with both', len(common), common[0], common[-1])
print('corr(innovation, same-year return) %.2f' % np.corrcoef(E, R)[0,1])
Rn = np.array([ret[yy+1] for yy in common if yy+1 in ret]); En = np.array([e[yy] for yy in common if yy+1 in ret])
print('corr(innovation, next-year return) %.2f' % np.corrcoef(En, Rn)[0,1])
Rp = np.array([ret[yy-1] for yy in common if yy-1 in ret]); Ep = np.array([e[yy] for yy in common if yy-1 in ret])
print('corr(innovation, previous-year return) %.2f' % np.corrcoef(Ep, Rp)[0,1])
lvl = np.array([p[list(y).index(yy)] for yy in common])
print('corr(level, same-year return) %.2f' % np.corrcoef(lvl, R)[0,1])
# real return check
print('real return sd: nominal sd %.3f, real sd %.3f' % (R.std(ddof=1), (R - np.log1p(lvl/100)).std(ddof=1)))
