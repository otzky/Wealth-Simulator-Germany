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
- **Monte Carlo (optional)**: spielt den Plan mit allen Ereignissen tausendfach mit zufälligen Renditen durch – eigener Tab mit Erfolgswahrscheinlichkeit, Chart aller Verläufe, Bandbreite, Verteilung des Endvermögens, Quote je Entnahme und sicherer Entnahme für eine gewünschte Sicherheit
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
- **Monte Carlo** (Schalter unter „Markt“, Ergebnisse im Tab „Monte Carlo“; der Plan bleibt unverändert)
  - *Renditen*: Monat für Monat unabhängig und lognormal verteilt. Der Median wächst mit der eingetragenen Gesamtrendite – so wie Index-Renditen angegeben werden (z. B. MSCI World etwa 7 % p. a.). Der typische Verlauf liegt damit auf der Plan-Linie, die Hälfte der Verläufe endet darüber. Der Durchschnitt aller Verläufe liegt höher (bei 7 % und 15 % Volatilität bei etwa 8 % p. a.).
  - *Volatilität*: Standardabweichung der Jahresrenditen; Standard 15 % für einen breit gestreuten Aktien-ETF. Inflation, Ausschüttungsquote, Kosten, Steuern und Ereignisse bleiben wie im Plan.
  - *Verläufe*: 1.000 (Erfolgsquote etwa ± 1,5 Prozentpunkte genau) oder 5.000 (etwa ± 0,7). Die Zufallszahlen hängen an einem gespeicherten Startwert: Gleiche Einstellungen ergeben gleiche Ergebnisse, „Neu würfeln“ zieht neue. Gerechnet wird in einem Web Worker, die Seite bleibt bedienbar.
  - *Erfolg*: Mit Entnahmen (Entnahmephase oder Ereignisse) zählt ein Verlauf als Erfolg, wenn jede Entnahme voll ausgezahlt wird und – bei „Berechnen“ – das gewünschte Restvermögen übrig bleibt. Ohne Entnahmen zählt, ob das Depot nach Verkauf und Steuern mehr wert ist als die Einzahlungen. Ist ein Ziel gesetzt, wird zusätzlich gezeigt, wie oft es erreicht wird. Weil schon ein um wenige Euro verfehltes Restvermögen als nicht aufgegangen zählt, schlüsselt der Tab bei „Berechnen“ zusätzlich auf: Restvermögen erreicht, knapp verfehlt (ab 75 % des Ziels), deutlich darunter, Entnahme ausgefallen – und nennt den Betrag, der in 90 % der Verläufe mindestens übrig bleibt.
  - *„Berechnen“*: Die Entnahme wird einmal ohne Schwankungen berechnet und dann in allen Verläufen festgehalten. Sie geht deshalb nur in etwa der Hälfte der Verläufe auf.
  - *Sichere Entnahme*: der höchste Netto-Betrag pro Monat für die Entnahmephase, bei dem der Plan in mindestens 80, 90 oder 95 % der Verläufe aufgeht (Bisektion auf 1 € genau, höchstens 1.000 Verläufe, auf Knopfdruck). Kann als fester Betrag übernommen werden.
  - *Grenzen*: Echte Märkte haben häufiger heftige Crashs und Phasen mit mehreren schlechten Jahren in Folge; die Ergebnisse hängen stark von Rendite und Volatilität ab.
- **Nicht abgebildet**: schwankende Inflation, Crashs als einzelnes Ereignis, andere Einkünfte (Rente, bAV), Günstigerprüfung, Änderungen der Steuergesetze.

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
  lib/montecarlo.ts   Monte Carlo: Verläufe, Auswertung, sichere Entnahme
  lib/mc.worker.ts    Web Worker für Monte Carlo
  lib/random.ts       Zufallszahlen mit Startwert
  lib/storage.ts      Speichern, Teilen-Links
  lib/export.ts       PDF/PNG/CSV
  components/         Oberfläche (Einstellungen, Ergebnisse, Charts, Monte-Carlo-Tab)
```

## Hinweis

Modellrechnung mit konstanten Annahmen, keine Anlage- oder Steuerberatung.
