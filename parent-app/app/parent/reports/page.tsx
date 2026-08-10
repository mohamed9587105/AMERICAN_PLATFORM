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
  // Fetch the week list lightly, then only the selected report details.
  const reports=await dbSelect(
    "weekly_reports",
    `select=id,week_label,week_start,week_end&student_id=eq.${encodeURIComponent(student.id)}&status=eq.published&order=week_start.desc`
  );
  const selectedId=reports.find((r:any)=>r.id===params.report)?.id||reports[0]?.id||"";
  const report=selectedId?(await dbSelect(
    "weekly_reports",
    `select=*,attendance_entries(*),homework_entries(*),exam_entries(*,exam_sections(*)),finance_entries(*)&id=eq.${encodeURIComponent(selectedId)}&limit=1`
  ))[0]||null:null;

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
      <section className="parent-report-dashboard-v117">
        <details className="parent-report-accordion-v117 exams">
          <summary><i>▤</i><div><strong>الامتحانات</strong><span>كل الامتحانات ودرجات الطالب</span></div><b>{exams.length}</b><em>⌄</em></summary>
          <div className="parent-report-accordion-body-v117">
            {exams.length?exams.map((e:any)=><article key={e.id} className="parent-exam-v117">
              <div><strong>{e.title}</strong><span>{e.date||"—"}</span></div>
              <b>{e.score} / {e.max_score}</b>
              {asArray(e.exam_sections).length?<section>{asArray(e.exam_sections).map((x:any)=><div key={x.id}><span>{x.name}</span><strong>{x.score} / {x.max_score}</strong></div>)}</section>:null}
            </article>):<p className="parent-report-empty-v117">لا توجد امتحانات مسجلة.</p>}
          </div>
        </details>

        <details className="parent-report-accordion-v117 homework">
          <summary><i>☑</i><div><strong>الواجبات</strong><span>حالة كل واجب ودرجته</span></div><b>{homework.length}</b><em>⌄</em></summary>
          <div className="parent-report-accordion-body-v117">
            {homework.length?homework.map((h:any)=><article key={h.id} className={`parent-report-row-v117 ${h.status||""}`}>
              <div><strong>{h.title}</strong><span>{h.due_date||"—"}</span></div>
              <b>{h.score!=null&&h.max_score?`${h.score} / ${h.max_score}`:h.status==="not_done"?"لم يعمل":"—"}</b>
            </article>):<p className="parent-report-empty-v117">لا توجد واجبات مسجلة.</p>}
          </div>
        </details>

        <details className="parent-report-accordion-v117 attendance">
          <summary><i>✓</i><div><strong>الحضور والغياب</strong><span>تفاصيل حضور الطالب</span></div><b>{attendance.length}</b><em>⌄</em></summary>
          <div className="parent-report-accordion-body-v117">
            {attendance.length?attendance.map((a:any)=><article key={a.id} className={`parent-report-row-v117 ${a.status||""}`}>
              <div><strong>{a.date}</strong><span>{a.note||"حصة الكورس"}</span></div>
              <b>{a.status==="present"?"حاضر":a.status==="absent"?"غائب":"متأخر"}</b>
            </article>):<p className="parent-report-empty-v117">لا توجد بيانات حضور.</p>}
          </div>
        </details>

        <details className="parent-report-accordion-v117 finance">
          <summary><i>ج</i><div><strong>الموقف المالي</strong><span>المدفوع والمستحق</span></div><b>{finance.length}</b><em>⌄</em></summary>
          <div className="parent-report-accordion-body-v117">
            {finance.length?finance.map((f:any)=><section className="parent-finance-v117" key={f.id}>
              <div><span>المدفوع</span><strong>{f.paid} ج.م</strong></div>
              <div><span>المستحق</span><strong>{f.due} ج.م</strong></div>
              <div><span>تاريخ الاستحقاق</span><strong>{f.due_date||"—"}</strong></div>
            </section>):<p className="parent-report-empty-v117">لا توجد بيانات مالية في هذا التقرير.</p>}
          </div>
        </details>

        <details className="parent-report-accordion-v117 teacher">
          <summary><i>✎</i><div><strong>ملاحظات المدرس</strong><span>ملاحظات أكاديمية مباشرة</span></div><em>⌄</em></summary>
          <div className="parent-report-accordion-body-v117"><p className="parent-big-note-v117">{report.teacher_note||"لا توجد ملاحظات مسجلة."}</p></div>
        </details>

        <details className="parent-report-accordion-v117 plan">
          <summary><i>→</i><div><strong>خطة الأسبوع القادم</strong><span>ما سيتم التركيز عليه خلال الأسبوع</span></div><em>⌄</em></summary>
          <div className="parent-report-accordion-body-v117"><p className="parent-big-note-v117">{report.next_week_plan||"لا توجد خطة مسجلة."}</p></div>
        </details>
      </section>
    </main>:<main className="parent-empty-v42">لا توجد تقارير منشورة لهذا الطالب حتى الآن.</main>}

    <nav className="parent-bottom-nav-v42">
      <a href={withSession(`/parent?student=${student.id}`,ctx.linkToken)}>الرئيسية</a>
      <a className="active" href={withSession(`/parent/reports?student=${student.id}`,ctx.linkToken)}>التقارير</a>
      <a href={withSession(`/parent/account?student=${student.id}`,ctx.linkToken)}>الحساب</a>
    </nav>
  </div>;
}
