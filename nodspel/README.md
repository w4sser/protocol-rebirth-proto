# Nodspel

Statisk Three.js-sida för liggande telefon. Ingen backend eller sparad progression.

Varje ny runda börjar med 100 liv och en tom väska. Gå nära en gul plocklåda för att få antingen skrot eller en power cell; innehållet bestäms av seedet. Bana 1 har en plocklåda, bana 2 två intill fienderna i rum 2 och bana 3 tre. De grå lådorna är fortfarande skydd.

En öppen utgång extraherar väskan och visar innehållet som säkrat på nästa bana. Död eller tidsgränsen förlorar allt osäkrat i väskan. Slutrutan visar både extraherat och förlorat innehåll. Det som redan extraherats bevaras under rundan; Starta om börjar utan föremål och utan sparad progression.

`levels.js` styr storleksintervall, dörrar, slumpade riktningar och avstånd mellan rum, passager, mellanväggar, återvändsgränd, noder, lådor och fiender.

- Bana 1: ett öppet rum, en nod och en fiende som båda syns direkt nära spelaren.
- Bana 2: två rum, 1,8 bred passage, två skymda noder i det andra rummet och två aktiva fiender i rum 2. Två reserver aktiveras när första noden tänds. Spelaren måste gå genom passagen.
- Bana 3: tre rum, ett vägval vid starten där ena vägen slutar i en återvändsgränd, samt sex snabbare fiender. Utgången ligger i det tredje rummet, på den andra vägen.

Varje banstart visar namn och rundans seed stort i tre sekunder. Sedan finns namn och seed på en liten skylt i övre högra hörnet.

Håll höger spak för att se räckviddscirkeln och sikta, släpp för ett skott. Ett tryck utan drag skjuter inte. Gå-spaken kan aldrig skjuta. På dator hålls musknappen eller mellanslag och släpps för att skjuta. Vapnet har tre skott, sju enheters räckvidd och fyller på ett skott var 0,7 sekund. Strecken ovanför spaken visar ammo, pågående påfyllning och tiden till nästa skott. Livmätaren följer spelaren; noll liv avslutar rundan.

Vapnets räckvidd, skada, magasin, skotthastighet och påfyllningstid finns i `RULES.weapon` i `levels.js`. Samma vapen används på alla tre banor. Fienderna har samma räckvidd som spelaren och tar 20 liv per träff (fem träffar till död). Bana 1 och 2:s fiender tål två skott, bana 3:s tre. Bana 3:s snabbare fiender börjar längre bort och närmar sig snabbt. `weapon.js` begränsar varje projektils färd till räckvidden och testar väggar före träffar, även med stora tidssteg.

Seed visas på skärmen och i `?seed=...` i adressen. Ladda samma adress för att återskapa hela rundan. Starta om skapar alltid ett nytt seed. Reglerna är samma, medan storlek, rummens kopplingar och objektens placering varierar. Lådornas hörnband lämnar dörrar och nodernas gångvägar fria.

Kör `npm test` i denna katalog. Testerna kontrollerar 90 banors gångvägar med riktig kollisionslogik, skymda noder, återvändsgränd, seed, strid, timer och tre fullständiga genomspelningar. Lokal förhandsvisning: `node serve.mjs`.

Kameran visar ungefär halva den tidigare ytan och följer spelaren. Räckviddscirkel och en tydlig riktlinje visas medan siktspaken dras.

Lägg till sidan på telefonens hemskärm via webbläsarens meny. Manifestet startar Nodspel som en fristående sida utan adressfält; iOS har också hemskärmsikon och standalone-meta. Ingen inloggning eller install-knapp. Ikoner: 192 och 512 px.

Svag sikthjälp väljer närmaste synliga fiende inom räckvidden när fienden ligger högst 12 grader och 1,1 enheter från riktlinjen. Riktningen dras delvis mot målet; en gul ring och markör visar låsningen. Projektilerna har 0,64 enheters bredd. Väggar har kollisionsmarginal för bredden, och skymda mål får inga träffar runt hörn. Alla värden finns i RULES.weapon i levels.js. Utan lämpligt mål skjuts i spakens riktning.

En kill ger direkt ett skott och 15 liv, upp till tre skott och 100 liv. Belöningen följer med genom banbyten. Noder och utgångar kräver inga kills. Noder kan också få sikteslåsning. Varje nytt rum ger tre sekunders skydd från fiender; kvarvarande fiendeskott rensas när respiten börjar. Reserverna har också tre sekunders respit från aktivering.
