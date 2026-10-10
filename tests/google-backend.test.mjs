import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {randomUUID,pbkdf2Sync} from 'node:crypto';
const properties={PHOTO_FOLDER:'photos',SETUP_KEY:'test-only-key'};const tables=new Map(),ids=new Map();let nextId=1;const files=new Map();
const props={getProperty:k=>properties[k]||null,setProperty:(k,v)=>{properties[k]=v},deleteProperty:k=>delete properties[k],getProperties:()=>({...properties})};
function sheet(name){if(!tables.has(name)){const s={id:nextId++,rows:[],getSheetId(){return this.id},getLastRow(){return this.rows.length+1},getMaxRows:()=>1000,getRange(){return {getValues:()=>this.rows.map(r=>[r.id||r.name,'',JSON.stringify(r),...Array(9).fill('')])}}};tables.set(name,s);ids.set(s.id,s)}return tables.get(name)}
const ss={getSheetByName:sheet,getId:()=> 'test'};
const blob=(data,type)=>({getBytes:()=>Array.from(typeof data==='string'?Buffer.from(data):data,n=>n>127?n-256:n),getContentType:()=>type});
const context=vm.createContext({console,Uint8Array,Uint32Array,DataView,ArrayBuffer,TextEncoder,Set,Map,Date,Intl,JSON,Error,Object,Number,String,Math,encodeURIComponent,decodeURIComponent,
 Utilities:{getUuid:randomUUID,newBlob:blob,base64Decode:s=>Array.from(Buffer.from(s,'base64')),base64Encode:b=>Buffer.from(b.map(n=>n&255)).toString('base64')},
 PropertiesService:{getScriptProperties:()=>props},SpreadsheetApp:{openById:()=>ss},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},CacheService:{getScriptCache:()=>({get:()=>null,put(){}})},ScriptApp:{getOAuthToken:()=> 'private-test-token'},
 ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})},
 DriveApp:{getFolderById:()=>({createFile:b=>{const id=randomUUID();files.set(id,b);return {getId:()=>id}}}),getFileById:id=>({getBlob:()=>files.get(id)})},
 Sheets:{Spreadsheets:{batchUpdate:({requests})=>{for(const req of requests){if(req.updateCells){const update=req.updateCells;ids.get(update.range.sheetId).rows=update.rows.map(r=>JSON.parse(r.values.slice(2).map(c=>c.userEnteredValue.stringValue).join('')))}}return {}}}}
});
vm.runInContext(fs.readFileSync('google-backend/Code.gs','utf8'),context);
const request=(path,body,token='',extra={})=>context.doPost({postData:{contents:JSON.stringify({path,method:body?'POST':'GET',body,token,...extra})}});
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r));return r.body};
assert.equal(context.GAS_HASH('password','salt'),pbkdf2Sync('password','salt',100000,32,'sha256').toString('hex'));
assert.equal(request('/api/action',{action:'setup',username:'owner',password:'Test-password-123',name:'Owner'}).status,401);
let manager=ok(request('/api/action',{action:'setup',username:'owner',password:'Test-password-123',name:'Owner'},'',{setupKey:'test-only-key'})).sessionToken;assert(manager);
for(const role of ['moderator','designer','production','distributor','crm'])ok(request('/api/action',{action:'user',name:role,username:role,password:'Test-password-123',roles:[role]},manager));
const tokens=Object.fromEntries(['moderator','designer','production','distributor','crm'].map(role=>[role,ok(request('/api/action',{action:'login',username:role,password:'Test-password-123'})).sessionToken]));
const order={customer:'Test',phone:'0123',address:'Test address',product:'Clicky',quantity:1,cost:100,orderDate:'2026-10-11',priority:'Normal'};
ok(request('/api/action',{action:'order',data:order},tokens.moderator));const first=ok(request('/api/action',null,tokens.moderator)).orders[0];
assert.equal(ok(request('/api/action',null,tokens.production)).orders.length,0);
ok(request('/api/action',{action:'status',id:first.id,status:'Designed'},tokens.designer));
assert.equal(request('/api/action',{action:'status',id:first.id,status:'Prepared'},tokens.production).status,400);
const photo=ok(request('/api/photo',{purpose:'production',orderId:first.id},tokens.production,{file:{type:'image/png',data:Buffer.from('testimage').toString('base64')}})).url;
ok(request('/api/action',{action:'status',id:first.id,status:'Prepared',productionPhotos:[photo]},tokens.production));
ok(request('/api/action',{action:'status',id:first.id,status:'Delivered'},tokens.distributor));
assert.equal(request('/api/workflow',{action:'reproduce',id:first.id,startStatus:'Designed',reason:'Valid manufacturing defect',verified:true},tokens.crm).status,403);
const replacement=ok(request('/api/workflow',{action:'reproduce',id:first.id,startStatus:'Designed',reason:'Valid manufacturing defect',verified:true},tokens.moderator));
assert(ok(request('/api/action',null,tokens.production)).orders.some(o=>o.id===replacement.id&&o.reproduction&&o.cost===0));
const original=ok(request('/api/action',null,manager)).orders.find(o=>o.id===first.id);assert(original.history.some(h=>h.relatedOrderId===replacement.id));
ok(request('/api/workflow',{action:'request_change',id:replacement.id,kind:'Status',proposedStatus:'Pending',reason:'Wrong department selected'},tokens.production));
const req=ok(request('/api/action',null,manager)).requests[0];ok(request('/api/workflow',{action:'review',requestId:req.id,decision:'Approved'},manager));
assert(ok(request('/api/action',null,tokens.designer)).orders.some(o=>o.id===replacement.id));
ok(request('/api/finance',{action:'expense',data:{date:'2026-10-11',category:'Filament',description:'PLA',quantity:1,unitCost:20}},manager));
const report=ok(request('/api/finance?from=2026-10-01&to=2026-10-31&group=month&basis=order',null,manager));assert.equal(report.expenses.length,1);
assert.equal(request('/api/finance',null,tokens.production).status,403);
assert.equal(ok(request(photo,null,tokens.crm)).type,'image/png');
ok(request('/api/action',{action:'logout'},manager));assert.equal(ok(request('/api/action',null,manager)).user,null);
console.log('PASS Google backend: PBKDF2 compatibility, private login, roles, production proof, delivery, replacement routing/history, correction approval, finance, private photos, logout.');
