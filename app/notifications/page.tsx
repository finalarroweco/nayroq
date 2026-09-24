"use client";import AppNav from"@/app/components/AppNav";
import {useEffect,useState} from "react";
import Link from "next/link";import{LanguageSwitch,useLanguage}from"@/app/i18n";
import {createClient} from "@/lib/supabase/client";
export default function Notifications(){const{lang}=useLanguage();
 const[rows,setRows]=useState<any[]>([]);
 useEffect(()=>{void load()},[]);
 async function load(){const s=createClient();const{data:{user}}=await s.auth.getUser();if(!user){window.location.href="/login";return}const{data:c}=await s.from("companies").select("id").eq("owner_id",user.id).limit(1).single();if(!c)return;const{data}=await s.from("notifications").select("*").eq("company_id",c.id).order("created_at",{ascending:false});setRows(data||[])}
 async function markRead(id:string){await createClient().from("notifications").update({read:true}).eq("id",id);await load()}
 return <main className="appshell"><AppNav/><div className="appbody"><main className="module"><header><Link href="/dashboard">← Dashboard</Link><div className="logo"><i>N</i><b>NAYROQ</b></div><span>{lang==="ar"?"الإشعارات":"Notifications"}</span><LanguageSwitch/></header><section><div className="eyebrow">{lang==="ar"?"مركز التنبيهات":"ATTENTION CENTER"}</div><h1>{lang==="ar"?"الإشعارات":"Notifications"}</h1><p>{lang==="ar"?"أمور يحتاج فريق الذكاء الاصطناعي منك مراجعتها.":"Items your AI workforce needs you to review."}</p><div className="notificationlist">{rows.length?rows.map((n:any)=><article className={n.read?"read":""} key={n.id}><i>!</i><div><b>{n.title}</b><p>{n.body}</p><small>{new Date(n.created_at).toLocaleString()}</small></div><div>{n.link&&<Link href={n.link}>{lang==="ar"?"فتح ←":"Open →"}</Link>}{!n.read&&<button className="subtle" onClick={()=>markRead(n.id)}>{lang==="ar"?"تحديد كمقروء":"Mark read"}</button>}</div></article>):<div className="placeholder">{lang==="ar"?"لا توجد إشعارات جديدة.":"You’re all caught up."}</div>}</div></section></main>
}