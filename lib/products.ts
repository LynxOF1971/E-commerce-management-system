export const DEFAULT_PRODUCTS=['Clicky','Custom','Spooky','NFC','Toys','Portrait','Photobooth','Other'].map(name=>({name,proofRequired:true}));
export async function products(db:any){const rows=(await db.prepare('SELECT * FROM product_types ORDER BY name').all()).results;const map=new Map(DEFAULT_PRODUCTS.map(p=>[p.name.toLowerCase(),p]));for(const r of rows)map.set(r.name.toLowerCase(),{name:r.name,proofRequired:true});return [...map.values()];}
export async function productRule(db:any,name:string){const p=(await products(db)).find(p=>p.name===name);if(!p)throw Error('Select a product type from the catalog.');return p;}
export async function productionProof(db:any,bucket:any,o:any,u:any,urls:any,costPhoto:any){
 const d=JSON.parse(o.data);await productRule(db,d.product);
 if(!Array.isArray(urls)||!urls.length||urls.length>7||!costPhoto)throw Error('Upload both cost proof and a final result photo before sending to delivery.');
 const all=[costPhoto,...urls];if(new Set(all).size!==all.length)throw Error('Use separate uploads for cost proof and final result.');
 for(const url of all){if(typeof url!=='string'||!url.startsWith('/api/photo?key='))throw Error('Upload a valid production photo.');const key=new URL(url,'https://local').searchParams.get('key')||'';if(!key.startsWith(u.id+'/proof/'+o.id+'/')||!await bucket.head(key))throw Error('Upload production photos for this order.');}
 return all.map((url,i)=>({url,kind:i===0?'Cost proof':'Final result',by:u.name,userId:u.id,date:new Date().toISOString()}));
}
