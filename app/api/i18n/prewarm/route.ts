import{NextResponse}from"next/server";
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

export async function GET(req:Request){
  const auth=req.headers.get("authorization");
  if(!process.env.CRON_SECRET||auth!==`Bearer ${process.env.CRON_SECRET}`){
    return NextResponse.json({error:"Forbidden"},{status:403});
  }

  const results:Record<string,{parts:number;errors:string[]}>= {};

  for(const lang of LANGUAGES){
    let next=0;
    const errors:string[]=[];

    async function worker(){
      while(true){
        const part=next++;
        if(part>=I18N_TOTAL_PARTS)return;
        try{
          await getInterfaceTranslationChunk(lang,part);
        }catch(error:any){
          errors.push(`part ${part}: ${error?.message||"failed"}`);
        }
      }
    }

    await Promise.all([worker(),worker()]);
    results[lang]={parts:I18N_TOTAL_PARTS,errors};
  }

  console.log("NAYROQ interface language prewarm complete",results);
  const failed=Object.values(results).some(result=>result.errors.length>0);
  return NextResponse.json(
    {ok:!failed,version:I18N_API_VERSION,results},
    {status:failed?500:200,headers:{"Cache-Control":"no-store"}}
  );
}
