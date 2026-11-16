# Dev Panel unlock sandbox

The existing Dev Panel now offers **Unlock All Worlds**, **Unlock Everything**, and **Return to Normal Save** while a sandbox is active.

- Worlds: copies the current profile into a separate sandbox, opens every configured world and Hard variant, restores the Core/Fabricator prerequisites, and bypasses introductory raids so each destination can launch immediately. Other rooms and equipment retain their normal progression.
- Everything: also restores every room/module, grants every item and blueprint/cosmetic, maximizes operator skills, gear tiers/upgrades, weapon mastery and BIT bond, and makes every talent selectable with enough points. Mutually exclusive talent choices remain mutually exclusive.
- Sandbox progression persists across reloads and raid returns. Pressing an unlock button starts a new copy of the normal profile. Exiting returns to the untouched normal profile.

`ui/debug-sandbox.js` reuses the namespace approach already used by the isolated preview. It runs before both entry points and scopes localStorage and sessionStorage, including profiles, resets, FTUE metrics and raid results. Its methods compose with the preview storage shim. Mode travels explicitly in launch and return URLs; an ordinary tab never automatically enters debug mode. Grants only run after this bootstrap and are idempotent per sandbox save. No save-schema migration is needed.

Implementation plan and checks:
1. Pin storage isolation and new actions with failing regression tests.
2. Extend existing Dev Panel/actions and data-driven grants; wire bootstrap before both games.
3. Test actual deploy actions for every area, profile access, reload/reset boundaries and normal-save return.
4. Run full base/raid CI and all layout groups; additionally render, extract and return from all three worlds in both modes using the browser smoke.
5. Merge only after every relevant check succeeds; verify the Pages deployment and published assets.

Run `npm run test:debug-unlocks` and `node scripts/debug-unlocks-smoke.mjs` (Puppeteer). Set `DEBUG_SMOKE_URL` to the published root URL to run the same smoke against Pages. Local Windows has no `/workspace/qa.sh`; the repository CI runs the base, raid, layout and end-to-end gates.
