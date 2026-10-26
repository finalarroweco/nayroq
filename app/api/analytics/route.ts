import{NextResponse}from"next/server";
import{createClient}from"@supabase/supabase-js";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const PUBLIC_ORIGIN=(process.env.NEXT_PUBLIC_APP_URL||"https://nayroq.finalarrow.com").replace(/\/$/,"");

function text(value:unknown,max:number){
 if(typeof value!=="string")return null;
 const cleaned=value.trim().slice(0,max);
 return cleaned||null;
}

function safeEventData(value:unknown){
 if(!value||typeof value!=="object"||Array.isArray(value))return{};
 const out:Record<string,string|number|boolean>={};
 for(const[key,raw]of Object.entries(value as Record<string,unknown>).slice(0,24)){
  const safeKey=key.replace(/[^a-zA-Z0-9_.-]/g,"_").slice(0,64);
  if(!safeKey)continue;
  if(typeof raw==="string")out[safeKey]=raw.slice(0,200);
  else if(typeof raw==="number"&&Number.isFinite(raw))out[safeKey]=raw;
  else if(typeof raw==="boolean")out[safeKey]=raw;
 }
 return out;
}

export async function POST(req:Request){
 try{
  const origin=req.headers.get("origin");
  if(origin!==PUBLIC_ORIGIN)return NextResponse.json({error:"Forbidden"},{status:403});
  const length=Number(req.headers.get("content-length")||0);
  if(length>32768)return NextResponse.json({error:"Payload too large"},{status:413});

  const body=await req.json();
  const eventType=body?.eventType==="event"?"event":"pageview";
  const eventName=eventType==="event"?text(body?.eventName,120):null;
  const visitorId=text(body?.visitorId,128);
  const sessionId=text(body?.sessionId,128);
  const path=text(body?.path,500);
  const hostname=text(body?.hostname,255);
  if(hostname!==new URL(PUBLIC_ORIGIN).hostname)return NextResponse.json({error:"Forbidden"},{status:403});
  if(!visitorId||!sessionId||!path||visitorId.length<8||sessionId.length<8||eventType==="event"&&!eventName){
   return NextResponse.json({error:"Invalid analytics event"},{status:400});
  }

  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!serviceKey)return NextResponse.json({error:"Analytics unavailable"},{status:503});
  const admin=createClient(url,serviceKey,{auth:{persistSession:false}});
  const{error}=await admin.from("site_analytics_events").insert({
   visitor_id:visitorId,
   session_id:sessionId,
   event_type:eventType,
   event_name:eventName,
   path,
   hostname,
   referrer:text(body?.referrer,500),
   language:text(body?.language,20),
   device_type:text(body?.deviceType,30),
   browser:text(body?.browser,50),
   os:text(body?.os,50),
   country:text(req.headers.get("x-vercel-ip-country")||body?.country,8),
   utm_source:text(body?.utmSource,120),
   utm_medium:text(body?.utmMedium,120),
   utm_campaign:text(body?.utmCampaign,160),
   utm_content:text(body?.utmContent,160),
   utm_term:text(body?.utmTerm,160),
   event_data:safeEventData(body?.eventData)
  });
  if(error){console.error("NAYROQ analytics insert failed",error);return NextResponse.json({error:"Analytics unavailable"},{status:500})}
  return new NextResponse(null,{status:202,headers:{"Cache-Control":"no-store"}});
 }catch(error){
  console.error("NAYROQ analytics request failed",error);
  return NextResponse.json({error:"Invalid analytics request"},{status:400});
 }
}
