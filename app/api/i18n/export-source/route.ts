import{NextResponse}from"next/server";
import{createClient}from"@supabase/supabase-js";
import{COPY_CHUNK_SIZE}from"@/lib/i18n-copy";
import{
  I18N_ALL_KEYS,
  I18N_API_VERSION,
  I18N_SOURCE_COPY,
  I18N_TOTAL_PARTS
}from"@/lib/i18n-server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;

export async function GET(req:Request){
  const auth=req.headers.get("authorization");
  if(!process.env.CRON_SECRET||auth!==`Bearer ${process.env.CRON_SECRET}`){
    return NextResponse.json({error:"Forbidden"},{status:403});
  }
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return NextResponse.json({error:"Supabase configuration missing"},{status:503});
  const admin=createClient(url,key,{auth:{persistSession:false}});
  const rows=[];
  for(let part=0;part<I18N_TOTAL_PARTS;part++){
    const keys=I18N_ALL_KEYS.slice(part*COPY_CHUNK_SIZE,(part+1)*COPY_CHUNK_SIZE);
    rows.push({
      version:I18N_API_VERSION,
      part,
      source:Object.fromEntries(keys.map(name=>[name,I18N_SOURCE_COPY[name]])),
      updated_at:new Date().toISOString()
    });
  }
  const{error}=await admin.from("ui_source_chunks").upsert(rows,{onConflict:"version,part"});
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({ok:true,version:I18N_API_VERSION,parts:rows.length});
}
