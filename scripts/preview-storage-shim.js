// Deployed only in the Archipelago v2 preview. Keeps preview saves out of
// the production site's localStorage/sessionStorage on the shared Pages origin.
(() => {
  'use strict';
  const prefix = 'protocol-rebirth:preview-pr247:';
  const storage = Storage.prototype;
  const native = {
    getItem: storage.getItem,
    setItem: storage.setItem,
    removeItem: storage.removeItem,
    clear: storage.clear,
    key: storage.key,
  };
  const scoped = (key) => prefix + String(key);
  storage.getItem = function (key) { return native.getItem.call(this, scoped(key)); };
  storage.setItem = function (key, value) { return native.setItem.call(this, scoped(key), value); };
  storage.removeItem = function (key) { return native.removeItem.call(this, scoped(key)); };
  storage.clear = function () {
    // A preview reset must never clear main's save slots.
    for (let index = this.length - 1; index >= 0; --index) {
      const key = native.key.call(this, index);
      if (key && key.startsWith(prefix)) native.removeItem.call(this, key);
    }
  };
  storage.key = function (index) {
    let seen = 0;
    for (let i = 0; i < this.length; ++i) {
      const key = native.key.call(this, i);
      if (key && key.startsWith(prefix)) {
        if (seen === Number(index)) return key.slice(prefix.length);
        ++seen;
      }
    }
    return null;
  };
})();
