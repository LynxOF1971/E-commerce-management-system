export const ROLES = ['manager','moderator','designer','production','distributor','crm'];
export function rolesOf(user:any):string[]{if(!user)return [];try{const r=typeof user.roles==='string'?JSON.parse(user.roles):user.roles;if(Array.isArray(r)&&r.length)return r.filter(x=>ROLES.includes(x));}catch{}return ROLES.includes(user.role)?[user.role]:[];}
export const has=(u:any,...roles:string[])=>rolesOf(u).some(r=>roles.includes(r));
export function dataOf(o:any){try{return typeof o.data==='string'?JSON.parse(o.data):o;}catch{return {};}}
export function participated(u:any,o:any){const d=dataOf(o);return !!u&&(o.creator===u.id||(d.history||[]).some((h:any)=>h.userId===u.id));}
export function visible(u:any,o:any){const d=dataOf(o);return has(u,'manager')||has(u,'moderator')&&(o.creator===u.id||o.status==='Delivered'||o.status==='Reorder'&&d.reproduction)||has(u,'designer')&&o.status==='Pending'||has(u,'production')&&o.status==='Designed'||has(u,'distributor')&&o.status==='Prepared'||has(u,'crm')&&(['Delivered','Not delivered'].includes(o.status)||d.reproduction&&d.requestedById===u.id);}
export const canReadOrder=(u:any,o:any)=>visible(u,o)||participated(u,o);
export function canTransition(u:any,from:string,to:string){return has(u,'manager')||from==='Pending'&&to==='Designed'&&has(u,'designer')||from==='Designed'&&to==='Prepared'&&has(u,'production')||from==='Prepared'&&['Delivered','Not delivered'].includes(to)&&has(u,'distributor');}
export function checkedRoles(value:any){if(!Array.isArray(value)||!value.length||value.some(r=>!ROLES.includes(r)))throw Error('Choose at least one valid role.');return [...new Set<string>(value)];}
export async function current(req:Request,db:any){const token=req.headers.get('cookie')?.match(/(?:^|; )kd_session=([^;]+)/)?.[1];return token?db.prepare('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.id=? AND expires>?').bind(token,Date.now()).first():null;}
