# Data opnieuw bouwen

De bestanden in `../data` zijn gemaakt met deze scripts. Opnieuw bouwen is alleen nodig als je de bronteksten wilt bijwerken.

```sh
mkdir -p src && cd src
git clone --depth 1 https://github.com/openscriptures/morphhb wlc
git clone --depth 1 --filter=blob:none --no-checkout https://github.com/honza/textus-receptus htr
(cd htr && git checkout HEAD -- data/gnt.nested.json)
git clone --depth 1 --filter=blob:none --no-checkout https://github.com/scrollmapper/bible_databases sm
(cd sm && git checkout HEAD -- formats/json/DutSVV.json formats/json/DutSVVA.json)
cd ..
python3 svbuild.py      # SV in de eigen SV-versindeling (duurt ~1 min)
python3 build_data.py   # schrijft ../data/*.json
```

**Waarom twee SV-bestanden?** `DutSVV` heeft de bekende tekst (met HEERE in hoofdletters), maar is in de KJV-versindeling geperst: bij Psalmen zijn de laatste verzen samengevoegd en in Job 38–41 kloppen de nummers niet. `DutSVVA` bevat markeringen met de echte SV-nummers. `svbuild.py` legt de tekst van `DutSVV` op de versindeling van `DutSVVA`.

**Koppeling met de grondtekst.** Waar de SV anders nummert dan de grondtekst (bijv. Exodus 5:24 = Hebr. 6:1, Maleachi 4 = Hebr. 3:19–24), staat de koppeling in `map.json`. Die is afgeleid van de SV-markeringen en de `VerseMap.xml` van de Open Scriptures Hebrew Bible.
