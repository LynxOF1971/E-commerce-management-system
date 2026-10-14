// Inspect image container bytes rather than trusting a browser-supplied MIME label.
export function validImage(bytes:Uint8Array,type:string){
 const n=bytes.length,view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const text=(at:number,size:number)=>String.fromCharCode(...bytes.slice(at,at+size));
 if(n<12)return false;
 if(type==='image/png'){
  if(![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return false;
  let p=8,header=false,data=false;
  while(p+12<=n){const size=view.getUint32(p),kind=text(p+4,4);if(size>n-p-12)return false;
   let crc=0xffffffff;for(let i=p+4;i<p+8+size;i++){crc^=bytes[i];for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
   if(((crc^0xffffffff)>>>0)!==view.getUint32(p+8+size))return false;
   if(!header){if(kind!=='IHDR'||size!==13||!view.getUint32(p+8)||!view.getUint32(p+12))return false;header=true;}
   if(kind==='IDAT'&&size>0)data=true;
   if(kind==='IEND')return size===0&&data&&p+12===n;
   p+=size+12;
  }return false;
 }
 if(type==='image/webp'){
  if(text(0,4)!=='RIFF'||text(8,4)!=='WEBP'||view.getUint32(4,true)+8!==n)return false;
  let p=12,data=false;while(p+8<=n){const kind=text(p,4),size=view.getUint32(p+4,true);if(size>n-p-8)return false;
   if(kind==='VP8 '&&size>=10&&bytes[p+11]===157&&bytes[p+12]===1&&bytes[p+13]===42)data=true;
   if(kind==='VP8L'&&size>=5&&bytes[p+8]===47)data=true;
   if(kind==='ANMF'&&size>=24)data=true;
   p+=8+size+(size%2);
  }return data&&p===n;
 }
 if(type==='image/jpeg'){
  if(bytes[0]!==255||bytes[1]!==216||bytes[n-2]!==255||bytes[n-1]!==217)return false;
  let p=2,frame=false,scan=false;while(p<n-2){if(bytes[p++]!==255)return false;while(bytes[p]===255)p++;const marker=bytes[p++];
   if(marker===0||marker===216||marker===217)return false;
   if(marker===1||marker>=208&&marker<=215)continue;
   if(p+2>n)return false;const size=view.getUint16(p);if(size<2||p+size>n)return false;
   if([192,193,194].includes(marker)){if(size<8||!view.getUint16(p+3)||!view.getUint16(p+5))return false;frame=true;}
   if(marker===218){scan=true;return frame&&scan&&p+size<n-2;}
   p+=size;
  }return false;
 }
 return false;
}
