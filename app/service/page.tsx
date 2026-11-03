"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Headphones, MessageSquare, Phone, RefreshCw } from "lucide-react";
import AppNav from "@/app/components/AppNav";
import { LanguageSwitch, useLanguage } from "@/app/i18n";
import { ownerWorkspace } from "@/lib/service/company";
import { channelLabel, statusLabel } from "@/lib/ui-labels";
import styles from "./service.module.css";

type Conversation = { id: string; channel: string; status: string; human_takeover: boolean; created_at: string; contacts: { name: string | null; phone: string | null } | null };
type Summary = { total: number; handoff: number; open: number };

export default function ServiceCenter() {
  const { lang, t } = useLanguage();
  const ar = lang === "ar";
  const copy = (en: string, arabic: string) => ar ? arabic : en;
  const [workspaceRole,setWorkspaceRole]=useState("agent");
  const [rows, setRows] = useState<Conversation[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, handoff: 0, open: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [missingCompany, setMissingCompany] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError(false); setMissingCompany(false);
      try {
        const {client:s,company,role} = await ownerWorkspace();
        if(active)setWorkspaceRole(role);
        const companyId = company.id;
        const [recent, total, handoff, open] = await Promise.all([
          s.from("conversations").select("id,channel,status,human_takeover,created_at,contacts(name,phone)").eq("company_id", companyId).order("created_at", { ascending: false }).limit(100),
          s.from("conversations").select("id", { count: "exact", head: true }).eq("company_id", companyId),
          s.from("conversations").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("human_takeover", true).neq("status", "closed"),
          s.from("conversations").select("id", { count: "exact", head: true }).eq("company_id", companyId).neq("status", "closed"),
        ]);
        for (const result of [recent, total, handoff, open]) if (result.error) throw result.error;
        if (active) {
          setRows((recent.data || []) as unknown as Conversation[]);
          setSummary({ total: total.count || 0, handoff: handoff.count || 0, open: open.count || 0 });
        }
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [revision]);

  const visible = rows.filter(row => (filter !== "human" || (row.human_takeover && row.status !== "closed")) && (filter !== "open" || row.status !== "closed") && `${row.contacts?.name || ""} ${row.contacts?.phone || ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <main className="appshell"><AppNav /><div className="appbody"><div className={`module ${styles.center}`} dir={ar ? "rtl" : "ltr"} data-no-translate>
    <header><div className="logo"><i>N</i><b>NAYROQ</b></div><LanguageSwitch /></header>
    <section>
      <div className={styles.heading}><div><small>NAYROQ · CUSTOMER OPERATIONS</small><h1>{copy("Customer service center", "مركز خدمة العملاء")}</h1><p>{copy("Your conversations, human handoffs and voice launch readiness in one place.", "محادثات العملاء والتحويل للموظفين وتجهيز المكالمات في مكان واحد.")}</p></div><Headphones size={42} /></div>
      <nav className={styles.tabs} aria-label={copy("Service tools", "أدوات الخدمة")}><Link href="/service/team">{copy("Service team", "فريق الخدمة")}</Link><Link href="/service/tickets">{copy("Support tickets", "تذاكر الدعم")}</Link>{workspaceRole!=="agent"&&<Link href="/service/configuration">{copy("Assistant & voice setup", "إعداد المساعد والمكالمات")}</Link>}<Link href="/service/reports">{copy("Usage & reports", "الاستهلاك والتقارير")}</Link>{workspaceRole==="owner"&&<Link href="/billing">{copy("Plan & subscription", "الباقة والاشتراك")}</Link>}</nav><div className={styles.metrics}>{[[copy("All conversations", "كل المحادثات"), summary.total], [copy("Open conversations", "المحادثات المفتوحة"), summary.open], [copy("With your team", "لدى فريقك"), summary.handoff]].map(([label, count]) => <article key={label}><span>{label}</span><strong>{loading || error || missingCompany ? "—" : count}</strong></article>)}</div>
      <div className={styles.columns}><article className={`panel ${styles.queue}`}>
        <div className={styles.toolbar}><h2><MessageSquare size={20} /> {copy("Service queue", "قائمة خدمة العملاء")}</h2><button type="button" disabled={loading} onClick={() => setRevision(n => n + 1)} aria-label={copy("Refresh", "تحديث")}><RefreshCw size={17} /></button></div>
        <div className={styles.filters}><input aria-label={copy("Search customers", "بحث العملاء")} placeholder={copy("Search name or phone", "ابحث بالاسم أو الهاتف")} value={search} onChange={e => setSearch(e.target.value)} /><select aria-label={copy("Conversation filter", "تصفية المحادثات")} value={filter} onChange={e => setFilter(e.target.value)}><option value="all">{copy("All", "الكل")}</option><option value="open">{copy("Open", "مفتوحة")}</option><option value="human">{copy("With team", "لدى الفريق")}</option></select></div>
        <small>{copy("Showing the latest 100 conversations. Totals cover all conversations. Refresh to load updates.", "تظهر آخر ١٠٠ محادثة. الأعداد تشمل كل المحادثات. اضغط تحديث لجلب المستجدات.")}</small>
        {loading ? <p role="status">{copy("Loading…", "جارٍ التحميل…")}</p> : error ? <p role="alert">{copy("Unable to load company data. Please retry.", "تعذّر تحميل بيانات الشركة. يرجى إعادة المحاولة.")}</p> : missingCompany ? <p>{copy("Complete company setup to start.", "أكمل إعداد شركتك للبدء.")} <Link href="/onboarding">{copy("Set up company", "إعداد الشركة")}</Link></p> : visible.length ? <ul className={styles.list}>{visible.map(row => <li key={row.id}><Link href={`/inbox?conversation=${encodeURIComponent(row.id)}`}><div><b>{row.contacts?.name || row.contacts?.phone || t("customer")}</b><small>{channelLabel(row.channel, t)} · {statusLabel(row.status, t)}</small></div><div><span>{row.human_takeover ? copy("Team", "الفريق") : "AI"}</span><small>{new Date(row.created_at).toLocaleDateString(ar ? "ar-OM" : "en-GB", { timeZone: "Asia/Muscat" })}</small></div></Link></li>)}</ul> : <p>{copy("No matching conversations yet.", "لا توجد محادثات مطابقة حاليًا.")}</p>}
      </article><aside className={styles.setup}><article className="panel"><Phone size={26} /><h2>{copy("Voice service", "خدمة المكالمات")}</h2><span className={styles.pending}>{copy("Not connected", "غير مربوط")}</span><p>{copy("Phone calls are not active in this release. Connect and verify a telephony provider before accepting customer calls.", "المكالمات غير مفعّلة في هذه النسخة. نحتاج ربط مزوّد اتصالات والتحقق منه قبل استقبال مكالمات العملاء.")}</p><ol><li>{copy("Confirm business number and SIP routing", "تأكيد رقم الشركة ومسار SIP")}</li><li>{copy("Configure assistant and human transfer", "إعداد المساعد والتحويل لموظف")}</li><li>{copy("Test Arabic, interruptions and fallback", "اختبار العربي والمقاطعة والمسار البديل")}</li></ol></article><article className="panel"><h2>{copy("Prepare your workspace", "جهّز مساحة العمل")}</h2><Link href="/knowledge">{copy("Manage company knowledge", "إدارة معلومات الشركة")} ↗</Link><Link href="/employees">{copy("Configure AI employees", "إعداد موظفي AI")} ↗</Link><Link href="/integrations">{copy("Manage messaging channels", "إدارة قنوات الرسائل")} ↗</Link><Link href="/inbox">{copy("Open unified inbox", "فتح صندوق المحادثات")} ↗</Link></article></aside></div>
    </section>
  </div></div></main>;
}
