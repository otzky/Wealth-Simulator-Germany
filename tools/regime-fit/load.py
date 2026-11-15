import csv, numpy as np, sys
def load(path):
    rows = list(csv.reader(open(path, encoding='utf-8-sig')))[1:]
    dates = [r[0] for r in rows]; v = np.array([float(r[1]) for r in rows])
    return dates, v
if __name__ == '__main__':
    d, v = load(sys.argv[1])
    r = np.diff(np.log(v))
    n = len(r)
    # check monthly continuity
    def ym(s): m, y = s.split('.'); return int(y)*12 + int(m)
    gaps = [(d[i], d[i+1]) for i in range(len(d)-1) if ym(d[i+1]) - ym(d[i]) != 1]
    print('months', n, 'from', d[0], 'to', d[-1], 'gaps', gaps)
    yrs = n/12
    print('CAGR %.2f%%' % ((v[-1]/v[0])**(1/yrs)*100-100))
    print('mean log/month %.4f  sd %.4f  -> annualised sd %.2f%%' % (r.mean(), r.std(ddof=1), r.std(ddof=1)*np.sqrt(12)*100))
    # yearly returns (Dec to Dec)
    dec = [i for i, s in enumerate(d) if s.startswith('12.')]
    yr = [(d[dec[k+1]][3:], v[dec[k+1]]/v[dec[k]]-1) for k in range(len(dec)-1)]
    ys = np.array([x[1] for x in yr])
    print('years', len(ys), 'sd yearly %.2f%%' % (ys.std(ddof=1)*100), 'mean %.2f%%' % (ys.mean()*100))
    print('worst years', sorted(yr, key=lambda x: x[1])[:6])
    print('best years', sorted(yr, key=lambda x: -x[1])[:4])
    print('worst months', sorted(zip(d[1:], r), key=lambda x: x[1])[:6])
    # max drawdown
    peak = np.maximum.accumulate(v); dd = v/peak-1; i = dd.argmin(); j = v[:i+1].argmax()
    print('max drawdown %.1f%% from %s to %s' % (dd[i]*100, d[j], d[i]))
    # skew/kurt
    from scipy import stats
    print('skew %.2f excess kurtosis %.2f' % (stats.skew(r), stats.kurtosis(r)))
    # suspicious jumps: steps in fractional pattern
    print('first rows', d[:3], v[:3])
