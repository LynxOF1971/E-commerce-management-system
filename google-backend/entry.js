import {SheetDB,SCHEMA} from './database';
import {pbkdf2} from '../vendor/noble-hashes/pbkdf2.js';
import {sha256} from '../vendor/noble-hashes/sha256.js';
import * as action from '../app/api/action/route';
import * as workflow from '../app/api/workflow/route';
import * as finance from '../app/api/finance/route';
import * as photo from '../app/api/photo/route';
const spreadsheetId=()=>PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
const bytes=s=>new Uint8Array(Utilities.newBlob(s).getBytes().map(n=>n&255));
const hex=a=>Array.from(a,n=>n.toString(16).padStart(2,'0')).join('');
globalThis.GAS_HASH=(p,s)=>hex(pbkdf2(sha256,bytes(p),bytes(s),{c:100000,dkLen:32}));
globalThis.GAS_DIGEST=s=>hex(sha256(bytes(s)));
globalThis.GAS_ALL=a=>a;
globalThis.crypto={randomUUID:()=>Utilities.getUuid()};
globalThis.URL=class{constructor(path,base){const full=path.startsWith('http')?path:(base||'https://kdfy.local')+path;this.origin=full.match(/^https?:\/\/[^/]+/)[0];this.searchParams={get:name=>{const query=full.split('?')[1]||'';const part=query.split('&').find(v=>v.split('=')[0]===name);return part?decodeURIComponent(part.slice(part.indexOf('=')+1).replace(/\+/g,' ')):null}}}};
globalThis.Response=class{constructor(body,options={}){this.body=body;this.status=options.status||200;this.headers=options.headers||{}}static json(body,options={}){return new this(body,options)}};
const handlers={'/api/action':action,'/api/workflow':workflow,'/api/finance':finance,'/api/photo':photo};
function output(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON)}
export function doGet(){return output({service:'KDFY-ems Google Sheets API',ok:true})}
export function initializeWorkspace(){
 const props=PropertiesService.getScriptProperties();const ss=SpreadsheetApp.openById(spreadsheetId());
 for(const table of Object.keys(SCHEMA).filter(t=>!['users','sessions','attempts'].includes(t))){let sheet=ss.getSheetByName('KDFY_'+table);if(!sheet){sheet=ss.insertSheet('KDFY_'+table);sheet.getRange(1,1,1,12).setValues([['ID','Summary',...Array.from({length:10},(_,i)=>'Record '+(i+1))]]);sheet.setFrozenRows(1);sheet.getRange(1,1,1,12).setBackground('#28618b').setFontColor('#ffffff').setFontWeight('bold');sheet.setColumnWidth(1,200);sheet.setColumnWidth(2,260);sheet.hideColumns(3,10);}}
 if(!props.getProperty('PHOTO_FOLDER'))props.setProperty('PHOTO_FOLDER',DriveApp.createFolder('KDFY-ems private order photos').getId());
 if(!props.getProperty('SETUP_KEY'))props.setProperty('SETUP_KEY',Utilities.getUuid()+Utilities.getUuid());
 console.log('Workspace initialized. Your private setup key: '+props.getProperty('SETUP_KEY'));
}
function bucket(db,props){return {
 put(key,data,options){const folder=DriveApp.getFolderById(props.getProperty('PHOTO_FOLDER'));const file=folder.createFile(Utilities.newBlob(Array.from(data,n=>n>127?n-256:n),options.httpMetadata.contentType,Utilities.getUuid()));db.rows('photos').push({id:key,fileId:file.getId(),type:options.httpMetadata.contentType});db.dirty.add('photos');},
 head(key){return db.rows('photos').find(r=>r.id===key)||null;},
 get(key){const item=db.rows('photos').find(r=>r.id===key);if(!item)return null;return {body:{privatePhotoFile:item.fileId,type:item.type},httpMetadata:{contentType:item.type}};}
}}
export function doPost(e){
 let released=false;const lock=LockService.getScriptLock();if(!lock.tryLock(20000))return output({status:503,body:{error:'Workspace busy. Please try again.'}});
 try{
  const payload=JSON.parse(e.postData.contents);if(!payload||typeof payload.path!=='string')throw Error('Invalid request');
  const props=PropertiesService.getScriptProperties();if(!props.getProperty('PHOTO_FOLDER'))throw Error('The owner must initialize the workspace first.');
  const db=new SheetDB(SpreadsheetApp.openById(spreadsheetId()),props);GAS_ENV.DB=db;GAS_ENV.BUCKET=bucket(db,props);
  const path=payload.path.split('?')[0],method=payload.method||'GET';const handler=handlers[path]?.[method];if(!handler)throw Error('Unknown endpoint');
  const body=payload.body||{};
  if(path==='/api/action'&&method==='POST'&&['setup','login'].includes(body.action)){
   const cache=CacheService.getScriptCache(),count=Number(cache.get('login-count')||0);if(count>=100)return output({status:429,body:{error:'Too many login attempts. Try again in one minute.'}});cache.put('login-count',String(count+1),60);
  }
  const headers={origin:'https://kdfy.local',authorization:payload.token?'Bearer '+payload.token:'','cf-connecting-ip':'google'};
  if(body.action==='setup'&&payload.setupKey&&payload.setupKey===props.getProperty('SETUP_KEY'))headers['oai-authenticated-user-id']='owner';
  let upload;
  if(payload.file){if(!['image/jpeg','image/png','image/webp'].includes(payload.file.type)||payload.file.data.length>7000000)throw Error('Choose an image under 5 MB.');const decoded=Utilities.base64Decode(payload.file.data);upload={type:payload.file.type,size:decoded.length,arrayBuffer:()=>new Uint8Array(decoded.map(n=>n&255))};}
  const request={url:'https://kdfy.local'+payload.path,headers:{get:key=>headers[key.toLowerCase()]||null},json:()=>body,formData:()=>({get:key=>key==='file'?upload:body[key]||null})};
  const result=handler(request);db.commit();
  const cookie=result.headers['Set-Cookie'];const sessionToken=cookie?.match(/^kd_session=([^;]+)/)?.[1];
  let responseBody=sessionToken?{...result.body,sessionToken}:result.body;
  if(sessionToken&&path==='/api/action'&&['login','setup'].includes(body.action)){
   headers.authorization='Bearer '+sessionToken;
   const workspace=action.GET(request);if(workspace.status===200)responseBody={...responseBody,workspace:workspace.body};
  }
  // Authorization and metadata were checked under the lock. Drive image transfer does not
  // mutate shared state, so it must not hold up login or order updates for other staff.
  if(path==='/api/photo'&&method==='GET'&&result.status===200&&responseBody?.privatePhotoFile){
   lock.releaseLock();released=true;
   const imageBlob=DriveApp.getFileById(responseBody.privatePhotoFile).getBlob();
   responseBody={image:Utilities.base64Encode(imageBlob.getBytes()),type:responseBody.type};
  }
  return output({status:result.status,body:responseBody});
 }catch(error){return output({status:400,body:{error:error.message||'Unable to process request'}})}finally{if(!released)lock.releaseLock()}
}
