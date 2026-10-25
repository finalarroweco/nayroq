import{NextResponse}from"next/server";
import{COPY_CHUNK_SIZE}from"@/lib/i18n-copy";
import{I18N_ALL_KEYS,I18N_SOURCE_COPY,getInterfaceTranslationChunk,isSupportedInterfaceLanguage,type SupportedInterfaceLang}from"@/lib/i18n-server";
export const runtime="nodejs";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,OPTIONS","Access-Control-Allow-Headers":"Content-Type"};
const KEYS=["aiAssistant","widgetGreeting","typeMessage","send","widgetError","teamMemberHelping"]as const;
export async function OPTIONS(){return new Response(null,{status:204,headers:CORS})}
export async function GET(req:Request){try{const requested=new URL(req.url).searchParams.get("lang")||"en";const lang=(isSupportedInterfaceLanguage(requested)?requested:"en")as SupportedInterfaceLang;if(lang==="en")return NextResponse.json({copy:Object.fromEntries(KEYS.map(key=>[key,I18N_SOURCE_COPY[key]]))},{headers:{...CORS,"Cache-Control":"public, s-maxage=31536000, stale-while-revalidate=86400"}});const parts=[...new Set(KEYS.map(key=>Math.floor(I18N_ALL_KEYS.indexOf(key)/COPY_CHUNK_SIZE)).filter(part=>part>=0))];const chunks=await Promise.all(parts.map(part=>getInterfaceTranslationChunk(lang,part)));const merged=Object.assign({},...chunks.map(chunk=>chunk.translations));return NextResponse.json({copy:Object.fromEntries(KEYS.map(key=>[key,merged[key]||I18N_SOURCE_COPY[key]]))},{headers:{...CORS,"Cache-Control":"public, s-maxage=31536000, stale-while-revalidate=86400"}})}catch(error:any){return NextResponse.json({error:error?.message||"Translation error"},{status:500,headers:CORS})}}
