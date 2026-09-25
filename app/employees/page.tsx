"use client";
import AppNav from "@/app/components/AppNav";
import Link from "next/link";
import {useEffect,useState} from "react";
import {LanguageSwitch,useLanguage} from "@/app/i18n";
import {createClient} from "@/lib/supabase/client";

export default function EmployeesPage(){
 const {lang}=useLanguage();
 const [employees,setEmployees]=useState<any[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 useEffect(()=>{(async()=>{
  const s=createClient();
  const {data:{user}}=await s.auth.getUser();
  if(!user){location.href="/login";return;}
  let companyId:string|undefined;
  const {data:owned}=await s.from("companies").select("id").eq("owner_id",user.id).limit(1).maybeSingle();
  companyId=owned?.id;
  if(!companyId){const {data:membership}=await s.from("company_members").select("company_id").eq("user_id",user.id).limit(1).maybeSingle();companyId=membership?.company_id;}
  if(!companyId){setError(lang==="ar"?"لم يتم العثور على الشركة":"Company not found");setLoading(false);return;}
  const {data,error}=await s.from("ai_employees").select("*").eq("company_id",companyId).order("created_at",{ascending:true});
  if(error)setError(error.message); else setEmployees(data||[]);
  setLoading(false);
 })()},[lang]);
 return <main className="appshell"><AppNav/><div className="appbody"><main className="module"><header><Link href="/dashboard">← Dashboard</Link><div className="logo"><i>N</i><b>NAYROQ</b></div><span>{lang==="ar"?"موظفو الذكاء الاصطناعي":"AI Employees"}</span><LanguageSwitch/></header><section><div className="employeehead"><div><div className="eyebrow">NAYROQ AI WORKFORCE</div><h1>{lang==="ar"?"موظفو الذكاء الاصطناعي":"AI Employees"}</h1><p>{lang==="ar"?"إدارة موظفيك وإعداداتهم وطريقة الرد والصوت.":"Manage your AI workforce, response modes, voice and instructions."}</p></div><Link className="button" href="/employees/new">{lang==="ar"?"+ موظف جديد":"+ New Employee"}</Link></div>{loading?<div className="panel">{lang==="ar"?"جاري تحميل الموظفين…":"Loading employees…"}</div>:error?<div className="panel"><b>{lang==="ar"?"تعذر تحميل الموظفين":"Could not load employees"}</b><p>{error}</p></div>:employees.length===0?<div className="panel"><h3>{lang==="ar"?"لا يوجد موظفون بعد":"No employees yet"}</h3><p>{lang==="ar"?"أنشئ أول موظف AI وابدأ ربطه بقنواتك.":"Create your first AI employee and connect it to your channels."}</p><Link className="button" href="/employees/new">{lang==="ar"?"إنشاء موظف":"Create Employee"}</Link></div>:<div className="employeegrid">{employees.map(emp=><div className="panel" key={emp.id}><div className="eyebrow">{String(emp.role||"AI employee").replaceAll("_"," ").toUpperCase()}</div><h2>{emp.name}</h2><p>{emp.goal|| (lang==="ar"?"موظف ذكاء اصطناعي":"AI employee")}</p><dl><dt>{lang==="ar"?"الحالة":"Status"}</dt><dd>{emp.status||"active"}</dd><dt>{lang==="ar"?"اللغة":"Language"}</dt><dd>{emp.language||"auto"}</dd><dt>{lang==="ar"?"طريقة الرد":"Response Mode"}</dt><dd>{emp.response_mode||"text"}</dd><dt>{lang==="ar"?"الصوت":"Voice"}</dt><dd>{emp.voice_name||"alloy"}</dd></dl><Link className="button" href={`/employees/${emp.id}`}>{lang==="ar"?"إدارة وتعديل":"Manage & Edit"}</Link></div>)}</div>}</section></main></div></main>
}