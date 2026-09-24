"use client";import AppNav from"@/app/components/AppNav";
import {useEffect,useState} from "react";
import Link from "next/link";import{LanguageSwitch,useLanguage}from"@/app/i18n";
import {createClient} from "@/lib/supabase/client";

export default function Manager(){const{lang,t}=useLanguage();
  const [data,setData]=useState<any>(null);
  useEffect(()=>{void load()},[]);
  async function load(){
    const s=createClient();
    const {data:{user}}=await s.auth.getUser();
    if(!user){window.location.href="/login";return}
    const {data:c}=await s.from("companies").select("*").eq("owner_id",user.id).limit(1).single();
    if(!c)return;
    const [cv,ld,qt,ho,tm,fu]=await Promise.all([
      s.from("conversations").select("*",{count:"exact",head:true}).eq("company_id",c.id),
      s.from("leads").select("*,contacts(name,phone),ai_employees(name)").eq("company_id",c.id),
      s.from("quotations").select("*").eq("company_id",c.id),
      s.from("conversations").select("id,channel,created_at,contacts(name,phone),ai_employees(name)").eq("company_id",c.id).eq("human_takeover",true),
      s.from("ai_employees").select("id,name,role,status").eq("company_id",c.id),
      s.from("follow_ups").select("*").eq("company_id",c.id).eq("status","pending")
    ]);
    const L=ld.data||[];
    setData({company:c,conversations:cv.count||0,leads:L.length,qualified:L.filter((x:any)=>x.stage==="qualified").length,quotes:(qt.data||[]).length,wins:L.filter((x:any)=>x.stage==="won").length,lost:L.filter((x:any)=>x.stage==="lost").length,revenue:L.filter((x:any)=>x.stage==="won").reduce((a:number,x:any)=>a+Number(x.value||0),0),handoffs:ho.data||[],team:tm.data||[],followups:fu.data||[],hot:L.filter((x:any)=>!["won","lost"].includes(x.stage)).slice(0,5)});
  }
  if(!data)return <main className="loading">{lang==="ar"?"جاري تجهيز ملخص مدير الذكاء الاصطناعي…":"Preparing your AI Manager brief…"}</main>;
  const funnel=[[t("conversations"),data.conversations],[t("leads"),data.leads],[t("qualified"),data.qualified],[t("quotations"),data.quotes],[t("won"),data.wins]];
  return <main className="appshell"><AppNav/><div className="appbody"><main className="module">
    <header><Link href="/dashboard">← Dashboard</Link><div className="logo"><i>N</i><b>NAYROQ</b></div><span>{lang==="ar"?"مدير الذكاء الاصطناعي":"AI Manager"}</span><LanguageSwitch/></header>
    <section>
      <div className="eyebrow">{t("executive").toUpperCase()}</div>
      <h1>{lang==="ar"?"هذه نظرة سريعة على أداء فريق الذكاء الاصطناعي.":"Good morning. Here’s what your AI team is doing."}</h1>
      <p>{data.team.filter((x:any)=>x.status==="active").length} active AI employees · {data.followups.length} follow-ups scheduled · {data.handoffs.length} conversations need human attention</p>
      <div className="managerstats">{[["Conversations",data.conversations],["Leads",data.leads],["Qualified",data.qualified],["Quotations",data.quotes],["Won",data.wins],["Revenue",data.revenue+" "+data.company.currency]].map((x:any)=><div className="stat" key={x[0]}><span>{x[0]}</span><strong>{x[1]}</strong></div>)}</div>
      <div className="managergrid">
        <div className="panel"><h3>{lang==="ar"?"مسار المبيعات":"Sales Funnel"}</h3>{funnel.map((x:any,i:number)=><div className="funnel" key={x[0]}><span>{x[0]}</span><div><i style={{width:Math.max(5,100-i*17)+"%"}}/></div><b>{x[1]}</b></div>)}</div>
        <div className="panel"><h3>{t("attention")} <em>{data.handoffs.length}</em></h3>{data.handoffs.length?data.handoffs.slice(0,6).map((x:any)=><div className="attention" key={x.id}><div><b>{x.contacts?.name||x.contacts?.phone||"Customer"}</b><small>{x.channel} · AI: {x.ai_employees?.name||"—"}</small></div><Link href="/inbox">{lang==="ar"?"فتح ←":"Open →"}</Link></div>):<div className="placeholder">{t("noAttention")}</div>}</div>
        <div className="panel"><h3>{t("openOpportunities")}</h3>{data.hot.length?data.hot.map((x:any)=><div className="attention" key={x.id}><div><b>{x.contacts?.name||x.contacts?.phone||"Lead"}</b><small>{x.stage} · {x.value||0} {x.currency}</small></div><Link href={"/leads/"+x.id}>{lang==="ar"?"مراجعة ←":"Review →"}</Link></div>):<div className="placeholder">{t("noOpportunities")}</div>}</div>
        <div className="panel"><h3>{t("aiTeam")}</h3>{data.team.map((x:any)=><div className="attention" key={x.id}><div><b>{x.name}</b><small>{String(x.role).replace("_"," ")}</small></div><em className="online">● {x.status}</em></div>)}</div>
      </div>
    </section>
  </main>
}