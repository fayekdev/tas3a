import { test } from 'node:test';
import assert from 'node:assert/strict';
import { morse, validatePatrol, roles } from '../src/domain.ts';
test('Morse preserves words and numbers in both directions',()=>{assert.equal(morse(morse('SOS BE PREPARED 2026',false),true),'SOS BE PREPARED 2026');});
test('Morse reports unsupported input instead of dropping it',()=>{assert.equal(morse('Hi!',false),'.... .. �');assert.equal(morse('......',true),'�');assert.equal(morse('   ',false),'');});
test('Patrouille validation rejects blank names and oversized text',()=>{assert.ok(validatePatrol('  ',''));assert.ok(validatePatrol('a'.repeat(61),''));assert.ok(validatePatrol('Eagles','a'.repeat(161)));assert.equal(validatePatrol('  النسور  ','معًا'),null);});
test('All six user-requested roles are preserved',()=>{assert.deepEqual(roles,['Chief','Assistant','CP','SP','TP','Patrouillard']);});
