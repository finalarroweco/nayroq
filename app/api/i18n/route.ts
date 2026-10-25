import{NextResponse}from"next/server";
import{createClient}from"@supabase/supabase-js";
import{
  COPY_CHUNK_SIZE,
  EN_COPY,
  INTERFACE_LANGUAGES,
  LANGUAGE_NAMES,
  UI_COPY_VERSION,
  type Lang
}from"@/lib/i18n-copy";
import{
  EXTRA_INTERFACE_LANGUAGES,
  EXTRA_LANGUAGE_NAMES,
  type ExtraInterfaceLang
}from"@/lib/i18n-extra-languages";
import{EXTRA_EN_COPY}from"@/lib/i18n-extra-copy";
import{MISC_EN_COPY}from"@/lib/i18n-misc-copy";
import{GLOBAL_LAUNCH_EN_COPY}from"@/lib/global-launch-copy";

export const runtime="nodejs";
export const dynamic="force-dynamic";

type SupportedLang=Lang|ExtraInterfaceLang;
const ALL_LANGUAGES={...INTERFACE_LANGUAGES,...EXTRA_INTERFACE_LANGUAGES}as const;
const ALL_LANGUAGE_NAMES:Record<string,string>={
  ...LANGUAGE_NAMES,
  ...EXTRA_LANGUAGE_NAMES
};
const SOURCE_COPY:Record<string,string>={
  ...EN_COPY,
  ...EXTRA_EN_COPY,
  ...MISC_EN_COPY,
  ...GLOBAL_LAUNCH_EN_COPY
};
const ALL_KEYS=Object.keys(SOURCE_COPY);
const API_VERSION=UI_COPY_VERSION+"-atomic-language-pack-v2";

function outputText(data:any){
  let text=data?.output_text||"";
  if(!text&&Array.isArray(data?.output)){
    for(const item of data.output||[]){
      if(!Array.isArray(item?.content))continue;
      for(const part of item.content){
        if(part?.type==="output_text"&&part?.text)text+=part.text;
      }
    }
  }
  return text;
}

function isValidChunk(value:any,keys:string[]):value is Record<string,string>{
  return Boolean(value)&&keys.every(key=>typeof value[key]==="string"&&Boolean(value[key].trim()));
}

function responseHeaders(){
  return{
    "Cache-Control":"public, s-maxage=31536000, stale-while-revalidate=86400",
    "X-NAYROQ-I18N-Version":API_VERSION
  };
}

function getAdmin(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{persistSession:false}});
}

async function readCachedChunk(lang:SupportedLang,part:number,keys:string[]){
  const admin=getAdmin();
  if(!admin)return null;
  try{
    const{data,error}=await admin
      .from("ui_translation_chunks")
      .select("translations")
      .eq("version",API_VERSION)
      .eq("lang",lang)
      .eq("part",part)
      .maybeSingle();
    if(error||!isValidChunk(data?.translations,keys))return null;
    return data.translations as Record<string,string>;
  }catch(error){
    console.error("Could not read interface translation cache",error);
    return null;
  }
}

async function writeCachedChunk(lang:SupportedLang,part:number,translations:Record<string,string>){
  const admin=getAdmin();
  if(!admin)return;
  try{
    const{error}=await admin.from("ui_translation_chunks").upsert({
      version:API_VERSION,
      lang,
      part,
      translations,
      updated_at:new Date().toISOString()
    },{onConflict:"version,lang,part"});
    if(error)console.error("Could not save interface translation cache",error);
  }catch(error){
    console.error("Could not save interface translation cache",error);
  }
}

async function translateChunk(lang:SupportedLang,keys:string[]){
  const source=Object.fromEntries(keys.map(key=>[key,SOURCE_COPY[key]]));
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey)throw new Error("Translation service is not configured");

  const prompt=`Translate every JSON value from English into ${ALL_LANGUAGE_NAMES[lang]}. Return only one valid JSON object with exactly the same keys. Preserve NAYROQ, Final Arrow, AI, CRM, WhatsApp, Meta, API, PayPal, URLs, email addresses, currency codes, numbers, arrows, placeholders, HTML tags and technical identifiers. Use clear, natural and professional software-interface language. Do not omit, rename or add keys.\n\n${JSON.stringify(source)}`;

  let lastError="Translation failed";
  for(let attempt=1;attempt<=2;attempt++){
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        Authorization:"Bearer "+apiKey
      },
      body:JSON.stringify({
        model:process.env.OPENAI_TRANSLATION_MODEL||process.env.OPENAI_MODEL||"gpt-5.6-luna",
        instructions:"You are a precise software localization engine. Output strict JSON only, without markdown.",
        input:prompt,
        reasoning:{effort:"none"}
      }),
      cache:"no-store"
    });

    const data=await response.json();
    if(!response.ok){
      lastError=data?.error?.message||`Translation request failed (${response.status})`;
      continue;
    }

    const raw=outputText(data)
      .trim()
      .replace(/^```json\s*/i,"")
      .replace(/\s*```$/i,"");

    try{
      const parsed=JSON.parse(raw);
      if(!isValidChunk(parsed,keys)){
        const invalid=keys.filter(key=>typeof parsed?.[key]!=="string"||!parsed[key].trim());
        lastError=`Translation response omitted ${invalid.length} strings`;
        continue;
      }
      return Object.fromEntries(keys.map(key=>[key,parsed[key].trim()]))as Record<string,string>;
    }catch{
      lastError="Invalid translation JSON response";
      console.error("Interface translation JSON parse failed",raw.slice(0,500));
    }
  }

  throw new Error(lastError);
}

export async function GET(req:Request){
  try{
    const url=new URL(req.url);
    const lang=url.searchParams.get("lang")as SupportedLang;
    const partValue=Number(url.searchParams.get("part")||0);
    const part=Number.isInteger(partValue)&&partValue>=0?partValue:0;

    if(!lang||!(lang in ALL_LANGUAGES)||lang==="en"){
      return NextResponse.json({error:"Unsupported language"},{status:400});
    }

    const keys=ALL_KEYS.slice(part*COPY_CHUNK_SIZE,(part+1)*COPY_CHUNK_SIZE);
    if(!keys.length){
      return NextResponse.json(
        {translations:{},done:true,version:API_VERSION},
        {headers:responseHeaders()}
      );
    }

    const cached=await readCachedChunk(lang,part,keys);
    if(cached){
      return NextResponse.json(
        {
          translations:cached,
          done:(part+1)*COPY_CHUNK_SIZE>=ALL_KEYS.length,
          version:API_VERSION,
          cached:true
        },
        {headers:responseHeaders()}
      );
    }

    const translations=await translateChunk(lang,keys);
    await writeCachedChunk(lang,part,translations);
    return NextResponse.json(
      {
        translations,
        done:(part+1)*COPY_CHUNK_SIZE>=ALL_KEYS.length,
        version:API_VERSION,
        cached:false
      },
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
