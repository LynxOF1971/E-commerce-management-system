import {CATEGORIES,minor,dateKey} from './finance';
export function productionCosts(value:any,o:any,u:any,proof:any[],lots:any[]=[]){
 if(!Array.isArray(value)||!value.length||value.length>30)throw Error('Add 1–30 production cost items before sending to delivery.');
 return value.map((line:any)=>{
  if(!line||!CATEGORIES.includes(line.category)||typeof line.description!=='string'||!line.description.trim())throw Error('Give each production cost a category and description.');
  if(!['From stock','New expense'].includes(line.costSource))throw Error('Choose From stock or New expense for every item.');
  let quantity=1,unit='job',stockId='',unitCostMinor=0;
  let totalMinor=0;
  if(line.costSource==='From stock'){
   const lot=lots.find(l=>l.id===line.stockId);quantity=Number(line.quantity);
   if(!lot||!Number.isFinite(quantity)||quantity<=0||quantity>lot.remaining)throw Error('Select available stock and a quantity within its remaining balance.');
   if(Math.round(quantity*1e6)!==quantity*1e6)throw Error('Use at most six decimal places for quantity.');
   lot.remaining=Number((lot.remaining-quantity).toFixed(6));stockId=lot.id;unit=lot.unit;unitCostMinor=lot.unitCostMinor;totalMinor=Math.round(quantity*unitCostMinor);
  }else{totalMinor=minor(line.amount);if(totalMinor<=0)throw Error('Every new expense must be greater than zero.');unitCostMinor=totalMinor;}
  const reason=String(line.reason||'').trim();if(reason.length<10||reason.length>2000)throw Error('Explain each usage or new expense in 10–2,000 characters.');
  const now=new Date().toISOString();
  return {id:'EXP-'+crypto.randomUUID(),date:dateKey(),category:line.category,description:line.description.trim().slice(0,500),quantity,unit,unitCostMinor,totalMinor,stockId,costSource:line.costSource,vendor:'',reference:o.id,notes:'Recorded at production handoff',kind:'Material use',reason,proofs:proof.map(p=>p.url),orderId:o.id,approval:'Recorded',costTreatment:stockId?'Already included in purchase':'Additional expense',submittedBy:u.name,submittedAt:now,source:'production-handoff',history:[{action:'Recorded',by:u.name,userId:u.id,date:now,note:'Itemized cost recorded at production handoff'}]};
 });
}
