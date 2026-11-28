// BIT's dry one-liners for the non-blocking move/shoot hints (PR 3, docs/bit-narrator.md). BIT stays
// silent during the scripted FTUE raid (it is only met in the bunker after extraction -- see the
// comment in data/raid-ftue.js) -- these two lines are for the cohort that already met BIT: a fresh
// profile's first *ordinary* raid (nodspel/game.mjs gates the show() call on !launch.ftue).
export const FTUE_HINT_MOVE_BIT_LINE="Left thumb walks. Right thumb shoots. It is less complicated than it sounds.";
export const FTUE_HINT_AIM_BIT_LINE="Tap to auto-aim. Drag if you have opinions.";
