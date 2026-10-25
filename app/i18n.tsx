"use client";

import{
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
}from"react";
import{
  AR_COPY,
  COPY_CHUNK_SIZE,
  EN_COPY,
  INTERFACE_LANGUAGES,
  SEEDED_TRANSLATIONS,
  UI_COPY_VERSION,
  type Lang
}from"@/lib/i18n-copy";
import{
  EXTRA_INTERFACE_LANGUAGES,
  type ExtraInterfaceLang
}from"@/lib/i18n-extra-languages";
import{EXTRA_EN_COPY}from"@/lib/i18n-extra-copy";
import{MISC_EN_COPY}from"@/lib/i18n-misc-copy";
import{AR_EXTRA_COPY}from"@/lib/i18n-ar-extra";
import{
  GLOBAL_LAUNCH_EN_COPY,
  GLOBAL_LAUNCH_AR_COPY
}from"@/lib/global-launch-copy";

type InterfaceLang=Lang|ExtraInterfaceLang;
type Copy=Partial<Record<string,string>>;
type LanguageContext={
  lang:InterfaceLang;
  selectedLang:InterfaceLang;
  setLang:(lang:InterfaceLang)=>void;
  t:(key:string)=>string;
  isTranslating:boolean;
};

type CachedPack={
  version:string;
  keyCount:number;
  translations:Copy;
};

const ALL_INTERFACE_LANGUAGES={
  ...INTERFACE_LANGUAGES,
  ...EXTRA_INTERFACE_LANGUAGES
}as const;

const SOURCE_COPY:Record<string,string>={
  ...EN_COPY,
  ...EXTRA_EN_COPY,
  ...MISC_EN_COPY,
  ...GLOBAL_LAUNCH_EN_COPY
};

const ALL_KEYS=Object.keys(SOURCE_COPY);
const CACHE_VERSION=UI_COPY_VERSION+"-atomic-language-pack-v2";
const C=createContext<LanguageContext|null>(null);
const normalize=(value:string)=>value.replace(/\s+/g," ").trim();
const reverseEnglish=new Map<string,string>();

for(const[key,value]of Object.entries(SOURCE_COPY)){
  if(value)reverseEnglish.set(normalize(value),key);
}

function getSeed(lang:InterfaceLang):Copy{
  if(lang==="en")return SOURCE_COPY;
  if(lang==="ar")return{
    ...AR_COPY,
    ...AR_EXTRA_COPY,
    ...GLOBAL_LAUNCH_AR_COPY
  };
  return{...(((SEEDED_TRANSLATIONS as any)[lang]||{})as Copy)};
}

function isComplete(pack:Copy|undefined):boolean{
  if(!pack)return false;
  return ALL_KEYS.every(key=>typeof pack[key]==="string"&&Boolean(pack[key]?.trim()));
}

function cacheKey(lang:InterfaceLang){
  return`nayroq_i18n_${CACHE_VERSION}_${lang}`;
}

function readCachedPack(lang:InterfaceLang):Copy|null{
  try{
    const raw=localStorage.getItem(cacheKey(lang));
    if(!raw)return null;
    const parsed=JSON.parse(raw)as CachedPack;
    if(
      !parsed||
      parsed.version!==CACHE_VERSION||
      parsed.keyCount!==ALL_KEYS.length||
      !parsed.translations
    ){
      localStorage.removeItem(cacheKey(lang));
      return null;
    }
    const pack={...getSeed(lang),...parsed.translations};
    if(!isComplete(pack)){
      localStorage.removeItem(cacheKey(lang));
      return null;
    }
    return pack;
  }catch{
    try{localStorage.removeItem(cacheKey(lang))}catch{}
    return null;
  }
}

function writeCachedPack(lang:InterfaceLang,translations:Copy){
  try{
    const payload:CachedPack={
      version:CACHE_VERSION,
      keyCount:ALL_KEYS.length,
      translations
    };
    localStorage.setItem(cacheKey(lang),JSON.stringify(payload));
  }catch{}
}

function clearOldLanguageCaches(){
  try{
    const keepPrefix=`nayroq_i18n_${CACHE_VERSION}_`;
    for(let i=localStorage.length-1;i>=0;i--){
      const key=localStorage.key(i);
      if(key?.startsWith("nayroq_i18n_")&&!key.startsWith(keepPrefix)){
        localStorage.removeItem(key);
      }
    }
  }catch{}
}

async function loadLanguagePack(lang:InterfaceLang):Promise<Copy>{
  if(lang==="en")return SOURCE_COPY;

  const cached=readCachedPack(lang);
  if(cached)return cached;

  const seed=getSeed(lang);
  const total=Math.ceil(ALL_KEYS.length/COPY_CHUNK_SIZE);
  const chunks:Copy[]=new Array(total);
  let nextPart=0;
  const workerCount=Math.min(2,total);

  async function worker(){
    while(true){
      const part=nextPart++;
      if(part>=total)return;
      const response=await fetch(
        `/api/i18n?lang=${encodeURIComponent(lang)}&part=${part}&v=${encodeURIComponent(CACHE_VERSION)}`,
        {cache:"force-cache"}
      );
      const data=await response.json();
      if(!response.ok)throw new Error(data?.error||"Translation failed");
      chunks[part]=data?.translations||{};
    }
  }

  await Promise.all(Array.from({length:workerCount},()=>worker()));

  const translated=Object.assign({},...chunks)as Copy;
  const pack={...seed,...translated};
  if(!isComplete(pack)){
    const missing=ALL_KEYS.filter(key=>!pack[key]?.trim());
    throw new Error(`Incomplete language pack: ${missing.length} missing strings`);
  }

  writeCachedPack(lang,pack);
  return pack;
}

export function LanguageProvider({children}:{children:React.ReactNode}){
  const[lang,setLangState]=useState<InterfaceLang>("en");
  const[packs,setPacks]=useState<Record<string,Copy>>({en:SOURCE_COPY});
  const[loadingLanguage,setLoadingLanguage]=useState<InterfaceLang|null>(null);
  const[translationError,setTranslationError]=useState("");
  const packsRef=useRef<Record<string,Copy>>({en:SOURCE_COPY});
  const requestRef=useRef(0);
  const originalText=useRef(new Map<Text,string>());
  const originalAttrs=useRef(new Map<Element,Record<string,string>>());

  const applyLanguage=useCallback((next:InterfaceLang)=>{
    setLangState(next);
    localStorage.setItem("nayroq_language",next);
    document.documentElement.lang=next;
    document.documentElement.dir=next==="ar"?"rtl":"ltr";
  },[]);

  const requestLanguage=useCallback((next:InterfaceLang)=>{
    if(!(next in ALL_INTERFACE_LANGUAGES))next="en";
    const requestId=++requestRef.current;
    setTranslationError("");

    const existing=packsRef.current[next];
    if(next==="en"||isComplete(existing)){
      setLoadingLanguage(null);
      applyLanguage(next);
      return;
    }

    setLoadingLanguage(next);
    void loadLanguagePack(next)
      .then(pack=>{
        if(requestId!==requestRef.current)return;
        packsRef.current={...packsRef.current,[next]:pack};
        setPacks(p=>({...p,[next]:pack}));
        applyLanguage(next);
      })
      .catch(error=>{
        if(requestId!==requestRef.current)return;
        console.error("NAYROQ interface translation failed",error);
        setTranslationError(error instanceof Error?error.message:"Language could not be loaded");
      })
      .finally(()=>{
        if(requestId===requestRef.current)setLoadingLanguage(null);
      });
  },[applyLanguage]);

  useEffect(()=>{
    clearOldLanguageCaches();
    const stored=(localStorage.getItem("nayroq_language")||"en")as InterfaceLang;
    const next=stored in ALL_INTERFACE_LANGUAGES?stored:"en";
    if(next==="en")applyLanguage("en");
    else requestLanguage(next);
  },[applyLanguage,requestLanguage]);

  const t=useMemo(()=>{
    return(key:string)=>packs[lang]?.[key]||SOURCE_COPY[key]||key;
  },[lang,packs]);

  useEffect(()=>{
    const restore=()=>{
      for(const[node,value]of originalText.current){
        if(node.isConnected&&node.nodeValue!==value)node.nodeValue=value;
      }
      for(const[el,attrs]of originalAttrs.current){
        if(!el.isConnected)continue;
        for(const[name,value]of Object.entries(attrs)){
          if(el.getAttribute(name)!==value)el.setAttribute(name,value);
        }
      }
    };

    restore();
    if(lang==="en")return;

    const pack=packs[lang];
    if(!isComplete(pack))return;

    const translateText=(node:Text)=>{
      const parent=node.parentElement;
      if(!parent||parent.closest("script,style,code,pre,textarea,[data-no-translate]"))return;

      const current=node.nodeValue||"";
      const currentKey=reverseEnglish.get(normalize(current));
      if(currentKey)originalText.current.set(node,current);

      const original=originalText.current.get(node);
      if(!original)return;
      const key=reverseEnglish.get(normalize(original));
      if(!key)return;
      const translated=pack[key];
      if(!translated)return;

      const lead=original.match(/^\s*/)?.[0]||"";
      const tail=original.match(/\s*$/)?.[0]||"";
      const next=lead+translated+tail;
      if(node.nodeValue!==next)node.nodeValue=next;
    };

    const translateAttrs=(el:Element)=>{
      if(el.closest("[data-no-translate]"))return;
      const names=["placeholder","title","aria-label"];
      let saved=originalAttrs.current.get(el);

      for(const name of names){
        const current=el.getAttribute(name);
        if(!current)continue;
        if(reverseEnglish.has(normalize(current))){
          if(!saved){saved={};originalAttrs.current.set(el,saved)}
          saved[name]=current;
        }
        const original=saved?.[name];
        if(!original)continue;
        const key=reverseEnglish.get(normalize(original));
        if(!key||!pack[key])continue;
        if(el.getAttribute(name)!==pack[key])el.setAttribute(name,pack[key]!);
      }
    };

    const scan=(root:Node=document.body)=>{
      if(root.nodeType===Node.TEXT_NODE){
        translateText(root as Text);
        return;
      }
      if(root.nodeType!==Node.ELEMENT_NODE)return;
      translateAttrs(root as Element);
      const walker=document.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT
      );
      let node:Node|null;
      while((node=walker.nextNode())){
        if(node.nodeType===Node.TEXT_NODE)translateText(node as Text);
        else translateAttrs(node as Element);
      }
    };

    requestAnimationFrame(()=>scan());
    const observer=new MutationObserver(records=>{
      for(const record of records){
        if(record.type==="characterData")translateText(record.target as Text);
        for(const node of Array.from(record.addedNodes))scan(node);
      }
    });
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
    return()=>observer.disconnect();
  },[lang,packs]);

  const isTranslating=Boolean(loadingLanguage);
  const selectedLang=loadingLanguage||lang;
  const value=useMemo(()=>({
    lang,
    selectedLang,
    setLang:requestLanguage,
    t,
    isTranslating
  }),[lang,selectedLang,requestLanguage,t,isTranslating]);

  const loadingLabel=loadingLanguage
    ?String((ALL_INTERFACE_LANGUAGES as Record<string,string>)[loadingLanguage]||loadingLanguage)
    :"";

  return<C.Provider value={value}>
    {children}
    {isTranslating&&<div className="nq-language-loading" role="status" aria-live="polite">
      <span className="nq-language-spinner"/>
      <div><b>{loadingLabel}</b><small>Loading the complete language pack…</small></div>
    </div>}
    {translationError&&<button
      type="button"
      className="nq-language-error"
      onClick={()=>setTranslationError("")}
      aria-label="Dismiss translation error"
    >Language could not be loaded. Please try again. ×</button>}
  </C.Provider>;
}

export function useLanguage(){
  const value=useContext(C);
  if(!value)throw new Error("useLanguage must be used inside LanguageProvider");
  return value;
}

export function LanguageSwitch(){
  const{selectedLang,setLang,isTranslating}=useLanguage();
  return<select
    aria-label="Interface language"
    aria-busy={isTranslating}
    className={"langswitch "+(isTranslating?"translating":"")}
    value={selectedLang}
    disabled={isTranslating}
    onChange={event=>setLang(event.target.value as InterfaceLang)}
  >
    {Object.entries(ALL_INTERFACE_LANGUAGES).map(([code,label])=><option key={code} value={code}>
      {label}{isTranslating&&code===selectedLang?" …":""}
    </option>)}
  </select>;
}
