// v2.8.0 SAVE SLOTS: pure functions over a storage object (anything shaped like localStorage —
// getItem/setItem/removeItem). No DOM, no globals beyond what is passed in, so it is testable
// standalone (test/save-slots.test.js) and usable from both app.js (browser) and plain Node.
"use strict";

const SLOTS_META_KEY = "pr_slots_v1";
const BACKUP_KEY = "pr_save_backup_pre_slots";
const SLOT_COUNT = 3;
const slotDataKey = i => "pr_slot_" + i + "_save";

function freshMeta(){ return { v:1, active:0, slots:[null, null, null] }; }

function readMeta(storage){
  try{
    const raw = storage.getItem(SLOTS_META_KEY);
    if(!raw) return null;
    const m = JSON.parse(raw);
    if(m && typeof m === "object" && Array.isArray(m.slots) && m.slots.length === SLOT_COUNT && Number.isInteger(m.active)) return m;
  }catch(e){}
  return null;
}
function writeMeta(storage, meta){ try{ storage.setItem(SLOTS_META_KEY, JSON.stringify(meta)); }catch(e){} }

// First boot with no slots meta: back up the existing raw save once (never overwritten again),
// copy it into slot 0 as "Slot 1", active=0. Idempotent — a second call just returns the same meta.
function ensureMigrated(storage, saveKey, now){
  const existing = readMeta(storage);
  if(existing) return existing;
  const raw = storage.getItem(saveKey);
  const meta = freshMeta();
  if(raw != null){
    if(storage.getItem(BACKUP_KEY) == null) try{ storage.setItem(BACKUP_KEY, raw); }catch(e){}
    try{ storage.setItem(slotDataKey(0), raw); }catch(e){}
    meta.slots[0] = { name:"Slot 1", lastPlayed: now };
  }
  writeMeta(storage, meta);
  return meta;
}

function readSlotRaw(storage, i){ try{ return storage.getItem(slotDataKey(i)); }catch(e){ return null; } }
function writeSlotRaw(storage, i, raw){ try{ storage.setItem(slotDataKey(i), raw); }catch(e){} }
function clearSlotRaw(storage, i){ try{ storage.removeItem(slotDataKey(i)); }catch(e){} }

// Stamp a slot as played-now; creates the slot descriptor (default name) if it didn't exist yet.
// `raw`, when given, is also written as that slot's snapshot.
function touchSlot(meta, i, now, raw, storage){
  if(!meta.slots[i]) meta.slots[i] = { name:"Slot " + (i + 1), lastPlayed: now };
  else meta.slots[i].lastPlayed = now;
  if(raw !== undefined) writeSlotRaw(storage, i, raw);
  writeMeta(storage, meta);
  return meta;
}

function renameSlot(meta, storage, i, name){
  name = String(name == null ? "" : name).trim().slice(0, 24);
  if(!name || !meta.slots[i]) return meta;
  meta.slots[i].name = name;
  writeMeta(storage, meta);
  return meta;
}

function deleteSlot(meta, storage, i){
  meta.slots[i] = null;
  clearSlotRaw(storage, i);
  writeMeta(storage, meta);
  return meta;
}

// Switch the active slot to `target`. Saves `currentRaw` into the slot being left, then returns
// the raw save that should become the live save: the target's existing snapshot, or — if the
// target is empty — `freshRaw` (a brand-new game, written into that slot as it becomes active).
function switchTo(meta, storage, target, currentRaw, now, freshRaw){
  touchSlot(meta, meta.active, now, currentRaw, storage);
  let raw = readSlotRaw(storage, target);
  if(raw == null){
    raw = freshRaw;
    meta.slots[target] = { name:"Slot " + (target + 1), lastPlayed: now };
    writeSlotRaw(storage, target, raw);
  } else {
    meta.slots[target].lastPlayed = now;
  }
  meta.active = target;
  writeMeta(storage, meta);
  return raw;
}

function isValidSave(obj){
  return !!obj && typeof obj === "object" && typeof obj.v === "number" && obj.cur && typeof obj.cur === "object";
}

function relativeTime(ms, now){
  if(!ms) return "Never";
  const d = Math.max(0, now - ms), m = Math.floor(d / 60000);
  if(m < 1) return "Just now";
  if(m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if(h < 24) return h + "h ago";
  const days = Math.floor(h / 24);
  if(days < 7) return days + "d ago";
  return new Date(ms).toLocaleDateString();
}

const api = {
  SLOTS_META_KEY, BACKUP_KEY, SLOT_COUNT, slotDataKey,
  freshMeta, readMeta, writeMeta, ensureMigrated,
  readSlotRaw, writeSlotRaw, clearSlotRaw,
  touchSlot, renameSlot, deleteSlot, switchTo,
  isValidSave, relativeTime
};
if(typeof module !== "undefined") module.exports = api;
if(typeof window !== "undefined") window.SaveSlots = api;
