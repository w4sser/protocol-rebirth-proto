# Human operator

`human-operator.glb`: **Punk**, by **Quaternius**. Rigged low-poly human,
24 animation clips. Downloaded unchanged from the free Poly Pizza source.

- Model and license listing: https://poly.pizza/m/djXoqejw6w
- Direct GLB: https://static.poly.pizza/1d368679-1d9a-4d5c-9095-877144b02d00.glb
- License: **CC0 1.0 Universal (Public Domain)**, https://creativecommons.org/publicdomain/zero/1.0/
- Download size: 1,474,996 bytes (below 1.5 MB; no compression or decoder needed).

Clip mapping: idle = Idle_Gun, run = Run (Run_Back when aiming behind the
movement direction), shoot = Gun_Shoot, dash = Roll, hit = HitRecieve,
death = Death. Idle_Gun_Pointing supplies the upper-body aiming pose.
The runtime partitions animations at Abdomen and crossfades each layer separately.

# Ultra Water

`nodspel/vendor/ultra-water/`: **Ultra Water**, by **Humpalumps**. A Tessendorf
FFT ocean simulation (`src/water/OceanSim.js`, `OceanSurface.js`) used for the
v2.11.0 start screen's archipelago flight-over (High/Medium quality only; Low
and no-WebGL2 fall back to a static image, see `start-scene.js`). Vendored
unchanged, including its own third-party notices.

- Source: https://github.com/Humpalumps/Ultra-Water
- License: **MIT**, see `nodspel/vendor/ultra-water/LICENSE`
- `THIRD_PARTY_NOTICES.md` (kept alongside, carries its own MIT sub-notices for
  code adapted from three.js, Dave Hoskins' "Hash without Sine" and
  UnrealEngineSkyAtmosphere).

# Coast operator (v2.11.1)

`coast-operator.glb`: **Hoodie Character**, by **Quaternius**. Rigged human
with 24 animation clips, downloaded unchanged. Runtime primitive raised hood,
backpack, jacket/trouser shells and carbine are original geometry dedicated to **CC0 1.0**.

- Model and license listing: https://poly.pizza/m/gKLBoRsyKe
- Direct GLB: https://static.poly.pizza/bcd66ec5-5e81-4901-a222-47abc875fe2a.glb
- License: **CC0 1.0 Universal (Public Domain)**, https://creativecommons.org/publicdomain/zero/1.0/
- Download size: 1,456,760 bytes (below 1.5 MB; no compression/decoder needed).
- Raised hood attaches to Head; backpack to Chest; carbine to WristR.
  The support wrist follows the handguard with a two-bone solve. The named
  `muzzle` node at the barrel tip supplies the flash position.
- Punk (`human-operator.glb`) remains unchanged and selectable with `skin=punk`
  (legacy alias `skin=human`). The procedural robot remains `skin=robot`.
