# Ereunate

*ἐρευνᾶτε τὰς γραφάς — Onderzoekt de Schriften (Joh. 5:39)*

Een kleine webapp (PWA) om de **Statenvertaling** te lezen en te doorzoeken naast de **grondtekst**: Hebreeuws voor het Oude Testament, Grieks voor het Nieuwe. Na de eerste keer openen werkt alles offline, ook het zoeken.

## Wat kan het

- **Lezen**: SV en grondtekst per vers, onder elkaar of naast elkaar. Beide teksten los aan en uit te zetten. Tekstgrootte instelbaar. Vegen naar links of rechts gaat naar het volgende of vorige hoofdstuk.
- **Bladeren**: boek en hoofdstuk kiezen, of direct naar een tekstplaats (`joh 3:16`, `1 kor 13`, `ps 23`). Recent gelezen hoofdstukken staan bovenaan.
- **Zoeken**: op woorden of een exacte zin in de SV, in de hele Bijbel, een testament of één boek. Typ Grieks of Hebreeuws om in de grondtekst te zoeken. Accenten en klinkertekens hoef je niet te typen.
- **Kanttekeningen**: alle kanttekeningen van de Statenvertaling, met onderstreepte trefwoorden in de tekst. Tik op een vers of lettertje voor het verspaneel. Verwijzingen zijn aan te tikken en openen een nieuw paneel; met het kruimelpad ga je terug.
- **Uitleg online**: per hoofdstuk direct naar King Comments en Matthew Henry.
- **Vraag Claude**: opent Claude met het vers in SV en grondtekst en een vraag naar keuze (letterlijke vertaling, afwijkingen, moeilijke woorden of een eigen vraag).
- **Voortgang**: hoofdstukken afvinken, overzicht per boek, en aanbevelingen op basis van de verwijzingen in de kanttekeningen bij wat je las. Met back-up en terugzetten.
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
| Lettertypen Noto Serif en Noto Serif Hebrew | Google Fonts, via Fontsource | SIL Open Font License 1.1 |

Het Hebreeuws wordt getoond met klinkertekens, zonder cantillatietekens. Hoe de data is gemaakt staat in [`tools/`](tools/README.md).

## Techniek

Gewone HTML, CSS en JavaScript, zonder framework of build-stap. `sw.js` slaat bij installatie alle bestanden op (ongeveer 21 MB, ingepakt zo'n 6 MB).
