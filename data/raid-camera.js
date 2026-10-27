// Shared orthographic camera geometry for rendering and spawn visibility checks.
var RAID_CAMERA_ROOT = typeof window !== 'undefined' ? window : globalThis;
RAID_CAMERA_ROOT.DATA = RAID_CAMERA_ROOT.DATA || {};
RAID_CAMERA_ROOT.DATA.raidCamera = Object.freeze({
  halfHeight: 6,
  near: .1,
  far: 100,
  offset: { x: 17, y: 23, z: 17 },
  targetOffsetZ: -1,
  followRate: 6,
});
