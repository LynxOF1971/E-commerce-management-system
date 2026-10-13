import {CATEGORIES,minor,dateKey} from './finance';
export function productionCosts(value:any,o:any,u:any,proof:any[]){
 if(!Array.isArray(value)||!value.length||value.length>30)throw Error('Add 1–30 production cost items before sending to delivery.');
 return value.map((line:any)=>{
  if(!line||!CATEGORIES.includes(line.category)||typeof line.description!=='string'||!line.description.trim())throw Error('Give each production cost a category and description.');
  const totalMinor=minor(line.amount);if(totalMinor<=0)throw Error('Every production cost must be greater than zero.');
  const now=new Date().toISOString();
  return {id:'EXP-'+crypto.randomUUID(),date:dateKey(),category:line.category,description:line.description.trim().slice(0,500),quantity:1,unit:'job',unitCostMinor:totalMinor,totalMinor,vendor:'',reference:o.id,notes:'Recorded at production handoff',kind:'Material use',reason:'Production cost for order '+o.id,proofs:proof.map(p=>p.url),orderId:o.id,approval:'Pending',costTreatment:'',submittedBy:u.name,submittedAt:now,source:'production-handoff',history:[{action:'Submitted',by:u.name,userId:u.id,date:now,note:'Itemized cost recorded at production handoff'}]};
 });
}
