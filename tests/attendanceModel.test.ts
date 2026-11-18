import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canTrackAttendance,recentFriday,validMark} from '../src/attendanceModel.ts';
import {roles} from '../src/domain.ts';
test('the attendance tracker permits only the two leadership roles',()=>{
  assert.deepEqual(roles.filter(canTrackAttendance),['Chief','Assistant']);assert.equal(canTrackAttendance(undefined),false);
});
test('register marks enforce whole minutes and exclude late absences or cleared marks',()=>{
  assert.equal(validMark({userId:'scout',status:'present',lateMinutes:0}),true);assert.equal(validMark({userId:'scout',status:'present',lateMinutes:1440}),true);
  for(const lateMinutes of [NaN,-1,1.5,1441])assert.equal(validMark({userId:'scout',status:'present',lateMinutes}),false);
  assert.equal(validMark({userId:'scout',status:'absent',lateMinutes:4}),false);assert.equal(validMark({userId:'scout',status:null,lateMinutes:1}),false);
});
test('the register defaults to the latest Friday across week and year boundaries',()=>{
  assert.equal(recentFriday('2026-11-18'),'2026-11-13');assert.equal(recentFriday('2026-11-13'),'2026-11-13');assert.equal(recentFriday('2027-01-01'),'2027-01-01');assert.equal(recentFriday('2026-01-01'),'2025-12-26');
});
