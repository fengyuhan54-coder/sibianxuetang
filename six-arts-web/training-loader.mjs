import {stat} from 'node:fs/promises';
const entry=new URL('./training.mjs',import.meta.url);
let current=null,loadedAt=-1;
export async function loadTraining(){
 const {mtimeMs}=await stat(entry);
 if(current&&loadedAt===mtimeMs)return current;
 const next=await import(entry.href+'?revision='+mtimeMs);
 current=next;loadedAt=mtimeMs;
 return current;
}
