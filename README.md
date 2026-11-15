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
- **Leitplanken** (optional, nach Guyton-Klinger, im Tab „Monte Carlo“): die Entnahme passt sich an die Märkte an – nur Kürzung in schlechten Phasen oder zusätzlich Erhöhung in guten, mit Mindestbetrag; Auswertung in Jahren unter Plan und benötigtem Puffer; Vergleich mit und ohne Leitplanken auf denselben Verläufen
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
  - *Renditen – Regime-Modell*: Der Markt wechselt zufällig zwischen einem ruhigen Regime und einem Krisen-Regime (Regime-Switching-Lognormal-Modell mit zwei Regimes nach Hardy 2001). In jedem Monat wird die Rendite aus der Verteilung des aktuellen Regimes gezogen, danach wechselt das Regime mit fester Wahrscheinlichkeit. Geschätzt per Maximum Likelihood auf den MSCI World Net Total Return in Euro, 12/1969–08/2026 (680 Monatsrenditen; Parameter in `src/lib/regimes.ts`, Skripte zum Nachrechnen in `tools/regime-fit/`):

    | | Ruhig | Krise |
    |---|---|---|
    | Mittlere Log-Rendite pro Monat | +1,63 % | −2,17 % |
    | Volatilität pro Monat | 3,16 % | 5,64 % |
    | Wechsel pro Monat | 5,9 % (Dauer im Mittel rund 17 Monate) | 18,0 % (rund 5,5 Monate) |
    | Anteil der Zeit | 75 % | 25 % |

    In 1.500 simulierten Geschichten gleicher Länge erzeugt das Modell das schlechteste Jahr, den größten Rückgang, die längste Zeit unter dem alten Höchststand, die Schwankung der Kalenderjahre, die Schiefe der Monatsrenditen und die Spannweite der 10- und 20-Jahres-Renditen des Index realistisch – ein einfaches lognormales Modell nicht (es kennt z. B. praktisch keine Jahre unter −25 %, der Index hatte fünf). Über 30 Jahre streut das Modell etwas breiter als die Geschichte, ist dort also eher vorsichtig. Ein drittes Regime (etwa „seitwärts“) ist in den Daten nicht erkennbar; lange Seitwärtsphasen entstehen aus dem Wechsel von Krisen und Erholungen. Zum Vergleich: Hardy fand für den S&P 500 1956–1999 ein kürzeres, aber heftigeres Krisen-Regime.
  - *Rendite und Volatilität*: Die Form des Modells (Wechsel, relative Lage und Schwankung der Regimes) bleibt fest, Niveau und Stärke kommen aus den Eingaben unter „Markt“. Im Durchschnitt (geometrisch) wachsen die Verläufe mit der eingetragenen Gesamtrendite – so, wie Index-Renditen über die Geschichte berechnet werden (MSCI World etwa 7–8 % p. a.). Weil Krisen große Verluste wahrscheinlicher machen als große Gewinne, liegt der Median etwas über der Plan-Linie. Die Volatilität ist die aus Monatsrenditen hochgerechnete Schwankung, wie Factsheets sie angeben (MSCI World etwa 15 %); ganze Kalenderjahre schwanken im Modell dann wie beim Index stärker (rund 19 %). Inflation, Ausschüttungsquote, Kosten, Steuern und Ereignisse bleiben wie im Plan.
  - *Verläufe*: 1.000 (Erfolgsquote etwa ± 1,5 Prozentpunkte genau) oder 5.000 (etwa ± 0,7). Die Zufallszahlen hängen an einem gespeicherten Startwert: Gleiche Einstellungen ergeben gleiche Ergebnisse, „Neu würfeln“ zieht neue. Gerechnet wird in einem Web Worker, die Seite bleibt bedienbar.
  - *Erfolg*: Mit Entnahmen (Entnahmephase oder Ereignisse) zählt ein Verlauf als Erfolg, wenn jede Entnahme voll ausgezahlt wird und – bei „Berechnen“ – das gewünschte Restvermögen übrig bleibt. Ohne Entnahmen zählt, ob das Depot nach Verkauf und Steuern mehr wert ist als die Einzahlungen. Ist ein Ziel gesetzt, wird zusätzlich gezeigt, wie oft es erreicht wird. Weil schon ein um wenige Euro verfehltes Restvermögen als nicht aufgegangen zählt, schlüsselt der Tab bei „Berechnen“ zusätzlich auf: Restvermögen erreicht, knapp verfehlt (ab 75 % des Ziels), deutlich darunter, Entnahme ausgefallen – und nennt den Betrag, der in 90 % der Verläufe mindestens übrig bleibt.
  - *„Berechnen“*: Die Entnahme wird einmal ohne Schwankungen berechnet und dann in allen Verläufen festgehalten. Sie geht deshalb nur in etwa der Hälfte der Verläufe auf.
  - *Leitplanken* (im Tab „Monte Carlo“, bei festem oder berechnetem Betrag; sie wirken nur mit schwankenden Renditen und stehen deshalb dort): Jeden Januar ab dem zweiten Entnahmejahr wird geprüft, ob das Depot den geplanten Betrag bis zum Ende noch tragen kann. Tragfähig ist der Betrag, den der aktuelle Depotwert bei erwarteter Rendite nach TER bis zum Ende zahlen kann – mit jährlicher Inflationsanpassung, wenn eingestellt, nach Steuern (Steueranteil der Verkäufe aus dem Plan) und so, dass das gewünschte Restvermögen übrig bleibt (Rentenformel). Liegt der geplante Betrag um mehr als den Auslöser (Standard 20 %) darüber, wird er um die Kürzung (Standard 10 %) gesenkt; die Kürzung gilt mindestens das ganze Jahr. Nach einem Jahr mit Verlust (Kurs plus Ausschüttungen) entfällt der Inflationsausgleich. Ein Mindestbetrag wird nie unterschritten. Ein kleiner Betrag wird so selten gekürzt, ein knapp kalkulierter häufiger. Zwei Varianten:
    - *Nur kürzen, sonst nach Plan* (Standard): In guten Jahren wird nie mehr als geplant ausgezahlt, das Plus bleibt im Depot. Nach einer Kürzung gilt wieder der volle Plan-Betrag, sobald er höchstens halb so weit über dem tragfähigen Betrag liegt wie der Auslöser (bei 20 % also höchstens 10 %). Der Abstand zum Auslöser verhindert ein Hin- und Herspringen.
    - *Kürzen und erhöhen* (Guyton-Klinger): Liegt der Betrag um mehr als den Auslöser unter dem tragfähigen, wird um denselben Prozentsatz erhöht. Eine Kürzung bleibt bestehen, bis eine Erhöhung ausgelöst wird.
    - Abweichung vom Original: Guyton und Klinger vergleichen die Entnahmerate mit der Rate zu Beginn. Bei einem Plan, der das Depot bis zu einem Alter abbaut, steigt diese Rate aber von selbst; der Vergleich mit dem tragfähigen Betrag berücksichtigt die Restlaufzeit. Im Plan selbst greifen die Leitplanken nie, und auch in der Simulation ohne Schwankungen bleibt ein berechneter Betrag unverändert.
    - Typisch für Pläne, die das Depot abbauen: Gerät ein Verlauf früh ins Minus, holt er das selten wieder auf – die Jahre unter Plan verteilen sich daher meist auf „nie“ oder „über 10 Jahre“.
    - Auswertung: Kürzungen zählen nicht als Scheitern. Die Erfolgsquote wird aufgeteilt in „immer nach Plan“, „zeitweise unter Plan“ und „gescheitert“, zusammen mit der Quote derselben Verläufe ohne Leitplanken. Dazu: Verteilung der Jahre unter Plan (nie, 1–2, 3–5, 6–10, über 10), höchstens so viele Jahre unter Plan und am Stück in 90 % der Verläufe, Tiefststand und der Puffer, der in 90 % der Verläufe alle Kürzungen ausgleicht (Summe aus geplant minus gezahlt, in Euro des Entnahmebeginns, ohne Zinsen).
  - *Sichere Entnahme*: der höchste Netto-Betrag pro Monat für die Entnahmephase, bei dem der Plan in mindestens 80, 90 oder 95 % der Verläufe aufgeht (mit Leitplanken als Startbetrag, zusammen mit dem Tiefststand in den schlechtesten 10 %) (Bisektion auf 1 € genau, höchstens 1.000 Verläufe, auf Knopfdruck). Kann als fester Betrag übernommen werden.
  - *Grenzen*: Die Parameter stammen aus gut 56 Jahren eines Index; schwankende Inflation und eine langfristige Rückkehr zum Mittel sind nicht abgebildet. Die Ergebnisse hängen stark von Rendite und Volatilität ab.
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
  lib/regimes.ts      Regime-Modell der Renditen (geschätzte Parameter)
  lib/mc.worker.ts    Web Worker für Monte Carlo
  lib/random.ts       Zufallszahlen mit Startwert
  lib/storage.ts      Speichern, Teilen-Links
  lib/export.ts       PDF/PNG/CSV
  components/         Oberfläche (Einstellungen, Ergebnisse, Charts, Monte-Carlo-Tab)
```

## Hinweis

Modellrechnung mit konstanten Annahmen, keine Anlage- oder Steuerberatung.
