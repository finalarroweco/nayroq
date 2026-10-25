import{NextResponse}from"next/server";
import{
  I18N_API_VERSION,
  getInterfaceTranslationChunk,
  isSupportedInterfaceLanguage
}from"@/lib/i18n-server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function responseHeaders(){
  return{
    "Cache-Control":"public, s-maxage=31536000, stale-while-revalidate=86400",
    "X-NAYROQ-I18N-Version":I18N_API_VERSION
  };
}

export async function GET(req:Request){
  try{
    const url=new URL(req.url);
    const langValue=url.searchParams.get("lang")||"";
    const partValue=Number(url.searchParams.get("part")||0);
    const part=Number.isInteger(partValue)&&partValue>=0?partValue:0;

    if(!isSupportedInterfaceLanguage(langValue)||langValue==="en"){
      return NextResponse.json({error:"Unsupported language"},{status:400});
    }

    const result=await getInterfaceTranslationChunk(langValue,part);
    return NextResponse.json(
      {...result,version:I18N_API_VERSION},
      {headers:responseHeaders()}
    );
  }catch(error:any){
    console.error("Interface translation failed",error);
    return NextResponse.json(
      {error:error?.message||"Translation error"},
      {status:500,headers:{"Cache-Control":"no-store"}}
    );
  }
}
