import{NextResponse}from"next/server";
import{createClient}from"@supabase/supabase-js";
import{COPY_CHUNK_SIZE}from"@/lib/i18n-copy";
import{
  I18N_ALL_KEYS,
  I18N_API_VERSION,
  I18N_TOTAL_PARTS,
  getInterfaceTranslationChunk,
  type SupportedInterfaceLang
}from"@/lib/i18n-server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;

const LANGUAGES:SupportedInterfaceLang[]=["ar","fr","es","it"];

export async function GET(req:Request){
  const auth=req.headers.get("authorization");
  if(!process.env.CRON_SECRET||auth!==`Bearer ${process.env.CRON_SECRET}`){
    return NextResponse.json({error:"Forbidden"},{status:403});
  }

  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return NextResponse.json({error:"Supabase configuration missing"},{status:503});
  const admin=createClient(url,key,{auth:{persistSession:false}});
  const detail:Record<string,any>={};
  let ok=true;

  for(const lang of LANGUAGES){
    const parts=[];
    for(let part=0;part<I18N_TOTAL_PARTS;part++){
      try{
        const result=await getInterfaceTranslationChunk(lang,part);
        const expected=I18N_ALL_KEYS.slice(part*COPY_CHUNK_SIZE,(part+1)*COPY_CHUNK_SIZE).length;
        const actual=Object.keys(result.translations||{}).length;
        const valid=result.cached&&actual===expected;
        if(!valid)ok=false;
        parts.push({part,expected,actual,cached:result.cached,valid});
      }catch(error:any){
        ok=false;
        parts.push({part,valid:false,error:error?.message||"failed"});
      }
    }
    detail[lang]={parts,valid:parts.every((item:any)=>item.valid)};
  }

  const status=ok?"passed":"failed";
  await admin.from("ui_translation_self_test").insert({
    version:I18N_API_VERSION,
    status,
    detail
  });

  return NextResponse.json({ok,status,version:I18N_API_VERSION,detail},{status:ok?200:500,headers:{"Cache-Control":"no-store"}});
}
