import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attendanceAllowed} from '../src/schedule.ts';
import {morsePulses} from '../src/morseTiming.ts';
test('attendance accepts Fridays and admin dates; rejects other, future and invalid dates',()=>{
 assert.equal(attendanceAllowed('2026-11-13',[],'2026-11-14'),true);
 assert.equal(attendanceAllowed('2026-11-12',[],'2026-11-14'),false);
 assert.equal(attendanceAllowed('2026-11-12',['2026-11-12'],'2026-11-14'),true);
 assert.equal(attendanceAllowed('2026-11-20',[],'2026-11-14'),false);
 assert.equal(attendanceAllowed('2026-02-30',['2026-02-30'],'2026-11-14'),false);
});
test('light Morse uses 1/3 unit pulses and 1/3/7 unit gaps',()=>{
 assert.deepEqual(morsePulses('.- . / -',12),[{on:true,ms:100},{on:false,ms:100},{on:true,ms:300},{on:false,ms:300},{on:true,ms:100},{on:false,ms:700},{on:true,ms:300}]);
});
