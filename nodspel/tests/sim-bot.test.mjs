// Headless difficulty-bot sim (docs/difficulty-bots.md §4, tools/difficulty-bots/sim.mjs): a fast,
// fixed-seed smoke test, not a balance check (that is tools/difficulty-bots/tune.mjs's job).
import test from 'node:test';
import assert from 'node:assert/strict';
import {runRaid,TIERS} from '../../tools/difficulty-bots/sim.mjs';

const SEEDS=['sim-bot-a','sim-bot-b','sim-bot-c'];

test('a raid run twice on the same seed and tier is bit-for-bit deterministic',()=>{
  for(const seed of SEEDS){
    const a=runRaid({tier:'strong',seed});
    const b=runRaid({tier:'strong',seed});
    assert.deepEqual(a,b,`seed ${seed} must replay identically`);
  }
});

test('FTUE raid 3 (the shipped lethal-clamp guarantee) always survives and extracts, every tier',()=>{
  for(const tier of Object.keys(TIERS)){
    for(const seed of SEEDS){
      const r=runRaid({tier,seed,ftueAttempt:2});
      assert.equal(r.survived,true,`${tier}/${seed} must survive the guaranteed FTUE raid 3`);
      assert.equal(r.extracted,true,`${tier}/${seed} must extract the guaranteed FTUE raid 3`);
      assert.equal(r.timedOut,false);
    }
  }
});

test('the strong tier clears the FTUE raids quickly and never runs past the sim safety cap',()=>{
  for(const seed of SEEDS){
    for(let attempt=0;attempt<3;attempt++){
      const r=runRaid({tier:'strong',seed,ftueAttempt:attempt});
      assert.equal(r.timedOut,false,`${seed} attempt ${attempt} must not hit the sim's own safety cap`);
      assert.equal(r.extracted,true);
      assert.ok(r.timeToExtractSec<60,'a precise, no-error-aim bot clears the tiny FTUE room in well under a minute');
    }
  }
});

test('a normal (non-FTUE) raid runs and reports well-formed metrics',()=>{
  for(const tier of Object.keys(TIERS)){
    const r=runRaid({tier,seed:'sim-bot-normal'});
    assert.ok(['death','timeout','extract','complete'].includes(r.reason));
    assert.equal(r.timedOut,false);
    assert.ok(r.levelReached>=1&&r.levelReached<=3);
    assert.ok(r.damageTakenPct>=0&&r.damageTakenPct<=100);
    assert.ok(Number.isInteger(r.kills)&&r.kills>=0);
    assert.ok(r.ttkSecList.every(t=>t>=0));
  }
});
