"use client";
import AppNav from "@/app/components/AppNav";
import Link from "next/link";
import {useEffect,useState} from "react";
import {LanguageSwitch,useLanguage} from "@/app/i18n";
import {createClient} from "@/lib/supabase/client";

export default function EmployeesPage(){
 const {lang,t}=useLanguage();
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
 return <main className="appshell"><AppNav/><div className="appbody"><main className="module"><header><Link href="/dashboard">← Dashboard</Link><div className="logo"><i>N</i><b>NAYROQ</b></div><span>{t("employees")}</span><LanguageSwitch/></header><section><div className="employeehead"><div><div className="eyebrow">NAYROQ AI WORKFORCE</div><h1>{t("employees")}</h1><p>{t("manageWorkforce")}</p></div><Link className="button" href="/employees/new">{t("newEmployee")}</Link></div>{loading?<div className="panel">{lang==="ar"?"جاري تحميل الموظفين…":"Loading employees…"}</div>:error?<div className="panel"><b>{lang==="ar"?"تعذر تحميل الموظفين":"Could not load employees"}</b><p>{error}</p></div>:employees.length===0?<div className="panel"><h3>{t("noEmployees")}</h3><p>{t("createFirstEmployee")}</p><Link className="button" href="/employees/new">{t("createEmployee")}</Link></div>:<div className="employeegrid">{employees.map(emp=><div className="panel" key={emp.id}><div className="eyebrow">{String(emp.role||"AI employee").replaceAll("_"," ").toUpperCase()}</div><h2>{emp.name}</h2><p>{emp.goal|| (lang==="ar"?"موظف ذكاء اصطناعي":"AI employee")}</p><dl><dt>{t("status")}</dt><dd>{emp.status||"active"}</dd><dt>{t("language")}</dt><dd>{emp.language||"auto"}</dd><dt>{t("responseMode")}</dt><dd>{emp.response_mode||"text"}</dd><dt>{t("voice")}</dt><dd>{emp.voice_name||"alloy"}</dd></dl><Link className="button" href={`/employees/${emp.id}`}>{t("manageEdit")}</Link></div>)}</div>}</section></main></div></main>
}