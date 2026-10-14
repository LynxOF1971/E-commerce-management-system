import {expenseRecords,stockLots} from '../../../lib/stock';
import {env} from 'cloudflare:workers';
import {current,has} from '../../../lib/access';
import {report,validDate,expenseInput,salaryInput,minor} from '../../../lib/finance';
import {submissionInput,countsAsExpense,submissionTotals} from '../../../lib/expense-submissions';
const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
function unpack(r:any){return {...JSON.parse(r.data),id:r.id,voided:!!r.voided,created:r.created,creator:r.creator};}
export async function GET(req:Request){try{const db=(env as any).DB;const u=await current(req,db);if(!has(u,'manager','production'))return json({error:'Production or manager access required.'},403);const p=new URL(req.url).searchParams;if(p.get('scope')==='submissions'){const records=(await db.prepare('SELECT * FROM expenses ORDER BY date DESC,created DESC').all()).results;return json({stockLots:stockLots(records.map(unpack)),submissions:records.filter((r:any)=>has(u,'manager')||r.creator===u.id).map(unpack).filter((r:any)=>r.approval)});}if(!has(u,'manager'))return json({error:'Manager access required.'},403);const from=validDate(p.get('from')||'1900-01-01'),to=validDate(p.get('to')||'9999-12-31');const group=p.get('group')||'month',basis=p.get('basis')||'order';if(from>to||!['day','week','month','year'].includes(group)||!['order','delivery'].includes(basis))return json({error:'Invalid reporting period.'},400);const [es,ss,os,cs]=await Promise.all([db.prepare('SELECT * FROM expenses ORDER BY date DESC,created DESC').all(),db.prepare('SELECT * FROM salaries ORDER BY date DESC,created DESC').all(),db.prepare('SELECT * FROM orders').all(),db.prepare('SELECT * FROM cases').all()]);const expenses=es.results.map(unpack),salaries=ss.results.map(unpack);const lots=stockLots(expenses);return json({stockSummary:{lots:lots.length,value:Math.round(lots.reduce((n:any,l:any)=>n+l.remaining*l.unitCostMinor,0))},submissionSummary:submissionTotals(expenses.filter((e:any)=>e.date>=from&&e.date<=to)),expenses:expenses.filter((e:any)=>(!e.stockId&&(!e.approval||['Approved','Recorded'].includes(e.approval)&&e.costTreatment==='Additional expense'))&&e.date>=from&&e.date<=to),salaries:salaries.filter((e:any)=>e.date>=from&&e.date<=to),...report(os.results.filter((o:any)=>!JSON.parse(o.data).deletedAt).map((o:any)=>({...JSON.parse(o.data),id:o.id,status:o.status})),expenses.filter(countsAsExpense),salaries.filter((s:any)=>!s.voided),cs.results.map((c:any)=>JSON.parse(c.data)).filter((c:any)=>!c.orderId||os.results.some((o:any)=>o.id===c.orderId&&!JSON.parse(o.data).deletedAt)),from,to,group,basis)});}catch(e:any){return json({error:e.message||'Could not load reports.'},400)}}
export async function POST(req:Request){try{if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Invalid origin'},403);const db=(env as any).DB;const u=await current(req,db);if(!has(u,'manager','production'))return json({error:'Production or manager access required.'},403);const b:any=await req.json();const now=new Date().toISOString();
if(b.action==='expense_submit'){
 if(!has(u,'production'))return json({error:'Only production can submit production expenses.'},403);
 let raw=b.data;
 if(raw?.kind!=='Purchase'&&raw?.stockId){
 const lot=stockLots(await expenseRecords(db)).find((l:any)=>l.id===raw.stockId);const quantity=Number(raw.quantity);
 if(!lot||!Number.isFinite(quantity)||quantity<=0||quantity>lot.remaining||Math.round(quantity*1e6)!==quantity*1e6)throw Error('Choose available stock and a quantity within its balance.');
 raw={...raw,category:lot.category,unit:lot.unit,unitCost:(lot.unitCostMinor/100).toFixed(2)};
 }
 if(raw?.kind!=='Purchase'&&!raw?.stockId)throw Error('Select the purchased material for usage or waste. Record purchases separately.');
 const data:any=submissionInput(raw);
 if(raw.stockId&&raw.kind!=='Purchase'){const lot=stockLots(await expenseRecords(db)).find((l:any)=>l.id===raw.stockId)!;Object.assign(data,{stockId:lot.id,costSource:'From stock',unitCostMinor:lot.unitCostMinor,totalMinor:Math.round(data.quantity*lot.unitCostMinor)});}

 for(const url of data.proofs){const prefix='/api/photo?key=';if(!url.startsWith(prefix))throw Error('Upload proof using the expense form.');const key=decodeURIComponent(url.slice(prefix.length));if(!key.startsWith(u.id+'/expense-proof/')||!await (env as any).BUCKET.head(key))throw Error('Proof must be your own uploaded expense photo.');}
 if(data.orderId){const order=await db.prepare('SELECT * FROM orders WHERE id=?').bind(data.orderId).first();if(!order)throw Error('Order reference not found.');if(!has(u,'manager')&&!['Designed','Prepared','Delivered','Not delivered'].includes(order.status))throw Error('Reference an order that has reached production.');}
 const record={...data,approval:'Pending',costTreatment:'',submittedBy:u.name,submittedAt:now,history:[{action:'Submitted',by:u.name,userId:u.id,date:now,note:data.reason}]};
 await db.prepare('INSERT INTO expenses (id,date,data,creator,created) VALUES (?,?,?,?,?)').bind('EXP-'+crypto.randomUUID(),data.date,JSON.stringify(record),u.id,now).run();return json({ok:true});
}
if(!has(u,'manager'))return json({error:'Manager access required.'},403);
if(b.action==='purchase_total'){
 const rows=await expenseRecords(db);const purchase=rows.find((r:any)=>r.id===b.id);
 if(!purchase||purchase.stockId||purchase.voided||purchase.approval&&purchase.kind!=='Purchase')throw Error('Select an active purchase.');
 const totalMinor=minor(b.data?.totalCost);const reason=String(b.data?.reason||'').trim();if(totalMinor<=0||reason.length<10)throw Error('Enter the total paid and a correction reason of at least 10 characters.');
 const corrected={...purchase,totalMinor,unitCostMinor:totalMinor/Number(purchase.quantity),history:[...(purchase.history||[]),{action:'Purchase total corrected',by:u.name,userId:u.id,date:now,reason,previousTotalMinor:purchase.totalMinor,totalMinor}]};
 const unit=String(purchase.unit).toLowerCase();const divisor=Number(purchase.quantity)*(['kg','l'].includes(unit)?1000:1);const rate=totalMinor/divisor;
 const linked=rows.filter((r:any)=>r.stockId===purchase.id).map((r:any)=>({...r,totalMinor:Math.round(Number(r.quantity)*rate),unitCostMinor:rate,history:[...(r.history||[]),{action:'Stock cost recalculated',by:u.name,userId:u.id,date:now,reason,previousTotalMinor:r.totalMinor}]}));
 const changes=[corrected,...linked].map((r:any)=>db.prepare('UPDATE expenses SET data=? WHERE id=?').bind(JSON.stringify(r),r.id));
 const orders=(await db.prepare('SELECT * FROM orders').all()).results;
 for(const row of orders){const d=JSON.parse(row.data);if(!(d.productionCosts||[]).some((c:any)=>linked.some((l:any)=>l.id===c.expenseId)))continue;
 d.productionCosts=d.productionCosts.map((c:any)=>{const match=linked.find((l:any)=>l.id===c.expenseId);return match?{...c,totalMinor:match.totalMinor}:c});
 d.history=[...(d.history||[]),{event:'Stock cost corrected',status:row.status,by:u.name,userId:u.id,date:now,reason,purchaseId:purchase.id}];
 changes.push(db.prepare('UPDATE orders SET data=?,version=version+1 WHERE id=?').bind(JSON.stringify(d),row.id));}
 await db.batch(changes);return json({ok:true});
}
if(b.action==='expense_review'){
 const row=await db.prepare('SELECT * FROM expenses WHERE id=?').bind(b.id).first();if(!row)throw Error('Submission not found.');const old=JSON.parse(row.data);
 if(old.approval!=='Pending'||row.voided)throw Error('This submission has already been reviewed or voided. Refresh the list.');

 if(!['Approved','Rejected'].includes(b.decision))throw Error('Choose approve or reject.');
 const note=String(b.note||'').trim();if(note.length<5||note.length>2000)throw Error('Add a review note of 5–2,000 characters.');
 if(b.decision==='Approved'&&!['Additional expense','Already included in purchase'].includes(b.costTreatment))throw Error('Choose how this cost affects profit.');
 if(old.stockId&&b.decision==='Approved'&&b.costTreatment!=='Already included in purchase')throw Error('Stock usage is tracking only and cannot be charged again.');
 const costTreatment=b.decision==='Approved'?b.costTreatment:'';
 const next={...old,approval:b.decision,costTreatment,reviewedBy:u.name,reviewedAt:now,reviewNote:note,history:[...(old.history||[]),{action:b.decision,by:u.name,userId:u.id,date:now,note,costTreatment}]};
 const result=await db.prepare('UPDATE expenses SET data=? WHERE id=? AND data=?').bind(JSON.stringify(next),row.id,row.data).run();if(!result.meta.changes)throw Error('The submission changed. Refresh and try again.');return json({ok:true});
}

if(b.action==='expense'||b.action==='salary'){const table=b.action==='expense'?'expenses':'salaries';const data=b.action==='expense'?expenseInput(b.data):salaryInput(b.data);if(b.action==='expense'){
 const proofs=b.data?.proofs;
 if(!Array.isArray(proofs)||!proofs.length||proofs.length>8)throw Error('Upload 1–8 purchase proof photos.');
 const previous=b.id?await db.prepare('SELECT * FROM expenses WHERE id=?').bind(b.id).first():null;
 const saved=previous?JSON.parse(previous.data).proofs||[]:[];
 for(const url of proofs){if(typeof url!=='string'||!url.startsWith('/api/photo?key='))throw Error('Upload a valid purchase proof photo.');const key=decodeURIComponent(url.slice('/api/photo?key='.length));if((!key.startsWith(u.id+'/expense-proof/')&&!saved.includes(url))||!await (env as any).BUCKET.head(key))throw Error('Use your uploaded purchase proof.');}
 Object.assign(data,{proofs:[...new Set(proofs)],kind:'Purchase'});
 }if(b.id){const old=await db.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(b.id).first();if(!old)throw Error('Record not found.');if(table==='expenses'&&(await expenseRecords(db)).some((e:any)=>e.stockId===old.id))throw Error('This purchase has linked stock usage and cannot be edited.');if(table==='expenses'&&JSON.parse(old.data).approval)throw Error('Production submissions are preserved for audit. Review pending submissions or void approved records instead of editing them.');await db.prepare(`UPDATE ${table} SET date=?,data=? WHERE id=?`).bind(data.date,JSON.stringify(data),b.id).run();}else{await db.prepare(`INSERT INTO ${table} (id,date,data,creator,created) VALUES (?,?,?,?,?)`).bind((b.action==='expense'?'EXP-':'SAL-')+crypto.randomUUID(),data.date,JSON.stringify(data),u.id,now).run();}return json({ok:true});}
if(b.action==='void'){if(!['expenses','salaries'].includes(b.table)||typeof b.voided!=='boolean')throw Error('Invalid record.');if(b.table==='expenses'&&(await expenseRecords(db)).some((e:any)=>e.stockId===b.id))throw Error('This purchase has linked stock usage and cannot be voided.');const r=await db.prepare(`UPDATE ${b.table} SET voided=? WHERE id=?`).bind(b.voided?1:0,b.id).run();if(!r.meta.changes)throw Error('Record not found.');return json({ok:true});}
if(b.action==='import'){
if(!Array.isArray(b.proofs)||!b.proofs.length||b.proofs.length>8)throw Error('Upload purchase proof for this import.');
for(const url of b.proofs){if(typeof url!=='string'||!url.startsWith('/api/photo?key='))throw Error('Invalid purchase proof.');const key=decodeURIComponent(url.slice('/api/photo?key='.length));if(!key.startsWith(u.id+'/expense-proof/')||!await (env as any).BUCKET.head(key))throw Error('Use your uploaded purchase proof.');}
if(!Array.isArray(b.rows)||!b.rows.length||b.rows.length>500)throw Error('Import between 1 and 500 rows at a time.');const validated=b.rows.map((d:any,i:number)=>{try{return expenseInput(d)}catch(e:any){throw Error(`Row ${i+2}: ${e.message}`)}});const unique=new Map<string,any>();for(const row of validated){const key=await digest(JSON.stringify(row));unique.set(key,row)}const statements=[...unique].map(([key,d])=>db.prepare('INSERT INTO expenses (id,date,data,creator,created,import_key) VALUES (?,?,?,?,?,?) ON CONFLICT(import_key) DO NOTHING').bind('EXP-'+crypto.randomUUID(),d.date,JSON.stringify({...d,proofs:b.proofs,kind:'Purchase'}),u.id,now,key));const result=await db.batch(statements);const imported=result.reduce((n:number,r:any)=>n+(r.meta.changes||0),0);return json({ok:true,imported,skipped:validated.length-imported});}
throw Error('Unknown action.');}catch(e:any){return json({error:e.message||'Could not save record.'},400)}}
