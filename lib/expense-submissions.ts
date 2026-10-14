import {expenseInput} from './finance';

export const EXPENSE_KINDS=['Purchase','Material use','Damage / waste'];
export function submissionInput(raw:any){
  if(!raw||!EXPENSE_KINDS.includes(raw.kind))throw Error('Choose purchase, material use, or damage / waste.');
  const data=expenseInput(raw);
  if(raw.kind==='Purchase'&&!String(raw.vendor||'').trim())throw Error('Enter the supplier for this purchase.');
  const reason=String(raw.reason||'').trim();
  if(reason.length<10||reason.length>2000)throw Error('Explain the purpose or cause in 10–2,000 characters.');
  if(!String(raw.unit||'').trim())throw Error('Enter the quantity unit, such as g, kg or pcs.');
  if(data.totalMinor<=0&&!raw.stockId)throw Error('Enter a cost greater than zero.');
  if(!Array.isArray(raw.proofs)||!raw.proofs.length||raw.proofs.length>8||raw.proofs.some((p:any)=>typeof p!=='string'))throw Error('Upload 1–8 proof photos showing the quantity and cost.');
  const proofs=[...new Set<string>(raw.proofs)];
  return {...data,kind:raw.kind,reason,proofs,orderId:String(raw.orderId||'').trim().slice(0,100)};
}
// Older manager-entered records have no approval field and remain approved.
export const countsAsExpense=(e:any)=>!e.voided&&!e.stockId&&(!e.approval||(['Approved','Recorded'].includes(e.approval)&&e.costTreatment==='Additional expense'));
export function submissionTotals(records:any[]){
  const active=records.filter(e=>e.approval&&!e.voided);
  const sum=(items:any[])=>items.reduce((n,e)=>n+e.totalMinor,0);
  return {pendingCount:active.filter(e=>e.approval==='Pending').length,pendingValue:sum(active.filter(e=>e.approval==='Pending')),approvedWaste:sum(active.filter(e=>['Approved','Recorded'].includes(e.approval)&&e.kind==='Damage / waste')),approvedMaterial:sum(active.filter(e=>['Approved','Recorded'].includes(e.approval)&&e.kind==='Material use'))};
}
