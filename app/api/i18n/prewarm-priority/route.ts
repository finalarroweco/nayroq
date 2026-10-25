import{NextResponse}from"next/server";
import{I18N_API_VERSION,I18N_TOTAL_PARTS,getInterfaceTranslationChunk,type SupportedInterfaceLang}from"@/lib/i18n-server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;

const LANGUAGES:SupportedInterfaceLang[]=["ar","fr","es","it"];
type Task={lang:SupportedInterfaceLang;part:number};

export async function GET(req:Request){
  const url=new URL(req.url);
  const auth=req.headers.get("authorization");
  const supplied=req.headers.get("x-prewarm-token")||url.searchParams.get("token");
  const cronAuthorized=Boolean(process.env.CRON_SECRET&&auth===`Bearer ${process.env.CRON_SECRET}`);
  const tokenAuthorized=Boolean(process.env.I18N_PREWARM_TOKEN&&supplied===process.env.I18N_PREWARM_TOKEN);
  if(!cronAuthorized&&!tokenAuthorized){
    return NextResponse.json({error:"Forbidden"},{status:403,headers:{"Cache-Control":"no-store"}});
  }

  const tasks:Task[]=[];
  for(const lang of LANGUAGES){
    for(let part=0;part<I18N_TOTAL_PARTS;part++)tasks.push({lang,part});
  }

  let cursor=0;
  const results:Record<string,{completed:number;cached:number;generated:number;errors:string[]}>=Object.fromEntries(
    LANGUAGES.map(lang=>[lang,{completed:0,cached:0,generated:0,errors:[]}])
  );

  async function worker(){
    while(true){
      const index=cursor++;
      if(index>=tasks.length)return;
      const task=tasks[index];
      try{
        const result=await getInterfaceTranslationChunk(task.lang,task.part);
        results[task.lang].completed++;
        if(result.cached)results[task.lang].cached++;
        else results[task.lang].generated++;
      }catch(error:any){
        results[task.lang].errors.push(`part ${task.part}: ${error?.message||"failed"}`);
      }
    }
  }

  await Promise.all(Array.from({length:4},()=>worker()));
  const failed=Object.values(results).some(result=>result.errors.length>0);
  console.log("NAYROQ priority language prewarm",{version:I18N_API_VERSION,parts:I18N_TOTAL_PARTS,results});
  return NextResponse.json(
    {ok:!failed,version:I18N_API_VERSION,parts:I18N_TOTAL_PARTS,results},
    {status:failed?500:200,headers:{"Cache-Control":"no-store"}}
  );
}
