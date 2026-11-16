// Loaded before either game's scripts. The existing Dev Panel opts into a separate
// storage namespace; normal play never reads these saves or raid results.
(() => {
  'use strict';
  const valid = value => value === 'worlds' || value === 'all';
  const requested = new URLSearchParams(window.location.search).get('debugMode');
  const mode = valid(requested) ? requested : null;
  const prefixFor = value => 'protocol-rebirth:debug:' + value + ':';
  const proto = Storage.prototype;
  // Capture the current methods, so an already-installed preview namespace stays intact.
  const native = {getItem:proto.getItem, setItem:proto.setItem, removeItem:proto.removeItem, key:proto.key};
  function keys(storage, prefix) {
    const out = [];
    for(let i = 0; i < storage.length; i++) {
      const key = native.key.call(storage, i);
      if(key && key.startsWith(prefix)) out.push(key);
    }
    return out;
  }
  function withMode(url, selected = mode) {
    const [pathAndQuery, hash] = String(url).split('#');
    const [path, query] = pathAndQuery.split('?');
    const params = new URLSearchParams(query || '');
    params.delete('debugMode');
    if(valid(selected)) params.set('debugMode', selected);
    return path + (params.size ? '?' + params.toString() : '') + (hash ? '#' + hash : '');
  }
  function seed(selected, raw) {
    if(!valid(selected)) throw new Error('Unknown debug mode');
    const prefix = prefixFor(selected);
    // Write first: quota/storage denial must not navigate into an unseeded session.
    native.setItem.call(window.localStorage, prefix + 'pr_meta_save', raw);
    for(const storage of [window.localStorage, window.sessionStorage]) {
      for(const key of keys(storage, prefix)) {
        if(storage !== window.localStorage || key !== prefix + 'pr_meta_save') native.removeItem.call(storage, key);
      }
    }
  }
  if(mode) {
    const prefix = prefixFor(mode);
    proto.getItem = function(key) { return native.getItem.call(this, prefix + String(key)); };
    proto.setItem = function(key, value) { return native.setItem.call(this, prefix + String(key), value); };
    proto.removeItem = function(key) { return native.removeItem.call(this, prefix + String(key)); };
    proto.key = function(index) { const key = keys(this, prefix)[Number(index)]; return key ? key.slice(prefix.length) : null; };
    proto.clear = function() { for(const key of keys(this, prefix)) native.removeItem.call(this, key); };
  }
  window.PR_DEBUG = {mode, withMode, seed,
    normalSave:() => native.getItem.call(window.localStorage, 'pr_meta_save')};
})();
