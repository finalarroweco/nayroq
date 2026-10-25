import{NextResponse}from"next/server";
import{createClient}from"@supabase/supabase-js";
import{
  I18N_API_VERSION,
  I18N_TOTAL_PARTS,
  getInterfaceTranslationChunk,
  type SupportedInterfaceLang
}from"@/lib/i18n-server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;

const LANGUAGES:SupportedInterfaceLang[]=["ar","fr","es","it"];
type Task={lang:SupportedInterfaceLang;part:number};

function getAdmin(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{persistSession:false}});
}

export async function GET(req:Request){
  const url=new URL(req.url);
  const auth=req.headers.get("authorization");
  const supplied=req.headers.get("x-prewarm-token")||url.searchParams.get("token");
  const cronAuthorized=Boolean(process.env.CRON_SECRET&&auth===`Bearer ${process.env.CRON_SECRET}`);
  const tokenAuthorized=Boolean(process.env.I18N_PREWARM_TOKEN&&supplied===process.env.I18N_PREWARM_TOKEN);
  if(!cronAuthorized&&!tokenAuthorized){
    return NextResponse.json({error:"Forbidden"},{status:403,headers:{"Cache-Control":"no-store"}});
  }

  const admin=getAdmin();
  if(!admin){
    return NextResponse.json({error:"Supabase server configuration is missing"},{status:503,headers:{"Cache-Control":"no-store"}});
  }

  const runtimeOidcToken=req.headers.get("x-vercel-oidc-token")||undefined;
  const batchParam=Number(url.searchParams.get("batch")||4);
  const batchSize=Math.max(1,Math.min(8,Number.isFinite(batchParam)?Math.floor(batchParam):4));
  const model=runtimeOidcToken
    ?`gateway:${process.env.VERCEL_AI_GATEWAY_MODEL||"google/gemini-3.6-flash"}`
    :process.env.OPENAI_TRANSLATION_MODEL||process.env.OPENAI_MODEL||"gpt-5.1";
  const total=LANGUAGES.length*I18N_TOTAL_PARTS;

  const{data:existingRows,error:readError}=await admin
    .from("ui_translation_chunks")
    .select("lang,part")
    .eq("version",I18N_API_VERSION)
    .in("lang",LANGUAGES);

  if(readError){
    await admin.from("ui_translation_prewarm_status").insert({
      version:I18N_API_VERSION,
      model,
      status:"read_error",
      detail:readError.message,
      completed:0,
      total
    });
    return NextResponse.json({error:readError.message},{status:500,headers:{"Cache-Control":"no-store"}});
  }

  const existing=new Set((existingRows||[]).map((row:any)=>`${row.lang}:${row.part}`));
  const missing:Task[]=[];
  for(let part=0;part<I18N_TOTAL_PARTS;part++){
    for(const lang of LANGUAGES){
      if(!existing.has(`${lang}:${part}`))missing.push({lang,part});
    }
  }

  if(!missing.length){
    await admin.from("ui_translation_prewarm_status").insert({
      version:I18N_API_VERSION,
      model,
      status:"complete",
      detail:"All priority interface language chunks are cached.",
      completed:total,
      total
    });
    return NextResponse.json({ok:true,complete:true,version:I18N_API_VERSION,model,completed:total,total,remaining:0},{headers:{"Cache-Control":"no-store"}});
  }

  const batch=missing.slice(0,batchSize);
  await admin.from("ui_translation_prewarm_status").insert({
    version:I18N_API_VERSION,
    model,
    status:"started",
    detail:`Processing ${batch.length} of ${missing.length} missing chunks. OIDC: ${runtimeOidcToken?"available":"missing"}.`,
    completed:existing.size,
    total
  });

  const results=await Promise.all(batch.map(async task=>{
    try{
      const result=await getInterfaceTranslationChunk(task.lang,task.part,runtimeOidcToken);
      await admin.from("ui_translation_prewarm_status").insert({
        version:I18N_API_VERSION,
        model,
        lang:task.lang,
        part:task.part,
        status:result.cached?"cached":"generated",
        detail:result.done?"Final chunk for language.":null,
        completed:existing.size+1,
        total
      });
      return{...task,ok:true,cached:result.cached};
    }catch(error:any){
      const detail=error?.message||"Translation failed";
      await admin.from("ui_translation_prewarm_status").insert({
        version:I18N_API_VERSION,
        model,
        lang:task.lang,
        part:task.part,
        status:"error",
        detail,
        completed:existing.size,
        total
      });
      return{...task,ok:false,error:detail};
    }
  }));

  const generated=results.filter(result=>result.ok).length;
  const completed=existing.size+generated;
  const errors=results.filter(result=>!result.ok);
  return NextResponse.json({
    ok:errors.length===0,
    complete:completed>=total,
    version:I18N_API_VERSION,
    model,
    oidcAvailable:Boolean(runtimeOidcToken),
    batchSize,
    completed,
    total,
    remaining:Math.max(0,total-completed),
    results
  },{headers:{"Cache-Control":"no-store"}});
}
