import {getParentContext,withSession} from "@/lib/server/parent-portal";

export const dynamic="force-dynamic";
export const revalidate=0;

export default async function ParentAccount({
  searchParams
}:{
  searchParams:Promise<{session?:string;student?:string}>
}){
  const params=await searchParams;
  const ctx=await getParentContext(params.session);
  const student=ctx.children.find((s:any)=>s.id===params.student)||ctx.children[0]||null;

  return <div className="parent-live-v42">
    <header className="parent-live-header-v42">
      <div><span>الحساب</span><h1>{ctx.parent?.name||"ولي الأمر"}</h1><small>{ctx.parent?.parent_code||""}</small></div>
    </header>

    <main className="parent-account-v58">
      <section className="parent-account-card-v58">
        <h2>بيانات ولي الأمر</h2>
        <div><span>الاسم</span><strong>{ctx.parent?.name||"—"}</strong></div>
        <div><span>رقم التليفون</span><strong>{ctx.parent?.phone||"—"}</strong></div>
        <div><span>كود ولي الأمر</span><strong>{ctx.parent?.parent_code||"—"}</strong></div>
      </section>

      <section className="parent-account-card-v58">
        <h2>الطلاب المرتبطون بالحساب</h2>
        {ctx.children.map((s:any)=><a key={s.id} href={withSession(`/parent/account?student=${s.id}`,ctx.linkToken)} className={s.id===student?.id?"active":""}>
          <div><strong>{s.name}</strong><small>{s.code} · {s.course}</small></div>
        </a>)}
      </section>

      <form action="/api/auth/logout-form" method="post" className="parent-logout-form-v58">
        <button type="submit">تسجيل الخروج</button>
      </form>
    </main>

    <nav className="parent-bottom-nav-v42">
      <a href={withSession(`/parent${student?`?student=${student.id}`:""}`,ctx.linkToken)}>الرئيسية</a>
      <a href={withSession(`/parent/reports${student?`?student=${student.id}`:""}`,ctx.linkToken)}>التقارير</a>
      <a className="active" href={withSession(`/parent/account${student?`?student=${student.id}`:""}`,ctx.linkToken)}>الحساب</a>
    </nav>
  </div>;
}
