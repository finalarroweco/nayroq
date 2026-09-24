"use client";
import {useEffect,useState} from "react";import AppNav from"@/app/components/AppNav";
import Link from "next/link";import{LanguageSwitch,useLanguage}from"@/app/i18n";
import {createClient} from "@/lib/supabase/client";
type Step=[string,boolean,string,string];
export default function GettingStarted(){const{lang,t}=useLanguage();
 const[x,setX]=useState<any>(null);
 useEffect(()=>{void load()},[]);
 async function load(){const s=createClient();const{data:{user}}=await s.auth.getUser();if(!user){window.location.href="/login";return}const{data:c}=await s.from("companies").select("*").eq("owner_id",user.id).limit(1).single();if(!c)return;const[e,k,ch]=await Promise.all([s.from("ai_employees").select("*",{count:"exact",head:true}).eq("company_id",c.id),s.from("knowledge_items").select("*",{count:"exact",head:true}).eq("company_id",c.id),s.from("channel_connections").select("*",{count:"exact",head:true}).eq("company_id",c.id).eq("status","connected")]);setX({company:c,e:e.count||0,k:k.count||0,ch:ch.count||0})}
 if(!x)return <main className="loading">{lang==="ar"?"جاري تجهيز الإعداد…":"Preparing setup…"}</main>;
 const steps:Step[]=[[t("companyProfile"),Boolean(x.company.name),"/settings",t("confirmCompany")],[t("hireStep"),x.e>0,"/employees/new",t("hireStepDesc")],[t("knowledgeStep"),x.k>0,"/knowledge",t("knowledgeStepDesc")],[t("channelStep"),x.ch>0,"/integrations",lang==="ar"?"اربط واتساب أو إنستغرام أو قناة أخرى.":"Connect WhatsApp, Instagram or another channel."],[t("testStep"),x.e>0&&x.k>0,"/dashboard",t("testStepDesc")]];
 const done=steps.filter(s=>s[1]).length;
 return <main className="appshell"><AppNav/><div className="appbody"><main className="module"><header><Link href="/dashboard">← Dashboard</Link><div className="logo"><i>N</i><b>NAYROQ</b></div><span>{lang==="ar"?"البدء":"Getting Started"}</span><LanguageSwitch/></header><section><div className="eyebrow">{lang==="ar"?"الإعداد":"SETUP"}</div><h1>{t("launch")}</h1><p>{lang==="ar"?`${done} من ${steps.length} خطوات مكتملة`:`${done} of ${steps.length} steps completed`}</p><div className="setupbar"><i style={{width:(done/steps.length*100)+"%"}}/></div><div className="setupsteps">{steps.map((s,i)=><Link href={s[2]} className={s[1]?"done":""} key={s[0]}><i>{s[1]?"✓":i+1}</i><div><b>{s[0]}</b><p>{s[3]}</p></div><span>{s[1]?t("complete"):t("continueArrow")+" →"}</span></Link>)}</div></section></main></div></main>
}