"use client";
import {useEffect,useState} from "react";
import Link from "next/link";import{LanguageSwitch,useLanguage}from"@/app/i18n";
import {createClient} from "@/lib/supabase/client";
type Step=[string,boolean,string,string];
export default function GettingStarted(){const{lang,t}=useLanguage();
 const[x,setX]=useState<any>(null);
 useEffect(()=>{void load()},[]);
 async function load(){const s=createClient();const{data:{user}}=await s.auth.getUser();if(!user){window.location.href="/login";return}const{data:c}=await s.from("companies").select("*").eq("owner_id",user.id).limit(1).single();if(!c)return;const[e,k,ch]=await Promise.all([s.from("ai_employees").select("*",{count:"exact",head:true}).eq("company_id",c.id),s.from("knowledge_items").select("*",{count:"exact",head:true}).eq("company_id",c.id),s.from("channel_connections").select("*",{count:"exact",head:true}).eq("company_id",c.id).eq("status","connected")]);setX({company:c,e:e.count||0,k:k.count||0,ch:ch.count||0})}
 if(!x)return <main className="loading">Preparing setup…</main>;
 const steps:Step[]=[["Company profile",Boolean(x.company.name),"/settings","Confirm your company, market and currency."],["Hire an AI employee",x.e>0,"/employees/new","Choose a role, goal, language and tone."],["Add business knowledge",x.k>0,"/knowledge","Teach NAYROQ your services, prices and policies."],["Connect a channel",x.ch>0,"/integrations",lang==="ar"?"اربط واتساب أو إنستغرام أو قناة أخرى.":"Connect WhatsApp, Instagram or another channel."],["Test your AI",x.e>0&&x.k>0,"/dashboard","Open an employee and run a test conversation."]];
 const done=steps.filter(s=>s[1]).length;
 return <main className="module"><header><Link href="/dashboard">← Dashboard</Link><div className="logo"><i>N</i><b>NAYROQ</b></div><span>Getting Started</span><LanguageSwitch/></header><section><div className="eyebrow">SETUP</div><h1>Launch your AI workforce.</h1><p>{done} of {steps.length} steps completed</p><div className="setupbar"><i style={{width:(done/steps.length*100)+"%"}}/></div><div className="setupsteps">{steps.map((s,i)=><Link href={s[2]} className={s[1]?"done":""} key={s[0]}><i>{s[1]?"✓":i+1}</i><div><b>{s[0]}</b><p>{s[3]}</p></div><span>{s[1]?"Complete":"Continue →"}</span></Link>)}</div></section></main>
}