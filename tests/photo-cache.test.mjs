import assert from 'node:assert/strict';import ts from 'typescript';import fs from 'node:fs';
const {cachedPhoto,clearPhotoCache}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpile(fs.readFileSync('lib/photo-cache.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext})).toString('base64'));
let calls=0;const load=async()=>{calls++;return new Blob(['photo'])};
await Promise.all([cachedPhoto('a',load),cachedPhoto('a',load)]);await cachedPhoto('a',load);assert.equal(calls,1);
clearPhotoCache();await cachedPhoto('a',load);assert.equal(calls,2);
let finish;const old=cachedPhoto('old',()=>new Promise(r=>{finish=r}));clearPhotoCache();finish(new Blob(['old']));await assert.rejects(old,/Session changed/);
const now=Date.now;let time=now();Date.now=()=>time;await cachedPhoto('ttl',load);const count=calls;time+=61000;await cachedPhoto('ttl',load);assert.equal(calls,count+1);Date.now=now;
await assert.rejects(cachedPhoto('fail',()=>Promise.reject(Error('no access'))));await cachedPhoto('fail',load);
console.log('PASS private photo cache: deduplication, logout/session invalidation, expiry and failed request retry.');
