# Ereunate

*ἐρευνᾶτε τὰς γραφάς — Onderzoekt de Schriften (Joh. 5:39)*

Een kleine webapp (PWA) om de **Statenvertaling** te lezen en te doorzoeken naast de **grondtekst**: Hebreeuws voor het Oude Testament, Grieks voor het Nieuwe. Na de eerste keer openen werkt alles offline, ook het zoeken.

## Wat kan het

- **Lezen**: SV en grondtekst per vers, onder elkaar of naast elkaar. Via **Aa** zet je teksten, kanttekeningen en markeringen aan of uit en stel je de tekstgrootte in. Tik op een vers voor de actiebalk: markeren in één tik, notitie, kanttekeningen, woorden, kerkvaders, Claude of kopiëren. Vegen naar links of rechts gaat naar het volgende of vorige hoofdstuk.
- **Bladeren**: boek en hoofdstuk kiezen, of direct naar een tekstplaats (`joh 3:16`, `1 kor 13`, `ps 23`). Recent gelezen hoofdstukken staan bovenaan.
- **Zoeken**: op woorden of een exacte zin in de SV, in de hele Bijbel, een testament of één boek. Typ Grieks of Hebreeuws om in de grondtekst te zoeken. Accenten en klinkertekens hoef je niet te typen. Ook zoeken in alle kanttekeningen en in je eigen notities.
- **Markeren en notities**: geef een vers een van 10 kleuren en schrijf er een notitie bij, met #thema's om te groeperen. Te zien in de leestekst (aan/uit via Aa) en in de tab Mijn, met filters op kleur, notitie en thema.
- **Kanttekeningen**: alle kanttekeningen van de Statenvertaling, met onderstreepte trefwoorden in de tekst. Tik op een vers of lettertje voor het verspaneel. Verwijzingen zijn aan te tikken en openen een nieuw paneel; met het kruimelpad ga je terug.
- **Woorden**: in het verspaneel tik je op een woord in de SV of de grondtekst. Je ziet het Griekse of Hebreeuwse woord, de grondvorm, de grammatica in het Nederlands, hoe de SV het woord elders vertaalt, de betekenis uit Strong's woordenboek en alle verzen waar het voorkomt.
- **Kerkvaders**: in het verspaneel staat bij veel verzen uitleg van Augustinus en Johannes Chrysostomus (Engels), met de bron, een vertaallink en "Vraag Claude" voor een Nederlandse vertaling met uitleg.
- **Uitleg online**: per hoofdstuk direct naar King Comments en Matthew Henry.
- **Vraag Claude**: opent Claude met het vers in SV en grondtekst en een vraag naar keuze (letterlijke vertaling, afwijkingen, moeilijke woorden of een eigen vraag).
- **Voortgang** (tab Mijn): hoofdstukken afvinken, overzicht per boek, en aanbevelingen op basis van de verwijzingen in de kanttekeningen bij wat je las. Met back-up en terugzetten; markeringen en notities gaan daarin mee.
- **Versnummering**: waar de SV anders nummert dan de grondtekst (bijv. Exodus 5:24 = Hebr. 6:1, Maleachi 4 = Hebr. 3:19–24) staat de juiste grondtekst ernaast, met het afwijkende nummer erbij.

## Op je telefoon zetten

Open de site in Safari (iPhone) of Chrome (Android) en kies **Zet op beginscherm**. Daarna start de app als een eigen tegel en werkt hij zonder internet.

## Nieuwe versie live zetten

1. Pas de bestanden aan en verhoog `VERSION` in `sw.js` (bijv. `v1.0.1`).
2. Push naar `main`. GitHub Pages zet het binnen een minuut live.
3. In de app verschijnt de melding *Er is een nieuwe versie* met een knop **Vernieuwen**.

Zonder ophogen van `VERSION` blijft de app de oude bestanden uit de cache gebruiken.

## Bronnen en licenties

| Tekst | Bron | Licentie |
|---|---|---|
| Statenvertaling (editie 1888) | CrossWire-modules DutSVV en DutSVVA, via [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases) | Publiek domein |
| Hebreeuws: Westminster Leningrad Codex | [Open Scriptures Hebrew Bible](https://github.com/openscriptures/morphhb) | Tekst publiek domein |
| Kanttekeningen en verwijzingen bij de SV | [jajpater/statenvertaling](https://github.com/jajpater/statenvertaling) | CC0 |
| Grieks: Textus Receptus (Scrivener 1894) | [honza/textus-receptus](https://github.com/honza/textus-receptus) | Vrij te gebruiken |
| Strong-nummers bij de SV-woorden | [jajpater/statenvertaling](https://github.com/jajpater/statenvertaling) | CC0 |
| Grammatica Grieks / Hebreeuws | Textus Receptus-data hierboven; morfologie van de Open Scriptures Hebrew Bible | Vrij / CC BY 4.0 |
| Woordenboek (Strong, 1890/1894) | [openscriptures/strongs](https://github.com/openscriptures/strongs) | CC BY-SA; `data/lex-*.json` valt daardoor ook onder CC BY-SA |
| Kerkvaders per vers (Augustinus, Chrysostomus) | [HistoricalChristianFaith/Commentaries-Database](https://github.com/HistoricalChristianFaith/Commentaries-Database) | Publiek domein; alleen citaten met een bron-URL zijn opgenomen. Engelse vertalingen, deels 19e-eeuws (NPNF), deels machinevertaling door historicalchristian.faith |
| Lettertypen Noto Serif en Noto Serif Hebrew | Google Fonts, via Fontsource | SIL Open Font License 1.1 |

Het Hebreeuws wordt getoond met klinkertekens, zonder cantillatietekens. Hoe de data is gemaakt staat in [`tools/`](tools/README.md).

## Techniek

Gewone HTML, CSS en JavaScript, zonder framework of build-stap. `sw.js` slaat bij installatie alle bestanden op (ongeveer 32 MB, ingepakt zo'n 9 MB). De kerkvaders (18 MB) worden per boek geladen zodra je ze opent en daarna ook offline bewaard.
