import{NextResponse}from"next/server";
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
      const invalid=keys.filter(key=>typeof parsed?.[key]!=="string"||!parsed[key].trim());
      if(invalid.length){
        lastError=`Translation response omitted ${invalid.length} strings`;
        continue;
      }
      return Object.fromEntries(keys.map(key=>[key,parsed[key].trim()]));
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
        {headers:{
          "Cache-Control":"public, s-maxage=31536000, stale-while-revalidate=86400",
          "X-NAYROQ-I18N-Version":API_VERSION
        }}
      );
    }

    const translations=await translateChunk(lang,keys);
    return NextResponse.json(
      {
        translations,
        done:(part+1)*COPY_CHUNK_SIZE>=ALL_KEYS.length,
        version:API_VERSION
      },
      {headers:{
        "Cache-Control":"public, s-maxage=31536000, stale-while-revalidate=86400",
        "X-NAYROQ-I18N-Version":API_VERSION
      }}
    );
  }catch(error:any){
    console.error("Interface translation failed",error);
    return NextResponse.json(
      {error:error?.message||"Translation error"},
      {status:500,headers:{"Cache-Control":"no-store"}}
    );
  }
}
