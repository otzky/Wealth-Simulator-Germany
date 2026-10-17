# Vermögens-Simulator

Interaktiver Rechner für den langfristigen Vermögensaufbau mit ETFs – inklusive Dividenden, Inflation und deutscher Abgeltungsteuer. Läuft komplett im Browser, ohne Server und ohne Tracking.

## Funktionen

- **Sparplan** mit Startkapital, monatlicher Rate, jährlicher Dynamik, geplanten Ratenänderungen und Einmalzahlungen
- **Laufzeit** als feste Anzahl Jahre oder bis zu einem Zielalter (monatsgenau, kalenderjahrbasiert)
- **Markt**: Gesamtrendite, Ausschüttungsquote, Reinvestition, Inflation und eine Bandbreite (pessimistisch/optimistisch)
- **Kosten**: Kaufgebühren und laufende Kosten (TER)
- **Steuern (DE)**: Abgeltungsteuer, Soli, Kirchensteuer (korrekt mit Sonderausgabenabzug), Sparerpauschbetrag, Teilfreistellung nach Fondsart und Vorabpauschale
- **Zielrechner**: benötigte Sparrate, Startkapital oder Rendite für ein Zielvermögen und/oder eine Netto-Dividende pro Monat
- **Auswertung**: nominal oder in heutiger Kaufkraft, Charts, Bilanz mit fiktivem Verkauf, Jahrestabelle
- **Teilen & Export**: Link mit allen Einstellungen, PDF, PNG und CSV
- Einstellungen werden automatisch lokal gespeichert, helles und dunkles Design

## Entwicklung

Voraussetzung: Node.js 20 oder neuer.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Tests der Rechenlogik
npm run build      # Produktions-Build nach dist/
```

## Aufbau

```
src/
  lib/simulation.ts   Rechenkern (monatliche Simulation, Steuern)
  lib/goal.ts         Zielrechner (Bisektion)
  lib/storage.ts      Speichern, Teilen-Links
  lib/export.ts       PDF/PNG/CSV
  components/         Oberfläche (Einstellungen, Ergebnisse, Charts)
```

## Hinweis

Modellrechnung mit konstanten Annahmen, keine Anlage- oder Steuerberatung.
