"use client";

type EventValue=string|number|boolean;
type EventData=Record<string,EventValue|undefined|null>;

const PUBLIC_HOSTNAME="nayroq.finalarrow.com";
let memoryVisitorId="";
let memorySessionId="";

function randomId(prefix:string){
 const value=typeof crypto!=="undefined"&&"randomUUID"in crypto?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36);
 return`${prefix}_${value}`;
}

function storedId(storage:Storage|undefined,key:string,prefix:string){
 try{
  const existing=storage?.getItem(key);
  if(existing)return existing;
  const created=randomId(prefix);
  storage?.setItem(key,created);
  return created;
 }catch{
  if(prefix==="v")return memoryVisitorId||(memoryVisitorId=randomId(prefix));
  return memorySessionId||(memorySessionId=randomId(prefix));
 }
}

function visitorId(){return storedId(typeof localStorage!=="undefined"?localStorage:undefined,"nayroq_visitor_id","v")}
function sessionId(){return storedId(typeof sessionStorage!=="undefined"?sessionStorage:undefined,"nayroq_session_id","s")}
function clean(data:EventData){return Object.fromEntries(Object.entries(data).filter(([,value])=>value!==undefined&&value!==null))as Record<string,EventValue>}

function deviceType(){
 const ua=navigator.userAgent.toLowerCase();
 if(/ipad|tablet|playbook|silk/.test(ua))return"tablet";
 if(/mobi|android|iphone|ipod/.test(ua))return"mobile";
 return"desktop";
}

function browser(){
 const ua=navigator.userAgent;
 if(/Edg\//.test(ua))return"Edge";
 if(/OPR\//.test(ua))return"Opera";
 if(/Chrome\//.test(ua))return"Chrome";
 if(/Firefox\//.test(ua))return"Firefox";
 if(/Safari\//.test(ua)&&!/Chrome\//.test(ua))return"Safari";
 return"Other";
}

function os(){
 const ua=navigator.userAgent;
 if(/Windows/.test(ua))return"Windows";
 if(/iPhone|iPad|iPod/.test(ua))return"iOS";
 if(/Android/.test(ua))return"Android";
 if(/Mac OS/.test(ua))return"macOS";
 if(/Linux/.test(ua))return"Linux";
 return"Other";
}

function safeReferrer(){
 if(!document.referrer)return"";
 try{const url=new URL(document.referrer);return url.origin+url.pathname}catch{return""}
}

function attribution(){
 const params=new URLSearchParams(location.search);
 const keys=["utm_source","utm_medium","utm_campaign","utm_content","utm_term"];
 const saved:Record<string,string>={};
 try{const old=JSON.parse(sessionStorage.getItem("nayroq_attribution")||"{}");if(old&&typeof old==="object")for(const key of keys)if(typeof old[key]==="string")saved[key]=old[key];}catch{}
 for(const key of keys){const value=params.get(key);if(value)saved[key]=value.slice(0,160)}
 try{sessionStorage.setItem("nayroq_attribution",JSON.stringify(saved))}catch{}
 return saved;
}

function context(){
 const params=attribution();
 return{
  visitorId:visitorId(),
  sessionId:sessionId(),
  path:location.pathname,
  hostname:location.hostname,
  referrer:safeReferrer(),
  language:localStorage.getItem("nayroq_language")||document.documentElement.lang||navigator.language,
  deviceType:deviceType(),
  browser:browser(),
  os:os(),
  utmSource:params["utm_source"]||null,
  utmMedium:params["utm_medium"]||null,
  utmCampaign:params["utm_campaign"]||null,
  utmContent:params["utm_content"]||null,
  utmTerm:params["utm_term"]||null
 };
}

function send(payload:Record<string,unknown>){
 if(typeof window==="undefined"||location.hostname!==PUBLIC_HOSTNAME)return;
 const body=JSON.stringify({...context(),...payload});
 try{
  if(navigator.sendBeacon){
   const accepted=navigator.sendBeacon("/api/analytics",new Blob([body],{type:"application/json"}));
   if(accepted)return;
  }
 }catch{}
 void fetch("/api/analytics",{method:"POST",headers:{"Content-Type":"application/json"},body,keepalive:true,credentials:"same-origin"}).catch(()=>{});
}

export function trackPageView(path=location.pathname){
 if(typeof window==="undefined"||location.hostname!==PUBLIC_HOSTNAME)return;
 try{
  const now=Date.now();
  const previous=JSON.parse(sessionStorage.getItem("nayroq_last_pageview")||"null");
  if(previous?.path===path&&now-Number(previous.time)<2000)return;
  sessionStorage.setItem("nayroq_last_pageview",JSON.stringify({path,time:now}));
 }catch{}
 send({eventType:"pageview",path});
}

export function trackNayroqEvent(name:string,data:EventData={}){
 send({eventType:"event",eventName:name,eventData:clean(data)});
}

export function trackNayroqEventOnce(name:string,data:EventData={},scope="global"){
 if(typeof window==="undefined"||location.hostname!==PUBLIC_HOSTNAME)return;
 const key=`nayroq_event_${scope}_${name.replace(/\s+/g,"_").toLowerCase()}`;
 try{
  if(localStorage.getItem(key))return;
  trackNayroqEvent(name,data);
  localStorage.setItem(key,"1");
 }catch{trackNayroqEvent(name,data)}
}
