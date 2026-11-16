import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attendanceRate,patrolTotals,mergeSnapshot,scoreboard,validSeason,type Season,type ScoutStats} from '../src/statsModel.ts';
const scout:ScoutStats={userId:'s',name:'Scout',patrolId:'p',attended:3,missed:1,completed:2,awarded:1,tardy:1,extra:{service:4}};
const season:Season={id:'one',name:'Season one',start:'2026-09-01',end:'2027-08-31',patrols:[{id:'p',name:'Panthère',symbol:'panthere',active:true,points:20}],scouts:[scout]};
test('attendance distinguishes missing data from a true zero percent',()=>{
 assert.equal(attendanceRate(scout),75);assert.equal(attendanceRate({...scout,attended:0}),0);assert.equal(attendanceRate({...scout,attended:null}),null);assert.equal(attendanceRate({...scout,attended:0,missed:0}),null);
});
test('season dates reject invalid calendar dates and reversed ranges',()=>{
 assert.equal(validSeason('Samurai','2026-09-01','2027-08-31'),true);for(const [name,start,end] of [['','2026-01-01','2027-01-01'],['x','2026-02-30','2026-03-01'],['x','2027-01-01','2026-01-01']])assert.equal(validSeason(name,start,end),false);
});
test('refresh keeps historical membership, manual tardiness, extension metrics and scores',()=>{
 const next=mergeSnapshot(season,{scouts:[{...scout,patrolId:'new',attended:8,tardy:null}],patrols:[{id:'p',name:'Panthère',symbol:'panthere'},{id:'new',name:'Gazelle',symbol:'gazelle'}]});
 assert.equal(next.scouts[0].patrolId,'p');assert.equal(next.scouts[0].attended,8);assert.equal(next.scouts[0].tardy,1);assert.deepEqual(next.scouts[0].extra,{service:4});assert.equal(next.patrols[0].points,20);assert.equal(next.patrols[1].points,null);assert.equal(next.patrols[1].active,true);assert.equal(season.scouts[0].attended,3);
 const removed=mergeSnapshot(season,{scouts:[],patrols:[]});assert.equal(removed.scouts.length,1);assert.equal(removed.patrols[0].active,false);
});
test('scoreboard filters inactive patrols, preserves ties and distinguishes unscored from zero',()=>{
 const rows=scoreboard({...season,patrols:[...season.patrols,{id:'g',name:'Gazelle',symbol:'gazelle',active:true,points:20},{id:'l',name:'Lion',symbol:'lion',active:true,points:0},{id:'r',name:'Renard',symbol:'renard',active:false,points:99},{id:'w',name:'Loup',symbol:'loup',active:true,points:null}]});
 assert.deepEqual(rows.map(p=>[p.name,p.rank]),[['Gazelle',1],['Panthère',1],['Lion',3],['Loup',null]]);
});

test('patrol totals combine members while preserving unknown stats and server aggregates',()=>{
 const totals=patrolTotals({...season,scouts:[scout,{...scout,userId:'other',attended:5,missed:1,tardy:null}]});assert.equal(totals[0].members,2);assert.equal(totals[0].attended,8);assert.equal(attendanceRate(totals[0]),80);assert.equal(totals[0].tardy,1);
 assert.equal(patrolTotals({...season,scouts:[]})[0].attended,null);
 const projected=patrolTotals({...season,scouts:[scout],patrolSummaries:[{id:'p',members:2,attended:8,missed:2,completed:4,awarded:2,tardy:1}]});assert.equal(projected[0].attended,8);assert.equal(projected[0].members,2);
});
