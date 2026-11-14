import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {morse} from '../src/domain.ts';
const catalog=JSON.parse(readFileSync(new URL('../src/catalog.json',import.meta.url),'utf8'));
test('all 78 original badges have unique IDs, requirements and local source scans',()=>{
  assert.equal(catalog.length,78);assert.equal(new Set(catalog.map((b:any)=>b.id)).size,78);
  for(const b of catalog){assert.ok(b.en&&b.ar);assert.ok(b.requirements.length>0);assert.ok(b.requirements.every((r:any)=>r.ar||r.en));assert.ok(existsSync(new URL('../public'+b.source,import.meta.url)));}
  assert.equal(catalog.find((b:any)=>b.id==='b0').requirements.length,6);
});
test('Arabic Morse roundtrips without mixing Latin interpretations',()=>{
  assert.equal(morse('سلام',false,'ar'),'... .-.. .- --');
  assert.equal(morse('... .-.. .- --',true,'ar'),'سلام');
  assert.equal(morse('أ إ آ',false,'ar'),'.- / .- / .-');
  assert.equal(morse('؟',false,'ar'),'�');
});
