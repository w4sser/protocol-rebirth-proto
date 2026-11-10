// @hot triggerBitThreat triggerBitDamage triggerBitLoot triggerBitExtract triggerBitFailure currentBitExpression bitExpressionPresentation bitExpressionFace combatIsHot
// M40 (docs/art-direction.md "M40 -- BIT Expression Without Losing Its Identity"): a small, testable
// event -> expression state machine. This module is presentation only -- it never touches combat,
// healing or loot state, and never grants an ability. game.mjs feeds it plain facts it already
// computed (a nearby threat, a real hit this frame, a valuable pickup, extract open, raid failure)
// and reads back which state is showing and its face/brightness presentation.
// M42 (docs/design-decisions.md "M42"): Robert rejected grow/recoil/hop/scale body motion on the M40
// preview. Reactions are face-only now -- absolute eye/mouth recipes drawn inside the CRT screen, never
// a multiplier on hover/tilt/scale. bitExpressionFace returns the whole recipe for one frame so game.mjs
// never has to guess an intermediate value.
import {RULES} from './levels.js?v=2.28.12';
export const BIT_EXPRESSIONS=['idle','threat','damage','loot','extract','failure'];
// failure/damage outrank loot; shooting threats outrank explore (docs/art-direction.md "M40"); extract
// sits with loot as another "yield to combat" flourish. Not a ranked design vote -- an implementation
// detail needed so one real event doesn't get cut short by a lower-urgency one.
const PRIORITY={idle:0,loot:2,extract:2,threat:3,damage:4,failure:5};
function expressionTuning(){return RULES.bit.expression;}
function activePriority(expr,now){return now<expr.until?PRIORITY[expr.state]:0;}
export function createBitExpression(){
  return {state:'idle',until:0,startedAt:0,forcedUntil:0,cooldownThreat:0,cooldownDamage:0,cooldownLoot:0,cooldownExtract:0,cooldownFailure:0};
}
// The state the caller should actually present right now (decays to idle once `until` passes).
export function currentBitExpression(expr,now){return now<expr.until?expr.state:'idle';}
// Screen brightness only (M42: grow/tilt/hop/punch are gone -- see bitExpressionFace for the face).
export function bitExpressionPresentation(expr,now){return expressionTuning().presentation[currentBitExpression(expr,now)];}
// M42 authored face recipes (docs/design-decisions.md "M42" Q4): absolute eye box + mouth kind per state,
// never a multiplier on the previous frame. Eye boxes mirror around x=0; mouth shape lives in MOUTH_DEPTH.
const FACES={
  idle:   {eyeX:.14, eyeY:.76, eyeW:.047,eyeH:.09, mouth:'smile'},
  threat: {eyeX:.12, eyeY:.76, eyeW:.050,eyeH:.070,mouth:'flat'},
  damage: {eyeX:.14, eyeY:.73, eyeW:.047,eyeH:.08, mouth:'frown'},
  loot:   {eyeX:.135,eyeY:.77, eyeW:.052,eyeH:.085,mouth:'bigSmile'},
  extract:{eyeX:.14, eyeY:.76, eyeW:.047,eyeH:.09, mouth:'softSmile'},
  failure:{eyeX:.14, eyeY:.735,eyeW:.047,eyeH:.048,mouth:'sad'},
};
// Signed mouth depth for the 17-point authored curve (y = .65 - depth*sin(t*pi)): positive dips the
// middle down (a smile's corners lift), negative lifts the middle (a frown/sad droop).
const MOUTH_DEPTH={smile:.065,flat:.006,frown:-.05,bigSmile:.095,softSmile:.035,sad:-.025};
export function bitExpressionFace(state){return FACES[state]??FACES.idle;}
export function mouthDepth(mouth){return MOUTH_DEPTH[mouth]??MOUTH_DEPTH.smile;}
// Anti-spam: a nearby aggressive/telegraphing enemy. Re-armed by its own cooldown, so a persistent
// threat blips rather than holding the state (or spamming a retrigger) every single frame.
export function triggerBitThreat(expr,now){
  const t=expressionTuning();if(now<(expr.forcedUntil||0)||now<expr.cooldownThreat||PRIORITY.threat<activePriority(expr,now))return false;
  if(expr.state==='threat'&&now<expr.until)return false;
  expr.state='threat';expr.until=now+t.durationMs.threat;expr.startedAt=now;expr.cooldownThreat=now+t.cooldownMs.threat;return true;
}
// Edge-triggered by the caller (the same fact as the existing human?.hit() path); repeat hits are
// allowed to refresh it since each one is a genuine new event, not a held condition.
export function triggerBitDamage(expr,now){
  const t=expressionTuning();if(now<(expr.forcedUntil||0)||now<expr.cooldownDamage||PRIORITY.damage<activePriority(expr,now))return false;
  expr.state='damage';expr.until=now+t.durationMs.damage;expr.startedAt=now;expr.cooldownDamage=now+t.cooldownMs.damage;return true;
}
// `quiet` is true during an intense firefight (combatIsHot): loot/extract flourishes yield to combat
// readability per docs/art-direction.md "Mobile Visual Hierarchy", so the event is simply skipped --
// not queued -- rather than competing with enemy silhouettes and telegraphs.
export function triggerBitLoot(expr,now,quiet){
  const t=expressionTuning();if(now<(expr.forcedUntil||0)||quiet||now<expr.cooldownLoot||PRIORITY.loot<activePriority(expr,now))return false;
  expr.state='loot';expr.until=now+t.durationMs.loot;expr.startedAt=now;expr.cooldownLoot=now+t.cooldownMs.loot;return true;
}
export function triggerBitExtract(expr,now,quiet){
  const t=expressionTuning();if(now<(expr.forcedUntil||0)||quiet||now<expr.cooldownExtract||PRIORITY.extract<activePriority(expr,now))return false;
  if(expr.state==='extract'&&now<expr.until)return false;
  expr.state='extract';expr.until=now+t.durationMs.extract;expr.startedAt=now;expr.cooldownExtract=now+t.cooldownMs.extract;return true;
}
// No quiet gate and effectively no cooldown reset within one raid: death/timeout is the terminal
// event and nothing should outrank or re-suppress it until the next round resets this state.
export function triggerBitFailure(expr,now){
  const t=expressionTuning();if(now<(expr.forcedUntil||0)||now<expr.cooldownFailure)return false;
  expr.state='failure';expr.until=now+t.durationMs.failure;expr.startedAt=now;expr.cooldownFailure=now+t.cooldownMs.failure;return true;
}
// Playtest-default "intense firefight" heuristic (not a new design vote): two or more aware enemies
// nearby, or any of them mid-telegraph. Used only to decide whether loot/extract flourishes yield.
export function combatIsHot(nearbyAggroCount,telegraphNear){return nearbyAggroCount>=RULES.bit.hotAggroCount||telegraphNear;}
// Debug-only (window.__NR.bitExpress under ?debug=1): force a state for QA screenshots, bypassing
// priority/cooldown entirely. 'idle' clears back immediately.
export function forceBitExpression(expr,id,now,durationMs=4000){
  if(id==='idle'){expr.state='idle';expr.until=now;expr.startedAt=0;expr.forcedUntil=0;return true;}
  if(!BIT_EXPRESSIONS.includes(id))return false;
  expr.state=id;expr.until=now+durationMs;expr.startedAt=now;expr.forcedUntil=now+durationMs;return true;
}
