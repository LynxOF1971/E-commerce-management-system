// The GitHub website talks to Google Apps Script; credentials stay out of URLs.
const script = (import.meta as any).env?.VITE_GOOGLE_SCRIPT_URL || '';
const key = 'kdfy-session';
export const standaloneApi = Boolean(script);
export const publicAsset = (name:string) => ((import.meta as any).env?.BASE_URL || '/') + name;
export async function apiFetch(path:string, init:RequestInit = {}) {
  if(!script)return fetch(path,init);
  const payload:any={path,method:init.method||'GET',token:sessionStorage.getItem(key)||''};
  if(init.body instanceof FormData){
    payload.body=Object.fromEntries([...init.body.entries()].filter(([k])=>k!=='file'));
    const file=init.body.get('file') as File;
    if(file){const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file)});payload.file={data,type:file.type};}
  }else if(typeof init.body==='string'){
    payload.body=JSON.parse(init.body);
    if(payload.body.setupKey){payload.setupKey=payload.body.setupKey;delete payload.body.setupKey;}
  }
  const r=await fetch(script,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),credentials:'omit',redirect:'follow',signal:init.signal});
  if(!r.ok)throw Error('Google backend unavailable. Please try again.');
  const result:any=await r.json();
  if(result.body?.sessionToken)sessionStorage.setItem(key,result.body.sessionToken);
  if((payload.body?.action==='logout'&&result.status===200)||result.status===401)sessionStorage.removeItem(key);
  if(result.body?.image){const binary=atob(result.body.image);return new Response(Uint8Array.from(binary,c=>c.charCodeAt(0)),{status:result.status,headers:{'Content-Type':result.body.type}});}
  return new Response(JSON.stringify(result.body),{status:result.status||500,headers:{'Content-Type':'application/json'}});
}
