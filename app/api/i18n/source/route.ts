import{NextResponse}from"next/server";
import{COPY_CHUNK_SIZE}from"@/lib/i18n-copy";
import{
  I18N_ALL_KEYS,
  I18N_API_VERSION,
  I18N_SOURCE_COPY,
  I18N_TOTAL_PARTS
}from"@/lib/i18n-server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(req:Request){
  const url=new URL(req.url);
  const value=Number(url.searchParams.get("part")||0);
  const part=Number.isInteger(value)&&value>=0?value:0;
  const keys=I18N_ALL_KEYS.slice(part*COPY_CHUNK_SIZE,(part+1)*COPY_CHUNK_SIZE);
  if(!keys.length){
    return NextResponse.json({version:I18N_API_VERSION,part,totalParts:I18N_TOTAL_PARTS,source:{},done:true});
  }
  return NextResponse.json({
    version:I18N_API_VERSION,
    part,
    totalParts:I18N_TOTAL_PARTS,
    source:Object.fromEntries(keys.map(key=>[key,I18N_SOURCE_COPY[key]])),
    done:(part+1)>=I18N_TOTAL_PARTS
  },{headers:{"Cache-Control":"public, max-age=300"}});
}
