// Memory only, bounded and short lived. No private photos are persisted to disk storage.
const entries=new Map<string,{blob:Blob,expires:number}>();
const pending=new Map<string,Promise<Blob>>();let epoch=0;
export function clearPhotoCache(){epoch++;entries.clear();pending.clear();}
export function cachedPhoto(src:string,load:()=>Promise<Blob>){
 const now=Date.now();for(const [key,value] of entries)if(value.expires<=now)entries.delete(key);
 const hit=entries.get(src);if(hit)return Promise.resolve(hit.blob);
 const inflight=pending.get(src);if(inflight)return inflight;
 const version=epoch;
 const task=load().then(blob=>{if(version!==epoch)throw Error('Session changed');if(blob.size<=16*1024*1024){let size=blob.size;for(const v of entries.values())size+=v.blob.size;while(size>16*1024*1024&&entries.size){const key=entries.keys().next().value!;size-=entries.get(key)!.blob.size;entries.delete(key);}entries.set(src,{blob,expires:Date.now()+60000});}return blob;}).finally(()=>{if(pending.get(src)===task)pending.delete(src)});
 pending.set(src,task);return task;
}
