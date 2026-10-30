import test from 'node:test';import assert from 'node:assert/strict';
import {CHARACTERS,overheadAnchorY} from '../characters.js';
test('operator pips sit above the scaled head',()=>{const c=CHARACTERS.operator;assert.ok(overheadAnchorY(c)>=c.height*c.scale+0.15);assert.ok(overheadAnchorY(c)<3);});
test('anchor never drops below legacy 1.65',()=>{for(const c of Object.values(CHARACTERS))assert.ok(overheadAnchorY(c)>=1.65);});
