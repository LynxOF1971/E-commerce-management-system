// Stock is derived from purchases and their linked usage records, never charged twice.
export function stockLots(records:any[]){
 const material=['Filament','Resin','Paper','Packaging','Other'];
 return records.filter(r=>!r.voided&&material.includes(r.category)&&(!r.approval||r.kind==='Purchase'&&r.approval==='Approved'&&r.costTreatment==='Additional expense')&&!r.stockId&&Number(r.quantity)>0).map(r=>{
  const unit=String(r.unit||'pcs').trim().toLowerCase();const factor=unit==='kg'?1000:unit==='l'?1000:1;
  const quantity=Number(r.quantity)*factor;
  const used=records.filter(e=>e.stockId===r.id&&!e.voided&&e.approval!=='Rejected').reduce((n,e)=>n+Number(e.quantity),0);
  return {id:r.id,description:r.description,category:r.category,date:r.date,unit:unit==='kg'?'g':unit==='l'?'ml':unit,quantity,remaining:Math.max(0,Number((quantity-used).toFixed(6))),unitCostMinor:r.totalMinor/quantity};
 });
}
export async function expenseRecords(db:any){return (await db.prepare('SELECT * FROM expenses').all()).results.map((r:any)=>({...JSON.parse(r.data),id:r.id,voided:!!r.voided}));}
