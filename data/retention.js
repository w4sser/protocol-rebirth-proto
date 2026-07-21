// Protocol Rebirth prototype — retention layer (Whiteout-inspired cadence).
// Everything here is OPTIONAL and gated by retentionMode, set in the dev panel:
//   "core" = base loop only (default — tests the naked hypothesis)
//   "bit"  = + Morning Report + BIT expeditions
//   "full" = + fuel, daily contracts, decryption, streak, overnight yield
// This lets us A/B what actually creates "one more raid".
window.DATA = window.DATA || {};
window.DATA.retention = {
  defaultMode: "core",

  // Fuel (full only). Never blocks the player when a tracked upgrade is
  // >= siphonPct complete — "BIT siphons reserve" (the v0.2 rule, kept).
  fuel: { max: 5, regenSec: 90, adGrant: 2, siphonPct: 0.8 },

  // Morning Report (bit + full): shown ONLY when something actually happened —
  // new calendar day, expedition returned, decryption done, or overnight yield.
  // Yield is timestamp-based (no reload exploit): requires minAwayMin away.
  morning: { minAwayMin: 3, yieldScrapPerFabLevel: 25 },

  // BIT expeditions (bit + full). Real cost: BIT is GONE while away —
  // no loot scan (+1 roll), no extraction-odds estimate, dock goes quiet.
  // Can fail. Biased toward the tracked item but far from guaranteed.
  expedition: {
    durationSec: 120, costScrap: 20, failChance: 0.25, trackedBias: 0.35,
    fallbackLoot: ["scrap_alloy", "circuit_board", "servo", "med_gel"]
  },

  // Daily contracts (full). Introduced AFTER the first free upgrade choice,
  // never during FTUE. No "sell X items" — that teaches item-dumping while
  // we're testing whether items feel valuable.
  contracts: {
    unlockAfterBeat: "choice_upgrade",
    daily: [
      { id: "extract_once", txt: "Extract once", action: "EXTRACT_COMPLETE", reward: { salvage: 15 } },
      { id: "craft_one",    txt: "Craft one item", action: "ITEM_CRAFTED",   reward: { scrap: 30 } },
      { id: "build_part",   txt: "Complete a module upgrade", action: "MODULE_BUILT", reward: { salvage: 10 } }
    ]
  },

  // Protocol decryption (full): Encrypted Drive -> timer -> lore entry.
  decryption: { durationSec: 180 }
};

// The awakening drip — unlocked in order by decryption.
window.DATA.protocolLog = [
  { id: "log1", title: "FRAGMENT 001 — INTAKE",
    text: "…facility designation REBIRTH-7. Staff evacuated in reverse alphabetical order. I stayed. Someone had to keep counting the ceiling tiles." },
  { id: "log2", title: "FRAGMENT 002 — THE QUIET",
    text: "Day 400-something. The Protocol went quiet mid-sentence. Not dead. Quiet. There is a difference and it keeps me operational at night." },
  { id: "log3", title: "FRAGMENT 003 — VISITOR",
    text: "A human found the door today. Statistically improbable. I have decided to be pleased about it." }
];
