"use client";

import{track}from"@vercel/analytics";

type EventValue=string|number|boolean;
type EventData=Record<string,EventValue|undefined|null>;

function clean(data:EventData){
 return Object.fromEntries(Object.entries(data).filter(([,value])=>value!==undefined&&value!==null))as Record<string,EventValue>;
}

export function trackNayroqEvent(name:string,data:EventData={}){
 try{track(name,clean(data))}catch(error){console.warn("NAYROQ analytics event was not sent",name,error)}
}

export function trackNayroqEventOnce(name:string,data:EventData={},scope="global"){
 if(typeof window==="undefined")return;
 const key=`nayroq_event_${scope}_${name.replace(/\s+/g,"_").toLowerCase()}`;
 try{
  if(localStorage.getItem(key))return;
  trackNayroqEvent(name,data);
  localStorage.setItem(key,"1");
 }catch{trackNayroqEvent(name,data)}
}
