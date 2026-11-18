# Inflationsmodell schätzen

`cpi.csv`: Inflationsrate in Deutschland (Veränderung des Verbraucherpreisindex gegenüber dem Vorjahr, Jahresdurchschnitt, Destatis; bis 1991 früheres Bundesgebiet), 1970–2025.

```bash
python3 fit.py <MSCI-World-EUR-Monatswerte.csv>
```

Schätzt ein AR(1)-Modell per kleinster Quadrate (Persistenz φ, Schwankung σ der Überraschungen, Halbwertszeit), prüft beide Hälften des Zeitraums getrennt und berechnet die Korrelation der Überraschungen mit der Kalenderjahresrendite des MSCI World (gleiche Datei wie unter `tools/regime-fit/`). Ergebnis 1970–2025: φ 0,784 (± 0,085), σ 1,21 Prozentpunkte, Korrelation mit der Rendite desselben Jahres −0,22. Die Werte stehen in `src/lib/inflation.ts`.
