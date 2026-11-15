# Schätzung der Regime-Parameter

Mit diesen Skripten wurden die Parameter in `src/lib/regimes.ts` geschätzt. Die Indexdaten selbst liegen nicht im Repo (Lizenz); benötigt wird eine CSV mit Monatsendwerten im Format

```
Datum,MSCI World
12.1969,10000
01.1970,9445.5
...
```

Verwendet wurde der MSCI World Net Total Return in Euro, 12/1969–08/2026 (Export von curvo.eu).

```
pip install numpy scipy
python3 fit.py daten.csv        # 1-, 2- und 3-Regime-Modelle per EM, Vergleich per AIC/BIC → fit.json
python3 validate.py daten.csv   # Standardfehler und Vergleich echter Kennzahlen mit 1.500 simulierten Geschichten
python3 longrun.py daten.csv    # Spannweite der 10-, 20- und 30-Jahres-Renditen: Daten vs. Modelle
```

Ergebnis (2 Regimes, BIC-optimal): ruhig μ = +1,63 %, σ = 3,16 %, Wechsel 5,9 % pro Monat; Krise μ = −2,17 %, σ = 5,64 %, Wechsel 18,0 % pro Monat.
