// v2.8.0 SAVE SLOTS: pure module tests. Run: node test/save-slots.test.js
const assert = require("assert");
const S = require("../save-slots.js");

function fakeStorage(init){
  const m = Object.assign({}, init);
  return {
    getItem: k => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: k => { delete m[k]; },
    _dump: () => Object.assign({}, m)
  };
}

// 1) migration: no existing save -> fresh meta, no backup, slot 0 stays empty
{
  const st = fakeStorage();
  const meta = S.ensureMigrated(st, "pr_meta_save", 1000);
  assert.deepEqual(meta, { v:1, active:0, slots:[null, null, null] });
  assert.equal(st.getItem(S.BACKUP_KEY), null, "nothing to back up");
  assert.equal(st.getItem(S.slotDataKey(0)), null, "slot 0 stays empty");
}

// 2) migration: existing raw save -> backed up once, copied into slot 0 as "Slot 1", active 0
{
  const raw = JSON.stringify({ v:15, cur:{ scrap:42 } });
  const st = fakeStorage({ pr_meta_save: raw });
  const meta = S.ensureMigrated(st, "pr_meta_save", 1000);
  assert.equal(meta.active, 0);
  assert.deepEqual(meta.slots[0], { name:"Slot 1", lastPlayed:1000 });
  assert.equal(meta.slots[1], null); assert.equal(meta.slots[2], null);
  assert.equal(st.getItem(S.BACKUP_KEY), raw, "raw save backed up verbatim");
  assert.equal(st.getItem(S.slotDataKey(0)), raw, "raw save copied into slot 0");
  // idempotent: a second migration call (e.g. next boot) must not re-backup or change meta
  st.setItem("pr_meta_save", JSON.stringify({ v:15, cur:{ scrap:999 } })); // live save kept moving
  const meta2 = S.ensureMigrated(st, "pr_meta_save", 2000);
  assert.deepEqual(meta2, meta, "second call returns the same meta unchanged");
  assert.equal(st.getItem(S.BACKUP_KEY), raw, "backup is never overwritten");
}

// 3) switching slots: leaving slot snapshots the current save, target becomes active,
//    an empty target gets the supplied fresh save instead of nothing
{
  const st = fakeStorage();
  let meta = S.ensureMigrated(st, "pr_meta_save", 1000); // fresh, active 0, all empty
  const saveA = JSON.stringify({ v:15, cur:{ scrap:10 }, tag:"A" });
  const freshB = JSON.stringify({ v:15, cur:{ scrap:0 }, tag:"fresh-B" });
  const rawForB = S.switchTo(meta, st, 1, saveA, 2000, freshB);
  assert.equal(rawForB, freshB, "switching into an empty slot returns the fresh save");
  assert.equal(meta.active, 1);
  assert.deepEqual(meta.slots[0], { name:"Slot 1", lastPlayed:2000 }, "slot left behind is stamped");
  assert.equal(st.getItem(S.slotDataKey(0)), saveA, "outgoing slot's data was snapshotted");
  assert.equal(st.getItem(S.slotDataKey(1)), freshB, "new slot stores the fresh save");
  assert.deepEqual(meta.slots[1], { name:"Slot 2", lastPlayed:2000 });

  // switching back to slot 0 (non-empty) returns its stored snapshot, not freshRaw
  const saveB = JSON.stringify({ v:15, cur:{ scrap:20 }, tag:"B" });
  const rawForA = S.switchTo(meta, st, 0, saveB, 3000, "SHOULD-NOT-BE-USED");
  assert.equal(rawForA, saveA, "switching into a non-empty slot returns its own snapshot");
  assert.equal(meta.active, 0);
  assert.equal(st.getItem(S.slotDataKey(1)), saveB, "slot 1 was snapshotted on the way out");
  assert.equal(meta.slots[0].lastPlayed, 3000, "re-entered slot gets a fresh lastPlayed");

  // persisted meta round-trips through storage
  const persisted = S.readMeta(st);
  assert.deepEqual(persisted, meta);
}

// 4) deleting a slot: clears its data and descriptor, leaves the other slots untouched
{
  const st = fakeStorage();
  let meta = S.ensureMigrated(st, "pr_meta_save", 1000);
  S.touchSlot(meta, 1, 1500, JSON.stringify({ v:15, cur:{ scrap:5 } }), st);
  assert(meta.slots[1], "slot 1 now has data");
  S.deleteSlot(meta, st, 1);
  assert.equal(meta.slots[1], null, "slot 1 descriptor cleared");
  assert.equal(st.getItem(S.slotDataKey(1)), null, "slot 1 data removed");
  assert.equal(S.readMeta(st).slots[1], null, "deletion persisted");
}

// 5) rename only touches slots that have data; validation and relative-time formatting
{
  const st = fakeStorage();
  let meta = S.ensureMigrated(st, "pr_meta_save", 1000);
  assert.deepEqual(S.renameSlot(meta, st, 1, "Scavenger"), meta, "renaming an empty slot is a no-op");
  assert.equal(meta.slots[1], null);
  S.touchSlot(meta, 0, 1000, undefined, st);
  S.renameSlot(meta, st, 0, "  Night Run  ");
  assert.equal(meta.slots[0].name, "Night Run", "name trimmed");
  assert.equal(S.renameSlot(meta, st, 0, "   ").slots[0].name, "Night Run", "blank name rejected");

  assert(S.isValidSave({ v:15, cur:{ scrap:0 } }));
  assert(!S.isValidSave({ cur:{} }), "missing v rejected");
  assert(!S.isValidSave({ v:15 }), "missing cur rejected");
  assert(!S.isValidSave(null));
  assert(!S.isValidSave("not an object"));

  assert.equal(S.relativeTime(0, 1000), "Never");
  assert.equal(S.relativeTime(1000, 1000 + 30000), "Just now");
  assert.equal(S.relativeTime(1000, 1000 + 5 * 60000), "5m ago");
  assert.equal(S.relativeTime(1000, 1000 + 3 * 3600000), "3h ago");
  assert.equal(S.relativeTime(1000, 1000 + 2 * 86400000), "2d ago");
}

console.log("save-slots.test: ok");
