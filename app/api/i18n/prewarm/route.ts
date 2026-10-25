import{NextResponse}from"next/server";
import{
  COPY_CHUNK_SIZE,
  EN_COPY,
  UI_COPY_VERSION
}from"@/lib/i18n-copy";
import{EXTRA_EN_COPY}from"@/lib/i18n-extra-copy";
import{MISC_EN_COPY}from"@/lib/i18n-misc-copy";
import{GLOBAL_LAUNCH_EN_COPY}from"@/lib/global-launch-copy";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;

const SOURCE_COPY={
  ...EN_COPY,
  ...EXTRA_EN_COPY,
  ...MISC_EN_COPY,
  ...GLOBAL_LAUNCH_EN_COPY
};
const TOTAL=Math.ceil(Object.keys(SOURCE_COPY).length/COPY_CHUNK_SIZE);
const VERSION=UI_COPY_VERSION+"-atomic-language-pack-v2";
const LANGUAGES=["ar","fr","es","it"]as const;

export async function GET(req:Request){
  const auth=req.headers.get("authorization");
  if(!process.env.CRON_SECRET||auth!==`Bearer ${process.env.CRON_SECRET}`){
    return NextResponse.json({error:"Forbidden"},{status:403});
  }

  const base=(process.env.NEXT_PUBLIC_APP_URL||"https://nayroq.finalarrow.com").replace(/\/$/,"");
  const results:Record<string,any>={};

  for(const lang of LANGUAGES){
    let next=0;
    const errors:string[]=[];
    async function worker(){
      while(true){
        const part=next++;
        if(part>=TOTAL)return;
        try{
          const response=await fetch(`${base}/api/i18n?lang=${lang}&part=${part}&v=${encodeURIComponent(VERSION)}`,{cache:"no-store"});
          const data=await response.json();
          if(!response.ok)throw new Error(data?.error||`HTTP ${response.status}`);
        }catch(error:any){
          errors.push(`part ${part}: ${error?.message||"failed"}`);
        }
      }
    }
    await Promise.all([worker(),worker()]);
    results[lang]={parts:TOTAL,errors};
  }

  console.log("NAYROQ interface language prewarm complete",results);
  return NextResponse.json({ok:true,version:VERSION,results});
}
