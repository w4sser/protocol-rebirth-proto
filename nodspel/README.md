# Nodspel

Statisk Three.js-sida för liggande telefon. Ingen backend eller sparad progression.

`levels.js` styr storleksintervall, dörrar, slumpade riktningar och avstånd mellan rum, passager, mellanväggar, återvändsgränd, noder, lådor och fiender.

- Bana 1: ett öppet rum, en nod och en fiende som båda syns direkt nära spelaren.
- Bana 2: två rum, 1,8 bred passage, två skymda noder i det andra rummet och fyra fiender. Spelaren måste gå genom passagen.
- Bana 3: tre rum, ett vägval vid starten där ena vägen slutar i en återvändsgränd, samt sex snabbare fiender. Utgången ligger i det tredje rummet, på den andra vägen.

Varje banstart visar namn och rundans seed stort i tre sekunder. Sedan finns namn och seed på en liten skylt i övre högra hörnet.

Seed visas på skärmen och i `?seed=...` i adressen. Ladda samma adress för att återskapa hela rundan. Starta om skapar alltid ett nytt seed. Reglerna är samma, medan storlek, rummens kopplingar och objektens placering varierar. Lådornas hörnband lämnar dörrar och nodernas gångvägar fria.

Kör `npm test` i denna katalog. Testerna kontrollerar 90 banors gångvägar med riktig kollisionslogik, skymda noder, återvändsgränd, seed, strid, timer och tre fullständiga genomspelningar. Lokal förhandsvisning: `node serve.mjs`.
