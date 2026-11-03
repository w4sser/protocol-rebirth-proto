# Every bug fix adds a lint rule or a test

Convention (since v2.22.5): a PR that fixes a bug also adds a guard that would have caught it.

- Prefer a **static rule** in `scripts/bug-lint.mjs` (cheap, runs in `npm test` via `test:bug-lint`). Each rule has `id`, `pr` (the PR/bug it guards) and `why`.
- If it can't be caught statically, add a **cheap unit test** (`test/` or `nodspel/tests/`) and reference the PR in a comment.
- Per-frame allocation regressions belong in `scripts/hot-alloc-lint.mjs` (`// @hot` headers).
- Add a fixture case in `test/bug-lint.test.mjs` so the rule is proven to fire.

Current rules: no tracked node_modules (#129), ogg/m4a audio pairs (#162), cache-busted local imports (#154), CI scripts stub FTUE direct launch (#173), transparent DoubleSide single-pass (#178), single APP_VERSION (#69).
