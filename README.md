# Vermögens-Simulator

Interaktiver Rechner für den langfristigen Vermögensaufbau mit ETFs – inklusive Dividenden, Inflation und deutscher Abgeltungsteuer. Läuft komplett im Browser, ohne Server und ohne Tracking.

## Funktionen

- **Sparplan** mit Startkapital, monatlicher Rate und jährlicher Dynamik
- **Ereignisse**: alles, was vom gleichmäßigen Sparplan abweicht, an einer Stelle – Sparrate ändern, Einmalzahlungen (z. B. Erbschaft), einmalige Entnahmen (z. B. Eigenkapital für eine Immobilie) und befristete monatliche Entnahmen (z. B. Teilzeit oder Sabbatical); einmalige Beträge werden im Vermögens-Chart markiert
- **Laufzeit** als feste Anzahl Jahre oder bis zu einem Zielalter (monatsgenau, kalenderjahrbasiert)
- **Markt**: Gesamtrendite, Ausschüttungsquote, Reinvestition, Inflation und eine Bandbreite (pessimistisch/optimistisch)
- **Kosten**: Kaufgebühren und laufende Kosten (TER)
- **Steuern (DE)**: Abgeltungsteuer, Soli, Kirchensteuer (korrekt mit Sonderausgabenabzug), Sparerpauschbetrag, Teilfreistellung nach Fondsart, Vorabpauschale und Verkäufe nach FIFO
- **Ausschüttungen**: reinvestieren, auszahlen oder ab einem Jahr bzw. ab Entnahmebeginn auf Auszahlung umstellen
- **Entnahmephase**: fester Netto-Betrag oder Entnahmerate (z. B. 4 %-Regel), optional inflationsangepasst; ausgezahlte Dividenden können auf den Betrag angerechnet werden; Steuern auf Verkäufe, Reichweite des Depots, frei gewordene Sparrate
- **Entnahme berechnen**: aus Lebenserwartung und gewünschtem Restvermögen (z. B. zum Vererben) die mögliche monatliche Entnahme ermitteln
- **Zielrechner**: benötigte Sparrate, Startkapital oder Rendite für ein Zielvermögen und/oder eine Netto-Dividende pro Monat
- **Auswertung**: nominal oder in heutiger Kaufkraft, Charts, Bilanz mit fiktivem Verkauf, Jahrestabelle
- **Teilen & Export**: Link mit allen Einstellungen, PDF, PNG und CSV
- Einstellungen werden automatisch lokal gespeichert, helles und dunkles Design

## So wird gerechnet

Die Simulation läuft monatlich mit konstanten Annahmen. Ein paar Regeln, die man kennen sollte:

- **Ereignisse**
  - *Sparrate ändern*: Ab Januar des gewählten Jahres gilt die neue Rate; die jährliche Erhöhung startet von dort neu.
  - *Einmalzahlungen* und *einmalige Entnahmen* finden im Januar des Jahres statt.
  - *Einmalige Entnahmen* sind Netto-Beträge: So viel kommt auf dem Konto an. Verkauft wird entsprechend mehr, weil der Gewinn der verkauften Anteile versteuert wird.
  - *Befristete Entnahmen* laufen von Januar des ersten bis Dezember des letzten Jahres, als Netto-Betrag pro Monat in Euro des Startjahres, optional jährlich an die Inflation angepasst. Die Sparrate läuft währenddessen weiter. Mehrere Zeiträume dürfen sich überschneiden und addieren sich – auch mit der Entnahmephase.
  - Reicht das Depot für eine Entnahme nicht, wird ausgezahlt, was vorhanden ist, und die Auswertung zeigt einen Hinweis mit dem fehlenden Betrag.
- **Entnahmephase** (Abschnitt „Entnahme“): die dauerhafte Entnahme ab einem Jahr bis zum Ende der Simulation – als fester Netto-Betrag, als Entnahmerate oder berechnet aus Lebenserwartung und gewünschtem Restvermögen. Die Kennzahlen der Karte „Entnahmephase“ beziehen sich nur auf diese Phase; „Ausgezahlt“ und die Bilanz enthalten alle Entnahmen.
- **Steuer bei Verkäufen (FIFO)**: Das Depot wird in Monats-Tranchen geführt. Bei jedem Verkauf gelten die ältesten Anteile als zuerst verkauft, wie bei deutschen Depotbanken. Versteuert wird der Gewinn genau dieser Anteile, nach Teilfreistellung und restlichem Sparerpauschbetrag. Weil alte Anteile meist den höchsten Gewinn tragen, fällt zu Beginn einer Entnahme mehr Steuer an als später. Verluste einzelner Tranchen werden innerhalb eines Verkaufs verrechnet; ein Verlustvortrag wird nicht geführt.
- **Vorabpauschale**: erhöht die Anschaffungskosten aller Anteile, damit sie beim Verkauf nicht doppelt besteuert wird. Die Steuer darauf wird anteilig aus dem Depot entnommen.
- **Nicht abgebildet**: schwankende Renditen, andere Einkünfte (Rente, bAV), Günstigerprüfung, Änderungen der Steuergesetze.

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
  lib/simulation.ts   Rechenkern (monatliche Simulation, Ereignisse, Steuern, FIFO)
  lib/goal.ts         Zielrechner (Bisektion)
  lib/storage.ts      Speichern, Teilen-Links
  lib/export.ts       PDF/PNG/CSV
  components/         Oberfläche (Einstellungen, Ergebnisse, Charts)
```

## Hinweis

Modellrechnung mit konstanten Annahmen, keine Anlage- oder Steuerberatung.
