'use client';
import {useEffect,useState} from 'react';
import {cachedPhoto} from '../lib/photo-cache';
import {apiFetch} from '../lib/client-api';

export function PrivatePhoto({src,alt,className,expand=false}:{src:string;alt:string;className?:string;expand?:boolean}) {
  const [url,setUrl]=useState('');
  useEffect(()=>{
    let objectUrl=''; const controller=new AbortController(); setUrl('');
    if (!src?.startsWith('/api/photo?key=')) return;
    cachedPhoto(src,async()=>{const response=await apiFetch(src);
      if(!response.ok)throw Error('Photo unavailable');
      return response.blob();}).then(blob=>{
      if(controller.signal.aborted)return;
      objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);
    }).catch(()=>{});
    return()=>{controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl)};
  },[src]);
  if(!url)return <span className="form-note">Photo loading or unavailable</span>;
  const image=<img src={url} alt={alt} className={className}/>;
  return expand?<a href={url} target="_blank" rel="noreferrer">{image}</a>:image;
}
