import {dbSelect} from "@/lib/server/db";
import {getParentContext,withSession} from "@/lib/server/parent-portal";
export const dynamic="force-dynamic";
export default async function ParentContact({searchParams}:{searchParams:Promise<{session?:string;student?:string}>}){
  const params=await searchParams;const ctx=await getParentContext(params.session);
  const student=ctx.children.find((s:any)=>s.id===params.student)||ctx.children[0]||null;
  const s=(await dbSelect("parent_app_settings","select=*&id=eq.main&limit=1").catch(()=>[] as any[]))[0]||{};
  const wa=String(s.whatsapp||"").replace(/\D/g,"");
  return <div className="parent-live-v42"><header className="parent-live-header-v42"><div><span>الدعم</span><h1>{s.contact_title||"تواصل معنا"}</h1><small>{s.contact_subtitle||"يسعدنا مساعدتك"}</small></div></header>
  <main className="parent-contact-page-v117">
    {s.phone?<a href={`tel:${s.phone}`}><i>☎</i><div><strong>اتصال هاتفي</strong><span>{s.phone}</span></div></a>:null}
    {wa?<a href={`https://wa.me/${wa}`} target="_blank"><i>◉</i><div><strong>WhatsApp</strong><span>{s.whatsapp}</span></div></a>:null}
    {s.email?<a href={`mailto:${s.email}`}><i>✉</i><div><strong>البريد الإلكتروني</strong><span>{s.email}</span></div></a>:null}
    {s.address?<section><strong>العنوان</strong><p>{s.address}</p></section>:null}
  </main>
  <nav className="parent-bottom-nav-v42"><a href={withSession(`/parent${student?`?student=${student.id}`:""}`,ctx.linkToken)}>الرئيسية</a><a href={withSession(`/parent/reports${student?`?student=${student.id}`:""}`,ctx.linkToken)}>التقارير</a><a href={withSession(`/parent/account${student?`?student=${student.id}`:""}`,ctx.linkToken)}>الحساب</a></nav></div>
}