# Nodspel

Statisk Three.js-sida för liggande telefon. Ingen backend eller sparad progression.

`levels.js` styr storleksintervall, dörrar, slumpade riktningar och avstånd mellan rum, passager, mellanväggar, återvändsgränd, noder, lådor och fiender.

- Bana 1: ett öppet rum, en nod och en fiende som båda syns direkt nära spelaren.
- Bana 2: två rum, 1,8 bred passage, två skymda noder i det andra rummet och fyra fiender. Spelaren måste gå genom passagen.
- Bana 3: tre rum, ett vägval vid starten där ena vägen slutar i en återvändsgränd, samt sex snabbare fiender. Utgången ligger i det tredje rummet, på den andra vägen.

Varje banstart visar namn och rundans seed stort i tre sekunder. Sedan finns namn och seed på en liten skylt i övre högra hörnet.

Håll höger spak för att se räckviddscirkeln och sikta, släpp för ett skott. Ett tryck utan drag skjuter inte. Gå-spaken kan aldrig skjuta. På dator hålls musknappen eller mellanslag och släpps för att skjuta. Vapnet har tre skott, sju enheters räckvidd och fyller på ett skott var 0,7 sekund. Strecken ovanför spaken visar ammo, pågående påfyllning och tiden till nästa skott. Livmätaren följer spelaren; noll liv avslutar rundan.

Vapnets räckvidd, skada, magasin, skotthastighet och påfyllningstid finns i `RULES.weapon` i `levels.js`. Samma vapen används på alla tre banor. Fienderna har samma räckvidd som spelaren, tål tre skott och tar 20 liv per träff. Bana 3:s snabbare fiender börjar längre bort och närmar sig snabbt. `weapon.js` begränsar varje projektils färd till räckvidden och testar väggar före träffar, även med stora tidssteg.

Seed visas på skärmen och i `?seed=...` i adressen. Ladda samma adress för att återskapa hela rundan. Starta om skapar alltid ett nytt seed. Reglerna är samma, medan storlek, rummens kopplingar och objektens placering varierar. Lådornas hörnband lämnar dörrar och nodernas gångvägar fria.

Kör `npm test` i denna katalog. Testerna kontrollerar 90 banors gångvägar med riktig kollisionslogik, skymda noder, återvändsgränd, seed, strid, timer och tre fullständiga genomspelningar. Lokal förhandsvisning: `node serve.mjs`.

Kameran visar ungefär halva den tidigare ytan och följer spelaren. Räckviddscirkel och en tydlig riktlinje visas medan siktspaken dras.

Lägg till sidan på telefonens hemskärm via webbläsarens meny. Manifestet startar Nodspel som en fristående sida utan adressfält; iOS har också hemskärmsikon och standalone-meta. Ingen inloggning eller install-knapp. Ikoner: 192 och 512 px.
