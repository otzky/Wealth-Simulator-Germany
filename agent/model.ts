/** How the simulator calculates – shown by `describe` and as an MCP resource. */
export const MODEL_NOTES = `# Vermögens-Simulator: Modell und Annahmen

## Plan (simulate)
- Monatliche Simulation mit konstanter Rendite: Kursrendite = Gesamtrendite − Ausschüttungsrendite; laufende Kosten (TER) monatlich, Kaufkosten je Kauf.
- Deutsche Steuern: Abgeltungsteuer + Soli (+ Kirchensteuer), Sparerpauschbetrag, Teilfreistellung nach Fondsart, Vorabpauschale mit Basiszins.
- Verkäufe nach FIFO: Das Depot wird in Monats-Tranchen geführt, die ältesten Anteile werden zuerst verkauft und deren Gewinn versteuert. Verluste einzelner Tranchen werden innerhalb eines Verkaufs verrechnet, kein Verlustvortrag.
- Ereignisse: Sparrate ändern, Einmalzahlungen und einmalige Entnahmen jeweils im Januar des Jahres; befristete Entnahmen von Januar bis Dezember, netto, optional inflationsangepasst; die Sparrate läuft dabei weiter.
- Entnahmephase: ab Januar des Startjahres bis zum Ende, als fester Netto-Betrag, als Rate vom Depotwert zu Beginn oder berechnet ("target": Betrag, der mit der Lebenserwartung genau das Restvermögen übrig lässt – ohne Marktschwankungen).
- Kaufkraft-Werte ("real") sind mit der eingestellten Inflation auf heute abgezinst.

## Monte Carlo (monte_carlo)
- Renditen folgen einem Regime-Modell mit zwei Regimes (ruhig/Krise), geschätzt per Maximum Likelihood auf den MSCI World Net Total Return in Euro 12/1969–08/2026: ruhig +1,63 %/Monat bei 3,16 % Schwankung, im Mittel rund 17 Monate; Krise −2,17 %/Monat bei 5,64 %, im Mittel rund 5,5 Monate, etwa ein Viertel der Zeit.
- Die Form bleibt fest; die Gesamtrendite bestimmt das durchschnittliche (geometrische) Wachstum, die Volatilität (wie in Factsheets, MSCI World etwa 15 %) skaliert die Schwankung. Kalenderjahre schwanken dann stärker (rund 19 % bei 15 %). Der Median liegt etwas über der Plan-Linie.
- Inflation, Ausschüttungsquote, Kosten, Steuern und Ereignisse bleiben wie im Plan. Ein "berechneter" Betrag wird einmal ohne Schwankungen bestimmt und dann in allen Verläufen festgehalten (geht daher nur in etwa der Hälfte der Fälle auf).
- Erfolg: mit Entnahmen = jede Entnahme voll bezahlt (und ggf. Restvermögen erreicht); ohne Entnahmen = nach Verkauf und Steuern mehr als eingezahlt.
- Leitplanken (optional): jeden Januar Vergleich des geplanten Betrags mit dem, was das Depot bis zum Ende tragen kann; liegt er um mehr als den Auslöser darüber, wird gekürzt. Variante "down": sonst nach Plan, Rückkehr zum vollen Betrag, sobald das Depot ihn wieder trägt; "both": zusätzlich Erhöhungen. Kürzungen zählen nicht als Scheitern.
- Sichere Entnahme: höchster Betrag, bei dem der Plan in mindestens der gewünschten Quote der Verläufe aufgeht.

## Nicht abgebildet
Schwankende Inflation, langfristige Rückkehr zum Mittel, andere Einkünfte (Rente, bAV), Günstigerprüfung, Änderungen der Steuergesetze, Steuern im Erbfall.

## Hinweis
Ergebnisse sind Modellrechnungen auf Basis der Annahmen, keine Anlageberatung und keine Prognose.`;
