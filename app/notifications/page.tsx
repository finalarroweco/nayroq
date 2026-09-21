"use client";
import {useEffect,useState} from "react";
import Link from "next/link";import{LanguageSwitch}from"@/app/i18n";
import {createClient} from "@/lib/supabase/client";
export default function Notifications(){
 const[rows,setRows]=useState<any[]>([]);
 useEffect(()=>{void load()},[]);
 async function load(){const s=createClient();const{data:{user}}=await s.auth.getUser();if(!user){window.location.href="/login";return}const{data:c}=await s.from("companies").select("id").eq("owner_id",user.id).limit(1).single();if(!c)return;const{data}=await s.from("notifications").select("*").eq("company_id",c.id).order("created_at",{ascending:false});setRows(data||[])}
 async function markRead(id:string){await createClient().from("notifications").update({read:true}).eq("id",id);await load()}
 return <main className="module"><header><Link href="/dashboard">← Dashboard</Link><div className="logo"><i>N</i><b>NAYROQ</b></div><span>Notifications</span><LanguageSwitch/></header><section><div className="eyebrow">ATTENTION CENTER</div><h1>Notifications</h1><p>Items your AI workforce needs you to review.</p><div className="notificationlist">{rows.length?rows.map((n:any)=><article className={n.read?"read":""} key={n.id}><i>!</i><div><b>{n.title}</b><p>{n.body}</p><small>{new Date(n.created_at).toLocaleString()}</small></div><div>{n.link&&<Link href={n.link}>Open →</Link>}{!n.read&&<button className="subtle" onClick={()=>markRead(n.id)}>Mark read</button>}</div></article>):<div className="placeholder">You’re all caught up.</div>}</div></section></main>
}