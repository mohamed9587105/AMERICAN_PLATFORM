import {dbSelect} from "@/lib/server/db";
import {getParentContext,withSession,asArray,percent} from "@/lib/server/parent-portal";

export const dynamic="force-dynamic";
export const revalidate=0;

export default async function ParentReports({
  searchParams
}:{
  searchParams:Promise<{session?:string;student?:string;report?:string}>
}){
  const params=await searchParams;
  const ctx=await getParentContext(params.session);
  if(!ctx.children.length) return <main className="parent-empty-v42">لا يوجد طالب مرتبط بالحساب.</main>;

  const student=ctx.children.find((s:any)=>s.id===params.student)||ctx.children[0];
  const reports=await dbSelect(
    "weekly_reports",
    `select=*,attendance_entries(*),homework_entries(*),exam_entries(*,exam_sections(*)),finance_entries(*)&student_id=eq.${encodeURIComponent(student.id)}&status=eq.published&order=week_start.desc`
  );
  const report=reports.find((r:any)=>r.id===params.report)||reports[0]||null;

  const attendance=asArray(report?.attendance_entries);
  const homework=asArray(report?.homework_entries);
  const exams=asArray(report?.exam_entries);
  const finance=asArray(report?.finance_entries);

  const avg=(vals:number[])=>vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):0;
  const metrics={
    exams:avg(exams.map((e:any)=>percent(Number(e.score),Number(e.max_score)))),
    homework:avg(homework.filter((h:any)=>h.score!=null&&h.max_score).map((h:any)=>percent(Number(h.score),Number(h.max_score)))),
    attendance:attendance.length?Math.round(attendance.filter((a:any)=>a.status==="present").length/attendance.length*100):0
  };

  return <div className="parent-live-v42">
    <header className="parent-live-header-v42">
      <div><span>التقارير الأسبوعية</span><h1>{student.name}</h1><small>{student.code} · {student.course}</small></div>
    </header>

    <section className="parent-week-tabs-v42">
      {reports.map((r:any)=><a key={r.id} className={r.id===report?.id?"active":""} href={withSession(`/parent/reports?student=${student.id}&report=${r.id}`,ctx.linkToken)}>
        <strong>{r.week_label}</strong><small>{r.week_start} → {r.week_end}</small>
      </a>)}
    </section>

    {report?<main className="parent-live-main-v42">
      <section className="parent-summary-card-v42"><span>التقرير الأسبوعي</span><h2>{report.week_label}</h2><p>{report.followup_note||"لا توجد ملاحظة متابعة."}</p></section>
      <section className="parent-metrics-v42">
        <article><span>الامتحانات</span><strong>{metrics.exams}%</strong></article>
        <article><span>الواجبات</span><strong>{metrics.homework}%</strong></article>
        <article><span>الحضور</span><strong>{metrics.attendance}%</strong></article>
      </section>

      <section className="parent-report-block-v42 exams"><div className="parent-block-head-v42"><h3>الامتحانات</h3><span>{exams.length}</span></div>
        {exams.map((e:any)=><article key={e.id}><div className="parent-exam-head-v42"><div><strong>{e.title}</strong><small>{e.date||""}</small></div><b>{e.score} / {e.max_score}</b></div>
          {asArray(e.exam_sections).length?<div className="parent-exam-sections-v42">{asArray(e.exam_sections).map((s:any)=><span key={s.id}>{s.name}<b>{s.score} / {s.max_score}</b></span>)}</div>:null}
        </article>)}
      </section>

      <section className="parent-report-block-v42 homework"><div className="parent-block-head-v42"><h3>الواجبات</h3><span>{homework.length}</span></div>
        {homework.map((h:any)=><article key={h.id} className="parent-row-v42"><div><strong>{h.title}</strong><small>{h.due_date||""}</small></div><b>{h.score!=null&&h.max_score?`${h.score} / ${h.max_score}`:"—"}</b></article>)}
      </section>

      <section className="parent-report-block-v42 attendance"><div className="parent-block-head-v42"><h3>الحضور</h3><span>{attendance.length}</span></div>
        {attendance.map((a:any)=><article key={a.id} className="parent-row-v42"><div><strong>{a.date}</strong><small>{a.note||""}</small></div><b>{a.status==="present"?"حاضر":a.status==="absent"?"غائب":"متأخر"}</b></article>)}
      </section>

      <section className="parent-report-block-v42 finance"><div className="parent-block-head-v42"><h3>الموقف المالي</h3></div>
        {finance.map((f:any)=><div className="parent-finance-grid-v42" key={f.id}><div><span>المدفوع</span><strong>{f.paid} ج.م</strong></div><div><span>المستحق</span><strong>{f.due} ج.م</strong></div><div><span>الاستحقاق</span><strong>{f.due_date||"—"}</strong></div></div>)}
      </section>

      <section className="parent-notes-v42"><article><span>ملاحظة المدرس</span><p>{report.teacher_note||"—"}</p></article><article><span>خطة الأسبوع القادم</span><p>{report.next_week_plan||"—"}</p></article></section>
    </main>:<main className="parent-empty-v42">لا توجد تقارير منشورة لهذا الطالب حتى الآن.</main>}

    <nav className="parent-bottom-nav-v42">
      <a href={withSession(`/parent?student=${student.id}`,ctx.linkToken)}>الرئيسية</a>
      <a className="active" href={withSession(`/parent/reports?student=${student.id}`,ctx.linkToken)}>التقارير</a>
      <a href={withSession(`/parent/account?student=${student.id}`,ctx.linkToken)}>الحساب</a>
    </nav>
  </div>;
}
