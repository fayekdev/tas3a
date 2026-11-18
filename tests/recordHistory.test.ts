import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordedTotals,type ScoutRecordHistory} from '../src/recordHistory.ts';
const base:ScoutRecordHistory={userId:'scout',name:'Scout',scoutRole:'TP',patrolName:'Gazelle',patrolSymbol:'gazelle',attendance:[],progress:[],presentations:[]};
test('full-history totals retain older attendance and undated awards without assigning dates',()=>{
 const records:ScoutRecordHistory={...base,attendance:[{date:'2026-11-13',status:'present',lateMinutes:7,source:'leadership',updatedAt:null},{date:'2026-11-06',status:'absent',lateMinutes:null,source:'legacy',updatedAt:null}],presentations:[{badgeId:'b0',title:'Badge',status:'awarded',presentationDate:null,requestedAt:'2026-11-14T00:00:00Z'}]};
 assert.deepEqual(recordedTotals(records,'2026-11-18'),{attended:1,missed:1,tardy:1,lateMinutes:7,awarded:1,undatedAwards:1,rate:50});assert.equal(records.presentations[0].presentationDate,null);
});
test('empty history means zero saved records and no attendance percentage',()=>{assert.deepEqual(recordedTotals(base,'2026-11-18'),{attended:0,missed:0,tardy:0,lateMinutes:0,awarded:0,undatedAwards:0,rate:null});});
test('future attendance is shown in history but not counted as attended today',()=>{assert.equal(recordedTotals({...base,attendance:[{date:'2026-12-01',status:'present',lateMinutes:5,source:'legacy',updatedAt:null}]},'2026-11-18').attended,0);});
