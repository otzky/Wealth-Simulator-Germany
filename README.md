# Vermögens-Simulator - Germany

Interaktiver Rechner für den langfristigen Vermögensaufbau mit ETFs – inklusive Dividenden, Inflation und deutscher Abgeltungsteuer. Dazu ein zweiter Rechner **Kaufen oder Mieten** (siehe unten). Läuft komplett im Browser, ohne Server und ohne Tracking.

Zwischen den Rechnern wechselt man über den Titel in der Kopfzeile. Jeder Rechner hat seine eigene Adresse (`/` und `/kaufen-mieten`), eigene Szenarien und eigene Teilen-Links.

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
- **Szenarien**: mehrere Sätze von Eingaben unter eigenem Namen, z. B. für sich, die Partnerin oder ein Kind. Jede Änderung wird automatisch im aktiven Szenario gespeichert; über das Menü in der Kopfzeile wechselt man zwischen ihnen, legt neue an (mit Standardwerten oder als Kopie), benennt sie um oder löscht sie – einzeln oder alle auf einmal, etwa bevor jemand anderes den Rechner nutzt. Gespeichert wird nur im Browser (localStorage), nicht auf einem Server; ein anderer Browser oder ein anderes Gerät sieht die Szenarien nicht. Ein geöffneter Teilen-Link wird als neues Szenario angelegt und überschreibt keines der eigenen.
- **Aufbau der Ergebnisse**: oben der Depotwert mit Eingezahlt, Ausgezahlt und Ertrag, darunter direkt die Vermögensentwicklung, dann Entnahmephase, Einkommen, Bilanz (mit Dividenden, Kosten und Steuern) und die Jahresübersicht. Jede Zahl steht nur einmal. Die getroffenen Annahmen erscheinen nicht auf dem Bildschirm (dort stehen sie in den Einstellungen), aber im PDF- und Bild-Export.
- **Einstellungen**: Erklärungen stehen hinter den ⓘ-Symbolen; Seltenes (Startdatum, Bandbreite im Chart) unter „Erweitert“. Zurücksetzen auf Standardwerte gibt es im Szenario-Menü.
- Helles und dunkles Design

## So wird gerechnet

Die Simulation läuft monatlich mit konstanten Annahmen. Ein paar Regeln, die man kennen sollte:

- **Ereignisse**
  - *Sparrate ändern*: Ab Januar des gewählten Jahres gilt die neue Rate; die jährliche Erhöhung startet von dort neu.
  - *Einmalzahlungen* und *einmalige Entnahmen* finden im Januar des Jahres statt.
  - *Einmalige Entnahmen* sind Netto-Beträge: So viel kommt auf dem Konto an. Verkauft wird entsprechend mehr, weil der Gewinn der verkauften Anteile versteuert wird.
  - *Befristete Entnahmen* laufen von Januar des ersten bis Dezember des letzten Jahres, als Netto-Betrag pro Monat in Euro des Startjahres, optional jährlich an die Inflation angepasst. Die Sparrate läuft währenddessen weiter. Mehrere Zeiträume dürfen sich überschneiden und addieren sich – auch mit der Entnahmephase.
  - Reicht das Depot für eine Entnahme nicht, wird ausgezahlt, was vorhanden ist, und die Auswertung zeigt einen Hinweis mit dem fehlenden Betrag.
- **Entnahmephase** (Abschnitt „Entnahme“): die dauerhafte Entnahme ab einem Jahr bis zum Ende der Simulation – als fester Netto-Betrag, als Entnahmerate oder berechnet aus Lebenserwartung und gewünschtem Restvermögen. Die Kennzahlen der Karte „Entnahmephase“ beziehen sich nur auf diese Phase; „Ausgezahlt“ oben und die Bilanz enthalten alle Entnahmen.
- **Steuer bei Verkäufen (FIFO)**: Das Depot wird in Monats-Tranchen geführt. Bei jedem Verkauf gelten die ältesten Anteile als zuerst verkauft, wie bei deutschen Depotbanken. Versteuert wird der Gewinn genau dieser Anteile, nach Teilfreistellung und restlichem Sparerpauschbetrag. Weil alte Anteile meist den höchsten Gewinn tragen, fällt zu Beginn einer Entnahme mehr Steuer an als später. Verluste einzelner Tranchen werden innerhalb eines Verkaufs verrechnet; ein Verlustvortrag wird nicht geführt.
- **Vorabpauschale**: erhöht die Anschaffungskosten aller Anteile, damit sie beim Verkauf nicht doppelt besteuert wird. Die Steuer darauf wird anteilig aus dem Depot entnommen.
- **Monte Carlo** (im Tab „Monte Carlo“ einschalten; Volatilität und Anzahl der Verläufe stehen oben im Tab; der Plan bleibt unverändert)
  - *Renditen – Regime-Modell*: Der Markt wechselt zufällig zwischen einem ruhigen Regime und einem Krisen-Regime (Regime-Switching-Lognormal-Modell mit zwei Regimes nach Hardy 2001). In jedem Monat wird die Rendite aus der Verteilung des aktuellen Regimes gezogen, danach wechselt das Regime mit fester Wahrscheinlichkeit. Geschätzt per Maximum Likelihood auf den MSCI World Net Total Return in Euro, 12/1969–08/2026 (680 Monatsrenditen; Parameter in `src/lib/regimes.ts`, Skripte zum Nachrechnen in `tools/regime-fit/`):

    | | Ruhig | Krise |
    |---|---|---|
    | Mittlere Log-Rendite pro Monat | +1,63 % | −2,17 % |
    | Volatilität pro Monat | 3,16 % | 5,64 % |
    | Wechsel pro Monat | 5,9 % (Dauer im Mittel rund 17 Monate) | 18,0 % (rund 5,5 Monate) |
    | Anteil der Zeit | 75 % | 25 % |

    In 1.500 simulierten Geschichten gleicher Länge erzeugt das Modell das schlechteste Jahr, den größten Rückgang, die längste Zeit unter dem alten Höchststand, die Schwankung der Kalenderjahre, die Schiefe der Monatsrenditen und die Spannweite der 10- und 20-Jahres-Renditen des Index realistisch – ein einfaches lognormales Modell nicht (es kennt z. B. praktisch keine Jahre unter −25 %, der Index hatte fünf). Über 30 Jahre streut das Modell etwas breiter als die Geschichte, ist dort also eher vorsichtig. Ein drittes Regime (etwa „seitwärts“) ist in den Daten nicht erkennbar; lange Seitwärtsphasen entstehen aus dem Wechsel von Krisen und Erholungen. Zum Vergleich: Hardy fand für den S&P 500 1956–1999 ein kürzeres, aber heftigeres Krisen-Regime.
  - *Rendite und Volatilität*: Die Form des Modells (Wechsel, relative Lage und Schwankung der Regimes) bleibt fest, Das Niveau kommt aus der Gesamtrendite unter „Markt“, die Stärke aus der Volatilität im Tab. Im Durchschnitt (geometrisch) wachsen die Verläufe mit der eingetragenen Gesamtrendite – so, wie Index-Renditen über die Geschichte berechnet werden (MSCI World etwa 7–8 % p. a.). Weil Krisen große Verluste wahrscheinlicher machen als große Gewinne, liegt der Median etwas über der Plan-Linie. Die Volatilität ist die aus Monatsrenditen hochgerechnete Schwankung, wie Factsheets sie angeben (MSCI World etwa 15 %); ganze Kalenderjahre schwanken im Modell dann wie beim Index stärker (rund 19 %). Ausschüttungsquote, Kosten, Steuern und Ereignisse bleiben wie im Plan.
  - *Inflation*: schwankt von Jahr zu Jahr um die eingetragene Rate (AR(1)-Prozess). Eine Überraschung klingt nur langsam ab, Phasen hoher Inflation halten daher wie in den 1970ern oder 2021–2023 einige Jahre an. Überraschungen fallen eher in schwache Börsenjahre (Stagflation). Inflationsangepasste Entnahmen steigen jeden Januar um die tatsächliche Inflation der Vorjahre, und „Kaufkraft heute“ rechnet jeden Verlauf mit seiner eigenen Inflation um. Geschätzt auf dem deutschen Verbraucherpreisindex (Destatis, Jahresdurchschnitte 1970–2025, bis 1991 Westdeutschland), die Kopplung an Aktien auf denselben MSCI-World-Daten wie die Regimes (`tools/inflation-fit/`):

    | Größe | Wert |
    |---|---|
    | Persistenz pro Jahr (φ) | 0,78 (± 0,09), Halbwertszeit rund 3 Jahre |
    | Schwankung der jährlichen Überraschung (σ) | 1,2 Prozentpunkte |
    | Langfristige Streuung um den Mittelwert | ± 2,0 Prozentpunkte |
    | Korrelation mit der Aktienrendite desselben Jahres | −0,22 (± 0,13) |

    Wirkung, beispielhaft (5.000 Verläufe, 65 Jahre, 600.000 €, 2.000 € netto im Monat inflationsangepasst bis 95): die sichere Entnahme (90 %) sinkt von 1.174 € auf 1.072 €, die Erfolgsquote von 70,0 auf 68,4 %. Ohne Inflationsanpassung ändert sich praktisch nichts. Beim Sparen bleibt der Nominalwert gleich, die Kaufkraft streut breiter. Die Inflation kann im Modell auch negativ werden (deutlich häufiger als historisch, wo es seit 1970 nur ein Jahr gab).
  - *Empfindlichkeit*: Unter der Erfolgsquote steht dezent dieselbe Rechnung mit 1 Prozentpunkt weniger Rendite, auf denselben Verläufen. Die erwartete Rendite ist selbst unsicher – auch gut 50 Jahre Daten legen sie nur auf etwa ± 2 Prozentpunkte fest –, und diese Unsicherheit wirkt über Jahrzehnte stärker als die Schwankungen.
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
  - *Grenzen*: Die Parameter stammen aus gut 56 Jahren eines Index und der deutschen Inflation; eine langfristige Rückkehr zum Mittel ist nicht abgebildet, die erwartete Rendite gilt in allen Verläufen als bekannt. Die Ergebnisse hängen stark von Rendite und Volatilität ab.
- **Nicht abgebildet**: schwankende Inflation im Plan (nur in Monte Carlo), Crashs als einzelnes Ereignis, andere Einkünfte (Rente, bAV), Günstigerprüfung, Änderungen der Steuergesetze.

## Kaufen oder Mieten

Vergleicht den Kauf einer selbst genutzten Immobilie mit Mieten plus Geldanlage. Die Frage dahinter: Wer hat nach X Jahren mehr Vermögen?

**Funktionen**

- Eingaben in Gruppen: Immobilie (Kaufpreis, Wertsteigerung), Kaufnebenkosten (Bundesland, Notar und Grundbuch, Makler), Finanzierung (Eigenkapital, Sollzins, Tilgung, Zinsbindung, Anschlusszins), Instandhaltung, Miete (Kaltmiete, Mietsteigerung), Geldanlage (Rendite, Ausschüttung, Kosten, Fondsart, Kirchensteuer, Sparerpauschbetrag; standardmäßig eingeklappt) sowie Kaufjahr, Zeitraum, Verkaufskosten und Inflation
- Antwort oben: wer nach dem Zeitraum vorn liegt, um wie viel, und ab welchem Jahr Kaufen dauerhaft vorn liegt (Break-even); daneben das Vermögen beider Wege
- **Vermögen im Vergleich** als Linien je Jahr, mit Markierungen für Break-even, Ende der Zinsbindung und Abbezahlt
- **Wohnkosten pro Monat** je Jahr als zwei Linien: Kaufen (Rate plus Instandhaltung) und Mieten (Kaltmiete). Die Fläche dazwischen ist die Differenz, die die günstigere Seite anlegt; die Aufteilung in Zinsen, Tilgung und Instandhaltung steht im Tooltip
- **Kipppunkte**: für Wertsteigerung, Rendite der Anlage, Anschlusszins, Sollzins, Kaltmiete, Mietsteigerung, Kaufpreis und Instandhaltung der Wert, ab dem sich die Antwort dreht (jeweils nur dieser Wert geändert). Werte nah am Kipppunkt sind hervorgehoben. Dazu der Kaufpreis in Jahreskaltmieten und der Faktor, bis zu dem sich Kaufen im eigenen Fall lohnt.
- **Bilanz** beider Wege (nominal) und eine aufklappbare Jahresübersicht
- Nominal oder in heutiger Kaufkraft, Szenarien im Browser, Teilen-Link (`/kaufen-mieten#k=…`), Export als PDF, PNG und CSV, wie im Vermögens-Simulator

**So wird gerechnet**

- *Gleiche Ausgaben*: Beide Wege geben jeden Monat gleich viel aus. Wer weniger fürs Wohnen zahlt, legt die Differenz in einem ETF an – anfangs meist der Mieter (Rate plus Instandhaltung liegen über der Miete), nach der Tilgung der Eigentümer. Der Mieter legt außerdem das Eigenkapital zu Beginn an. Ohne diese Regel würde Kaufen mit einer Zwangssparquote gegen einen Mieter verglichen, der die Differenz ausgibt.
- *Geldanlage*: derselbe Rechenkern wie im Vermögens-Simulator (monatlich, mit Teilfreistellung, Vorabpauschale, Sparerpauschbetrag, Kirchensteuer, Verkauf nach FIFO). Bewertet wird jeweils nach Steuern bei einem Verkauf.
- *Kaufnebenkosten*: Grunderwerbsteuer nach Bundesland, Notar und Grundbuch, Makler-Käuferanteil. Sie werden aus dem Eigenkapital bezahlt; nur der Rest mindert den Kredit. Reicht das Eigenkapital nicht, werden sie mitfinanziert (mit Warnung).
- *Kredit*: Annuitätendarlehen, monatlich mit Sollzins/12; Rate = Kredit × (Zins + anfängliche Tilgung) / 12. Nach der Zinsbindung gilt der Anschlusszins bei gleicher Rate, die Laufzeit passt sich an. Deckt die Rate dann nicht mehr Zins plus 1 % Tilgung, steigt sie auf diesen Wert.
- *Instandhaltung*: Prozent vom Kaufpreis pro Jahr, mit der Inflation fortgeschrieben. Hausgeld-Anteile, Grundsteuer und Versicherungen sind nicht getrennt abgebildet; wer sie berücksichtigen will, erhöht die Instandhaltung entsprechend (beim Mieter stecken sie in den Nebenkosten, die beide Wege ähnlich zahlen).
- *Miete*: Kaltmiete mit jährlicher Steigerung. Die warmen Nebenkosten zahlen beide Wege, sie fallen heraus.
- *Immobilie*: Wert = Kaufpreis × (1 + Wertsteigerung)^Jahre. Verglichen wird, als ob am Ende verkauft würde: Wert minus Verkaufskosten minus Restschuld plus Depot. Ein Verkauf der selbst genutzten Immobilie ist nach deutschem Recht steuerfrei.
- *Kipppunkte*: Für jeden Hebel wird ein Raster abgesucht und die Grenze per Bisektion auf wenige Nachkommastellen bestimmt (jeweils nur dieser Wert geändert). „In jedem realistischen Fall“ heißt: im geprüften Bereich dreht sich nichts.
- *Kaufkraft*: Teilt durch die angenommene Inflation; Zahlungen in Charts und Tabelle bleiben nominal.

**Standardwerte und Quellen** (Stand November 2026)

| Wert | Standard | Hintergrund |
|---|---|---|
| Grunderwerbsteuer | nach Bundesland | BW 5,0 · BY 3,5 · BE 6,0 · BB 6,5 · HB 5,5 (seit 1.7.2025) · HH 5,5 · HE 6,0 · MV 6,0 · NI 5,0 · NW 6,5 · RP 5,0 · SL 6,5 · SN 5,5 (seit 1.1.2023) · ST 5,0 · SH 6,5 · TH 5,0 % |
| Notar und Grundbuch | 2 % | üblich 1,5–2 % des Kaufpreises |
| Makler | 3,57 % | Käuferanteil bei hälftiger Teilung (seit 2020), 3 % + MwSt. |
| Sollzins | 4 % | 10 Jahre Zinsbindung lagen im Herbst 2026 bei etwa 4,3–4,5 % |
| Instandhaltung | 1 % vom Kaufpreis | Faustregeln 0,8–1 % des Kaufpreises bzw. 1–1,5 % des Gebäudewerts; die II. Berechnungsverordnung nennt 7,10–11,50 €/m² je nach Alter. Ältere Häuser eher mehr, Neubau und Wohnungen (Teil über das Hausgeld) eher weniger. |
| Mietsteigerung | 1,5 % | Index der Nettokaltmieten (Destatis) 1995–2024: etwa 1,4 % p. a. |
| Wertsteigerung | 2 % | langfristig etwa in Höhe der Inflation; Häuserpreisindex Q1 2026: +1,4 % zum Vorjahr |
| Verkaufskosten | 3,57 % | Makleranteil beim Verkauf |

**Grenzen**: konstante Annahmen ohne Schwankungen (kein Monte Carlo), keine Förderungen (KfW, Wohn-Riester), keine Sondertilgungen, keine Mietausfälle oder Leerstände, keine Steuervorteile einer Vermietung, kein Umzug im Zeitraum. Nicht in Euro messbar und deshalb nur als Hinweis genannt: Sicherheit vor einer Eigenbedarfskündigung, Freiheit beim Umbauen, Flexibilität für einen Umzug und der eigene Aufwand für Verwaltung und Reparaturen.

## Schnittstelle für KI (MCP-Server und Kommandozeile)

Damit eine KI (z. B. Claude Desktop) mit dem Simulator rechnen kann, statt Zahlen zu schätzen, gibt es einen lokalen MCP-Server. Er nutzt denselben Rechenkern wie die App, läuft komplett auf dem eigenen Rechner und sendet keine Daten nach außen.

### Einrichten für andere: Erweiterung für Claude Desktop

Wer nur rechnen lassen möchte, braucht weder das Repository noch Node:

1. `wealth-simulator.mcpb` herunterladen (wird mit `npm run pack:agent` nach `dist-agent/` gebaut und als Release-Datei verteilt).
2. Doppelklick auf die Datei (oder Claude Desktop → *Einstellungen → Erweiterungen* → Datei hineinziehen) und *Installieren*.
3. Einen neuen Chat beginnen, z. B.: „Ich bin 52, habe 400.000 € im Depot, spare 2.000 € im Monat und möchte ab 63 monatlich 3.500 € entnehmen. Reicht das? Und was, wenn ich mit 60 aufhöre?“

Die Erweiterung läuft vollständig auf dem eigenen Rechner. Optional lassen sich in den Einstellungen der Erweiterung die Adresse der Simulator-App (für die `app_link`-Links) und der Ordner für gespeicherte Pläne festlegen.

### Einrichten aus dem Repository

```bash
npm install
npm run build:agent      # erzeugt dist-agent/wealth-sim.mjs
npm run pack:agent       # zusätzlich die Erweiterung dist-agent/wealth-simulator.mcpb
```

Ohne Erweiterung in Claude Desktop unter *Einstellungen → Entwickler → Konfiguration bearbeiten* (`claude_desktop_config.json`) eintragen und Claude Desktop neu starten. Windows-Beispiel:

```json
{
  "mcpServers": {
    "wealth-simulator": {
      "command": "node",
      "args": ["C:\\Users\\<Name>\\Documents\\Wealth-Simulator-Germany\\dist-agent\\wealth-sim.mjs", "mcp"]
    }
  }
}
```

Andere MCP-fähige Programme starten den Server genauso: `node dist-agent/wealth-sim.mjs mcp` (stdio).

### Privat hosten auf Vercel (mit Passwort)

App und MCP lassen sich auf Vercel (auch im kostenlosen Hobby-Plan) für einen geschlossenen Kreis bereitstellen. Beides ist durch ein Passwort geschützt, das **nur in Vercel** hinterlegt wird – im Repository steht es nirgends.

1. Auf [vercel.com](https://vercel.com) *Add New → Project*, dieses GitHub-Repository importieren. Vercel erkennt Vite automatisch; nichts weiter einstellen.
2. Unter *Environment Variables* die Variable `SITE_PASSWORD` mit dem gewünschten Passwort anlegen (für *Production* und *Preview*), dann *Deploy*.
3. Die App fragt beim Öffnen per Browser-Dialog nach Benutzername und Passwort; der Benutzername ist egal.
4. Den MCP in Claude (Einstellungen → Connectors → eigenen Connector hinzufügen) oder einem anderen MCP-Programm mit dieser Adresse eintragen:
   `https://<projekt>.vercel.app/api/mcp?key=<Passwort>`

Ohne `SITE_PASSWORD` bleibt alles gesperrt. Passwort ändern: Variable in Vercel ändern und neu deployen (*Deployments → Redeploy*).

Die gehostete Variante speichert nichts: Es gibt dort kein Werkzeug `plans`. Ein Plan aus der App wird mit `base: "link:<Teilen-Link>"` übernommen, und Ergebnis-Kennungen (`result:x…`) enthalten ihre Konfiguration selbst, sodass sich ein Ergebnis auch ohne Speicher weiterdrehen lässt. Die Links in den Antworten zeigen auf die eigene Vercel-Adresse.

Technik: `middleware.ts` sperrt die App (Vercel Routing Middleware, Basic Auth), `api/mcp.ts` ist der MCP-Endpunkt (Streamable HTTP, zustandslos), `vercel.json` erlaubt ihm 60 Sekunden Laufzeit. Weil Vercel Funktionen Datei für Datei übersetzt, tragen die Importe entlang dieses Pfads die Endung `.js`.

### Eigenen Plan übergeben (optional)

Ohne gespeicherten Plan wird jede Rechnung neu aufgesetzt (siehe unten). Wer seinen Plan aus der App nutzen möchte: Die App speichert im Browser; dort kommt der Server nicht hin. Deshalb: in der App **Link teilen**, den Link der KI geben („importiere meinen Plan“) – sie ruft `plans` mit `import_link` auf. Der Plan wird zum Standardplan und liegt in `~/.wealth-simulator/plans.json` (Windows: `C:\Users\<Name>\.wealth-simulator\plans.json`; ändern mit der Umgebungsvariable `WEALTH_SIM_HOME`). Nach Änderungen in der App den Link einfach erneut importieren.

### Werkzeuge

| Werkzeug | Zweck |
|---|---|
| `describe` | Alle Felder mit Typ, Einheit, Standardwert und Bedeutung sowie die Modellannahmen |
| `simulate` | Plan ohne Marktschwankungen: Endwerte, Dividenden, Entnahmen, Ziel, Warnungen, Meilensteine (`detail: "years"` für alle Jahre) |
| `monte_carlo` | Erfolgsquote, Perzentile, bezahlte Entnahmen, Leitplanken-Statistik; optional sichere Entnahme (`safe_probability`) |
| `solve` | Gesuchten Wert berechnen: Entnahme für ein Restvermögen, sichere Entnahme oder nötige Sparrate/Startkapital/Rendite für ein Ziel |
| `compare` | Bis zu 8 Szenarien nebeneinander, optional mit Monte Carlo auf denselben Zufallsverläufen |
| `buy_vs_rent` | Kaufen oder Mieten: Gewinner, Vermögen beider Wege, Break-even, Rate, Kaufnebenkosten, Kipppunkte; mit `scenarios` bis zu 8 Varianten. Startet bei Standardwerten oder einem Teilen-Link (`link`), Felder unter `buy_vs_rent_fields` in `describe`; `totalReturn` u. a. dürfen direkt in `changes` stehen. Fehlen Kaufpreis, Miete, Eigenkapital oder Zins, nennt `notes` die angenommenen Werte. |
| `plans` | Pläne auflisten, lesen, speichern, löschen, Standard setzen, Teilen-Link importieren |

Die Ressource `wealth-sim://model` beschreibt das Modell als Markdown.

### Neue Rechnung, Ausgangspunkt und Änderungen

Eine Rechnung lässt sich jederzeit von Null starten. Nur die persönlichen Eckdaten müssen angegeben werden – Alter (`age` oder `birthDate`), Startkapital (`initialCapital`), Sparrate (`monthlySavings`) und Rendite (`totalReturn`). Steuern, Inflation, Kosten, Ausschüttung und Fondsart haben sinnvolle Standardwerte. Fehlt eine Eckdate, rechnet der Server mit einem Platzhalter und sagt das in `notes`, damit die KI nachfragt statt zu raten.

```json
{ "changes": { "age": 28, "initialCapital": 30000, "monthlySavings": 800, "totalReturn": 7 } }
```

Bei einer neuen Rechnung richten sich die übrigen altersabhängigen Werte nach der Person, nicht nach festen Jahreszahlen: Ohne Entnahme läuft die Rechnung bis zum Rentenalter 67 (wer älter ist: 20 Jahre), mit Entnahme bis zur Lebenserwartung (Standard 90, mindestens 10 Jahre über dem heutigen Alter). Die Entnahme beginnt standardmäßig mit 67, bei Älteren sofort. `withdrawal.startAge` (z. B. 60) ist eine Abkürzung für das Startjahr und meint den ersten Januar, an dem die Person dieses Alter erreicht hat. Alles davon nennt die Antwort unter `notes` und lässt sich überschreiben (`durationMode`/`targetAge`/`durationYears`, `withdrawal.lifeExpectancy`).

Jede Berechnung hat einen Ausgangspunkt `base` und optional `changes`:

- `base`: `"auto"` (Standard: der gespeicherte Standardplan, wenn es einen gibt, sonst Standardwerte), `"defaults"` (immer neue Rechnung, auch wenn ein Plan gespeichert ist), `"saved"`, `"plan:<Name>"`, `"result:<id>"` (ein früheres Ergebnis weiterdrehen, z. B. `"result:r3"`) oder `"link:<Teilen-Link>"` (Plan direkt aus der App).
- `changes`: nur das, was abweichen soll, verschachtelt wie die Konfiguration. Objekte werden zusammengeführt, Listen (Ereignisse) ersetzen die bisherige Liste vollständig. `age` ist eine Abkürzung für das Geburtsdatum, `withdrawal.startAge` für das Startjahr der Entnahme.

Szenarien durchspielen mit `compare`: Die gemeinsamen Eckdaten stehen einmal oben, jedes Szenario nennt nur seinen Unterschied.

```json
{ "changes": { "age": 28, "initialCapital": 30000, "monthlySavings": 800 },
  "scenarios": [
    { "name": "5 %", "changes": { "totalReturn": 5 } },
    { "name": "7 %", "changes": { "totalReturn": 7 } },
    { "name": "7 %, 1000 € Sparrate", "changes": { "totalReturn": 7, "monthlySavings": 1000 } },
    { "name": "Wohnung 2034", "changes": { "totalReturn": 7, "oneOffWithdrawals": [{ "year": 2034, "amount": 80000, "label": "Wohnung" }] } } ],
  "monte_carlo": true }
```

Jede Antwort enthält `result_id`, den Ausgangspunkt, unter `changed` die wirksamen Abweichungen, unter `notes` angenommene oder korrigierte Werte, Warnungen und einen `app_link`, der das Szenario in der App öffnet. Mit `plans` / `save` wird ein Ergebnis dauerhaft gespeichert. Unbekannte Felder werden abgelehnt statt still ignoriert. Monte Carlo nutzt einen festen Startwert, gleiche Eingaben ergeben also gleiche Ergebnisse. Die App-Adresse für Links lässt sich mit `WEALTH_SIM_APP_URL` ändern (Standard `http://localhost:3000/`).

### Kommandozeile

Dieselben Werkzeuge ohne KI, Ausgabe als JSON:

```bash
node dist-agent/wealth-sim.mjs help
node dist-agent/wealth-sim.mjs import "http://localhost:3000/#s=..." "Mein Plan"
node dist-agent/wealth-sim.mjs simulate '{"changes":{"age":28,"initialCapital":30000,"monthlySavings":800}}'
node dist-agent/wealth-sim.mjs simulate
node dist-agent/wealth-sim.mjs solve '{"target":"safe_withdrawal","probability":0.9}'
node dist-agent/wealth-sim.mjs compare @szenarien.json
```

In PowerShell JSON besser in eine Datei schreiben und mit `@datei.json` übergeben, weil PowerShell Anführungszeichen umschreibt.

## Entwicklung

Voraussetzung: Node.js 20 oder neuer.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Tests der Rechenlogik
npm run build      # Produktions-Build nach dist/
npm run build:agent      # MCP-Server/Kommandozeile nach dist-agent/
npm run pack:agent       # Erweiterung für Claude Desktop (.mcpb)
npm run typecheck:agent  # Typprüfung der Schnittstelle
```

## Aufbau

```
src/
  lib/simulation.ts   Rechenkern (monatliche Simulation, Ereignisse, Steuern, FIFO)
  lib/goal.ts         Zielrechner (Bisektion)
  lib/montecarlo.ts   Monte Carlo: Verläufe, Auswertung, sichere Entnahme
  lib/inflation.ts    Inflationsmodell für Monte Carlo (AR(1), deutsche Inflation)
  lib/regimes.ts      Regime-Modell der Renditen (geschätzte Parameter)
  lib/mc.worker.ts    Web Worker für Monte Carlo
  lib/random.ts       Zufallszahlen mit Startwert
  lib/config.ts       Prüfen und Ergänzen von Konfigurationen
  lib/storage.ts      Szenarien im Browser, Teilen-Links
  components/ScenarioMenu.tsx  Szenarien wechseln, anlegen, umbenennen, löschen
  lib/export.ts       PDF/PNG/CSV
  components/         Oberfläche (Einstellungen, Ergebnisse, Charts, Monte-Carlo-Tab)
  buyrent/            Kaufen oder Mieten: Rechenkern (engine.ts), Standardwerte und Bundesländer,
                      Prüfung, Szenarien und Links, Oberfläche (BuyRentApp, Settings, Results)
  components/Chrome.tsx  Kopfzeile: Logo, Rechner-Wechsel, Export-Menü, Design, Hinweis
agent/
  buyrent.ts          Werkzeug buy_vs_rent mit Feldbeschreibung
  tools.ts            Werkzeuge der KI-Schnittstelle (gemeinsam für MCP und Kommandozeile)
  scenario.ts         Ausgangspunkt + Änderungen, Prüfung, Hinweise, Unterschiede
  fields.ts           Beschreibung aller Felder
  model.ts            Modellbeschreibung (Ressource)
  store.ts            Gespeicherte Pläne (JSON-Datei)
  share.ts            Teilen-Links lesen und erzeugen
  mcp.ts              Werkzeuge als MCP-Server (gemeinsam für lokal und gehostet)
  server.ts, cli.ts   Lokaler MCP-Server (stdio) und Kommandozeile
  remote.ts           Gehosteter MCP-Endpunkt (HTTP, ohne Speicher, mit Schlüssel)
api/mcp.ts            Vercel-Funktion für den MCP-Endpunkt
middleware.ts         Passwortsperre der App auf Vercel
  build.mjs, pack.mjs Bündeln, Erweiterung (.mcpb) bauen
```

## Hinweis

Modellrechnung mit konstanten Annahmen, keine Anlage- oder Steuerberatung.
