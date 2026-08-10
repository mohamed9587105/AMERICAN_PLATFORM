import {dbSelect} from "@/lib/server/db";
import {getParentContext,withSession,asArray,percent} from "@/lib/server/parent-portal";
import ParentScheduleReminders from "@/components/parent-schedule-reminders";

export const dynamic="force-dynamic";
export const revalidate=0;

type Tab="home"|"exams"|"attendance"|"tasks"|"finance";

function avg(values:number[]){
  return values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):0;
}

function navHref(tab:Tab,studentId:string,token:string){
  return withSession(`/parent?tab=${tab}&student=${encodeURIComponent(studentId)}`,token);
}

export default async function ParentApp({
  searchParams
}:{
  searchParams:Promise<{session?:string;student?:string;tab?:string;week?:string}>
}){
  const params=await searchParams;
  const ctx=await getParentContext(params.session);

  if(!ctx.children.length){
    return <main className="old-parent-empty-v61">لا يوجد طالب مرتبط بهذا الحساب حاليًا.</main>;
  }

  const student=ctx.children.find((s:any)=>s.id===params.student)||ctx.children[0];
  const requested=String(params.tab||"home");
  const tab:Tab=(["home","exams","attendance","tasks","finance"] as const).includes(requested as Tab)
    ? requested as Tab
    : "home";

  // Mobile performance: fetch only what the current tab needs.
  const isHome=tab==="home";
  const needsBilling=tab==="home"||tab==="finance";

  const reportsQuery=
    tab==="home"
      ? `select=*,attendance_entries(*),homework_entries(*),exam_entries(*,exam_sections(*)),finance_entries(*)&student_id=eq.${encodeURIComponent(student.id)}&status=eq.published&order=week_start.desc&limit=2`
      : tab==="exams"
      ? `select=id,week_label,week_start,week_end,teacher_note,exam_entries(*,exam_sections(*))&student_id=eq.${encodeURIComponent(student.id)}&status=eq.published&order=week_start.desc`
      : tab==="attendance"
      ? `select=id,week_label,week_start,week_end,attendance_entries(*)&student_id=eq.${encodeURIComponent(student.id)}&status=eq.published&order=week_start.desc`
      : tab==="tasks"
      ? `select=id,week_label,week_start,week_end,teacher_note,followup_note,homework_entries(*)&student_id=eq.${encodeURIComponent(student.id)}&status=eq.published&order=week_start.desc`
      : `select=id,week_label,week_start,week_end,finance_entries(*)&student_id=eq.${encodeURIComponent(student.id)}&status=eq.published&order=week_start.desc&limit=1`;

  const [reports,parentSettingsRows,scheduleEvents,billingProfiles]=await Promise.all([
    dbSelect("weekly_reports",reportsQuery),
    isHome?dbSelect("parent_app_settings","select=reminder_minutes&id=eq.main&limit=1").catch(()=>[] as any[]):Promise.resolve([] as any[]),
    isHome?dbSelect(
      "student_schedule_events",
      `select=id,event_type,title,event_at,note&student_id=eq.${encodeURIComponent(student.id)}&is_active=eq.true&event_at=gte.${encodeURIComponent(new Date().toISOString())}&order=event_at.asc&limit=6`
    ).catch(()=>[] as any[]):Promise.resolve([] as any[]),
    needsBilling?dbSelect(
      "student_billing_profiles",
      `select=student_id,currency,session_price&student_id=eq.${encodeURIComponent(student.id)}&limit=1`
    ):Promise.resolve([] as any[])
  ]);

  const parentSettings=parentSettingsRows[0]||null;
  const billingProfile=billingProfiles[0]||null;
  const ledger=billingProfile?await dbSelect(
    "financial_transactions",
    `select=id,title,transaction_type,transaction_date,amount,currency,note&student_id=eq.${encodeURIComponent(student.id)}&currency=eq.${encodeURIComponent(billingProfile.currency)}&order=transaction_date.desc,created_at.desc&limit=120`
  ):[];
  const latest=reports[0]||null;

  const ledgerBalance=ledger.reduce((sum:number,t:any)=>sum+Number(t.amount||0),0);
  const ledgerPayments=ledger.filter((t:any)=>Number(t.amount)>0).reduce((sum:number,t:any)=>sum+Number(t.amount||0),0);
  const ledgerCharges=Math.abs(ledger.filter((t:any)=>t.transaction_type==="session_charge").reduce((sum:number,t:any)=>sum+Number(t.amount||0),0));
  const ledgerSessions=ledger.filter((t:any)=>t.transaction_type==="session_charge").length;
  const ledgerCurrency=billingProfile?.currency||"EGP";
  const selectedExamReport=
    reports.find((r:any)=>r.id===params.week)||
    reports[0]||
    null;

  const allAttendance=reports.flatMap((r:any)=>asArray(r.attendance_entries));
  const allHomework=reports.flatMap((r:any)=>asArray(r.homework_entries));
  const allExams=reports.flatMap((r:any)=>asArray(r.exam_entries));
  const latestAttendance=asArray(latest?.attendance_entries);
  const latestHomework=asArray(latest?.homework_entries);
  const latestExams=asArray(latest?.exam_entries);
  const selectedWeekExams=asArray(selectedExamReport?.exam_entries);
  const finance=asArray(latest?.finance_entries)[0]||null;

  const examAverage=avg(latestExams.map((e:any)=>percent(Number(e.score),Number(e.max_score))));
  const lastExam=latestExams[0]||null;
  const lastExamPct=lastExam?percent(Number(lastExam.score),Number(lastExam.max_score)):0;

  const homeworkScored=latestHomework.filter((h:any)=>h.score!=null&&h.max_score);
  const homeworkPct=avg(homeworkScored.map((h:any)=>percent(Number(h.score),Number(h.max_score))));
  const attendancePct=latestAttendance.length
    ? Math.round(latestAttendance.filter((a:any)=>a.status==="present").length/latestAttendance.length*100)
    : 0;

  const absences=latestAttendance.filter((a:any)=>a.status==="absent").length;
  const lateCount=latestAttendance.filter((a:any)=>a.status==="late").length;
  const missingHomework=latestHomework.filter((h:any)=>h.status==="missing"||h.status==="late").length;
  const commitmentVals=[attendancePct,homeworkPct].filter(v=>v>0);
  const commitment=commitmentVals.length?avg(commitmentVals):0;

  const alerts:Array<{title:string;sub:string;kind:string}>=[];
  if(absences>0) alerts.push({title:`غياب ${absences} مرة${absences>1?"":" "}`,sub:"الانتظام في الحضور جزء أساسي من التقييم العام.",kind:"warn"});
  if(lateCount>0) alerts.push({title:`تأخير ${lateCount} مرات`,sub:"يفضل الوصول قبل بداية الحصة بوقت كافٍ.",kind:"info"});
  if(missingHomework>0) alerts.push({title:`${missingHomework} واجب يحتاج متابعة`,sub:"متابعة الواجبات تساعد على ثبات المستوى.",kind:"task"});
  if(ledgerBalance<0) alerts.push({title:"رصيد مالي مستحق",sub:`مطلوب ${Math.abs(ledgerBalance).toLocaleString("ar-EG")} ${ledgerCurrency}`,kind:"money"});

  const previousExam=allExams[1]||null;
  const previousPct=previousExam?percent(Number(previousExam.score),Number(previousExam.max_score)):0;
  const examDelta=lastExamPct-previousPct;
  const comparisonLabel=examDelta>0?"تحسن":examDelta<0?"تراجع":"ثابت";

  const sections=asArray(lastExam?.exam_sections);

  const totalCourseValue=finance?Number(finance.paid||0)+Number(finance.due||0):0;

  return <div className="old-parent-app-v61">
    <div className="old-parent-phone-v61">
      <header className="home-header-v62">
        <div className="home-student-v62">
          <span>متابعة ولي الأمر</span>
          <h1>{student.name}</h1>
          <p>{student.course}</p>
        </div>

        <a
          className="home-weekly-report-v62"
          href={withSession(`/parent/reports?student=${student.id}`,ctx.linkToken)}
          aria-label="التقرير الأسبوعي"
        >
          <em>التقرير الأسبوعي</em>
          <i>▣</i>
        </a>
      </header>

      {tab==="home" && <main className="home-page-v62">
        <section className="home-title-v62">
          <span>الحالة العامة</span>
          <h2>مؤشرات الطالب</h2>
        </section>

        <section className="home-metrics-v62">
          <a href={navHref("exams",student.id,ctx.linkToken)} className="home-metric-v62 exams">
            <i>▤</i>
            <div><span>الامتحانات</span><strong>{examAverage||0}%</strong><small>اضغط لعرض التفاصيل</small></div>
            <b>←</b>
          </a>

          <a href={navHref("tasks",student.id,ctx.linkToken)} className="home-metric-v62 homework">
            <i>☑</i>
            <div><span>الواجبات</span><strong>{homeworkPct||0}%</strong><small>اضغط لعرض التفاصيل</small></div>
            <b>←</b>
          </a>

          <a href={navHref("attendance",student.id,ctx.linkToken)} className="home-metric-v62 attendance">
            <i>✓</i>
            <div><span>الحضور</span><strong>{attendancePct||0}%</strong><small>اضغط لعرض التفاصيل</small></div>
            <b>←</b>
          </a>

          <a href={navHref("attendance",student.id,ctx.linkToken)} className="home-metric-v62 commitment">
            <i>★</i>
            <div><span>الالتزام</span><strong>{commitment||0}%</strong><small>اضغط لعرض التفاصيل</small></div>
            <b>←</b>
          </a>
        </section>

        <section className="home-attention-v62">
          <div className="home-attention-head-v62">
            <div>
              <span>الأهم الآن</span>
              <h2>يحتاج انتباهك</h2>
            </div>
            <b>{alerts.length}</b>
          </div>

          <div className="home-attention-list-v62">
            {alerts.length?alerts.slice(0,4).map((a,i)=><article key={i}>
              <i className={a.kind}>!</i>
              <div><strong>{a.title}</strong><p>{a.sub}</p></div>
            </article>):<article>
              <i className="ok">✓</i>
              <div><strong>كل شيء على ما يرام</strong><p>لا توجد تنبيهات مهمة حاليًا.</p></div>
            </article>}
          </div>
        </section>

        <a className="parent-weekly-report-entry-v122" href={withSession(`/parent/reports?student=${student.id}`,ctx.linkToken)}>
          <div className="parent-weekly-report-icon-v122">▣</div>
          <div><span>التقرير الأسبوعي</span><h2>كل تفاصيل الأسبوع في مكان واحد</h2><p>الامتحانات · الواجبات · الحضور · المالية · ملاحظات المدرس · خطة الأسبوع</p></div>
          <b>←</b>
        </a>

        <a className="home-contact-v62" href={withSession(`/parent/contact?student=${student.id}`,ctx.linkToken)}>
          <div className="home-contact-icon-v62">☎</div>
          <div>
            <span>محتاج مساعدة؟</span>
            <h2>تواصل معنا</h2>
            <p>للاستفسار عن الدراسة أو الحسابات أو بيانات الطالب.</p>
          </div>
          <b>←</b>
        </a>

        <section className="parent-schedule-v117">
          <div className="parent-schedule-head-v117"><div><span>المواعيد القادمة</span><h2>الحصص والواجبات والامتحانات</h2></div></div>
          <ParentScheduleReminders events={scheduleEvents} minutes={Number(parentSettings?.reminder_minutes||30)}/>
          <div className="parent-schedule-list-v117">
            {scheduleEvents.length?scheduleEvents.slice(0,6).map((e:any)=><article key={e.id} className={`type-${e.event_type}`}>
              <i>{e.event_type==="class"?"◷":e.event_type==="homework"?"☑":"▤"}</i>
              <div><strong>{e.title}</strong><span>{new Intl.DateTimeFormat("ar-EG",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Cairo"}).format(new Date(e.event_at))}</span><small>{e.note||""}</small></div>
              <b>{e.event_type==="class"?"حصة":e.event_type==="homework"?"واجب":"امتحان"}</b>
            </article>):<div className="parent-schedule-empty-v117">لا توجد مواعيد قادمة مسجلة.</div>}
          </div>
        </section>
      </main>}

      {tab==="exams" && <main className="exam-weeks-page-v64">
        <section className="exam-weeks-heading-v63">
          <span>الامتحانات الأسبوعية</span>
          <h2>امتحانات الأسابيع</h2>
          <p>اضغط على أي أسبوع لفتح التفاصيل، واضغط عليه مرة ثانية لإغلاقها.</p>
        </section>

        <section className="exam-accordion-v64">
          {reports.length?reports.map((r:any,index:number)=>{
            const weekExams=asArray(r.exam_entries);

            return <details key={r.id} className="exam-week-details-v64">
              <summary>
                <div>
                  <strong>{r.week_label||`الأسبوع ${reports.length-index}`}</strong>
                  <small>{r.week_start} إلى {r.week_end}</small>
                </div>
                <b>{weekExams.length} امتحان</b>
                <i>⌄</i>
              </summary>

              <div className="exam-week-content-v64">
                {weekExams.length?weekExams.map((e:any)=>{
                  const sections=asArray(e.exam_sections);
                  const reading=sections.find((s:any)=>{
                    const n=String(s.name||"").toLowerCase();
                    return n.includes("reading")||n.includes("ريدينج");
                  });
                  const writing=sections.find((s:any)=>{
                    const n=String(s.name||"").toLowerCase();
                    return n.includes("writing")||n.includes("رايتنج")||n.includes("writing");
                  });

                  const readingScore=reading?.score??"—";
                  const readingMax=reading?.max_score??"—";
                  const writingScore=writing?.score??"—";
                  const writingMax=writing?.max_score??"—";

                  const totalRaw=Number(e.score||0);
                  const total800=Number.isFinite(totalRaw)?totalRaw:0;

                  return <article key={e.id} className="exam-card-v64">
                    <div className="exam-card-head-v64">
                      <div>
                        <strong>{e.title}</strong>
                        <small>{e.date||"بدون تاريخ"}</small>
                      </div>
                      <span>الدرجة النهائية</span>
                    </div>

                    <div className="exam-score-grid-v64">
                      <div className="reading">
                        <span>Reading</span>
                        <strong>{readingScore} <small>/ {readingMax}</small></strong>
                      </div>

                      <div className="writing">
                        <span>Writing</span>
                        <strong>{writingScore} <small>/ {writingMax}</small></strong>
                      </div>

                      <div className="total">
                        <span>Total</span>
                        <strong>{total800} <small>/ 800</small></strong>
                      </div>
                    </div>

                    <div className="exam-note-v64">
                      <span>ملاحظة الامتحان</span>
                      <p>{e.note||e.teacher_note||r.teacher_note||"لا توجد ملاحظة مسجلة لهذا الامتحان."}</p>
                    </div>
                  </article>
                }):<div className="exam-no-data-v63">لا توجد امتحانات مسجلة في هذا الأسبوع.</div>}
              </div>
            </details>
          }):<div className="exam-no-weeks-v63">لا توجد أسابيع منشورة حتى الآن.</div>}
        </section>
      </main>}

      {tab==="attendance" && <main className="attendance-weeks-page-v66">
        <section className="exam-weeks-heading-v63">
          <span>الحضور الأسبوعي</span>
          <h2>الحضور والالتزام</h2>
          <p>اضغط على الأسبوع لعرض أيام الحضور والغياب والتأخير، واضغط عليه مرة ثانية لإغلاقه.</p>
        </section>

        <section className="attendance-accordion-v66">
          {reports.length?reports.map((r:any,index:number)=>{
            const weekAttendance=asArray(r.attendance_entries);
            const presentCount=weekAttendance.filter((a:any)=>a.status==="present").length;
            const absentCount=weekAttendance.filter((a:any)=>a.status==="absent").length;
            const lateWeekCount=weekAttendance.filter((a:any)=>a.status==="late").length;

            return <details key={r.id} className="attendance-week-v66">
              <summary>
                <div>
                  <strong>{r.week_label||`الأسبوع ${reports.length-index}`}</strong>
                  <small>{r.week_start} إلى {r.week_end}</small>
                </div>
                <div className="attendance-mini-counts-v66">
                  <span className="present">{presentCount}</span>
                  <span className="absent">{absentCount}</span>
                  <span className="late">{lateWeekCount}</span>
                </div>
                <i>⌄</i>
              </summary>

              <div className="attendance-week-content-v66">
                <div className="attendance-legend-v66">
                  <span className="present">● حضر</span>
                  <span className="absent">● لم يحضر</span>
                  <span className="late">● متأخر</span>
                </div>

                {weekAttendance.length?<div className="attendance-days-v66">
                  {weekAttendance.map((a:any)=><article key={a.id} className={`attendance-day-v66 ${a.status}`}>
                    <div className="attendance-status-icon-v66">
                      {a.status==="present"?"✓":a.status==="absent"?"✕":"⌚"}
                    </div>
                    <div>
                      <strong>{a.date}</strong>
                      <small>{a.note||"حصة الكورس"}</small>
                    </div>
                    <b>{a.status==="present"?"حضر":a.status==="absent"?"لم يحضر":"متأخر"}</b>
                  </article>)}
                </div>:<div className="exam-no-data-v63">لا توجد بيانات حضور مسجلة لهذا الأسبوع.</div>}
              </div>
            </details>
          }):<div className="exam-no-weeks-v63">لا توجد أسابيع منشورة حتى الآن.</div>}
        </section>
      </main>}

      {tab==="tasks" && <main className="homework-weeks-page-v67">
        <section className="exam-weeks-heading-v63">
          <span>الواجبات الأسبوعية</span>
          <h2>الواجبات والدرجات</h2>
          <p>اضغط على الأسبوع لعرض الواجبات ودرجة كل واجب، واضغط عليه مرة ثانية لإغلاقه.</p>
        </section>

        <section className="homework-accordion-v67">
          {reports.length?reports.map((r:any,index:number)=>{
            const weekHomework=asArray(r.homework_entries);
            const doneCount=weekHomework.filter((h:any)=>h.status==="completed").length;
            const missingCount=weekHomework.filter((h:any)=>h.status==="missing").length;
            const lateHomeworkCount=weekHomework.filter((h:any)=>h.status==="late").length;

            return <details key={r.id} className="homework-week-v67">
              <summary>
                <div>
                  <strong>{r.week_label||`الأسبوع ${reports.length-index}`}</strong>
                  <small>{r.week_start} إلى {r.week_end}</small>
                </div>

                <div className="homework-mini-counts-v67">
                  <span className="done">{doneCount}</span>
                  <span className="late">{lateHomeworkCount}</span>
                  <span className="missing">{missingCount}</span>
                </div>

                <i>⌄</i>
              </summary>

              <div className="homework-week-content-v67">
                <div className="homework-legend-v67">
                  <span className="done">● تم التسليم</span>
                  <span className="late">● متأخر</span>
                  <span className="missing">● لم يسلم</span>
                </div>

                {weekHomework.length?<div className="homework-list-v67">
                  {weekHomework.map((h:any)=><article key={h.id} className={`homework-item-v67 ${h.status}`}>
                    <div className="homework-status-icon-v67">
                      {h.status==="completed"?"✓":h.status==="late"?"⌚":"✕"}
                    </div>

                    <div className="homework-main-v67">
                      <strong>{h.title}</strong>
                      <small>موعد التسليم: {h.due_date||"—"}</small>
                    </div>

                    <div className="homework-score-v67">
                      <span>الدرجة</span>
                      <strong>
                        {h.score!=null?String(h.score):"—"}
                        <small> / {h.max_score!=null?String(h.max_score):"—"}</small>
                      </strong>
                    </div>

                    <b className="homework-status-label-v67">
                      {h.status==="completed"?"تم التسليم":h.status==="late"?"متأخر":"لم يسلم"}
                    </b>
                  </article>)}
                </div>:<div className="exam-no-data-v63">لا توجد واجبات مسجلة لهذا الأسبوع.</div>}

                <div className="homework-week-note-v67">
                  <span>ملاحظات الأسبوع</span>
                  <p>{r.followup_note||r.teacher_note||"لا توجد ملاحظات مسجلة لهذا الأسبوع."}</p>
                </div>
              </div>
            </details>
          }):<div className="exam-no-weeks-v63">لا توجد أسابيع منشورة حتى الآن.</div>}
        </section>
      </main>}

      {tab==="finance" && <main className="finance-ledger-page-v69">
        <section className="finance-ledger-heading-v69">
          <span>الحساب المالي</span>
          <h2>الرصيد والحركات</h2>
          <p>كل دفعة تُضاف للرصيد، وكل حصة محسوبة تُخصم تلقائيًا.</p>
        </section>

        <section className={`finance-balance-v69 ${ledgerBalance<0?"negative":ledgerBalance===0?"zero":"positive"}`}>
          <span>{ledgerBalance<0?"المبلغ المطلوب":"الرصيد الحالي"}</span>
          <strong>{Math.abs(ledgerBalance).toLocaleString("ar-EG")} <small>{ledgerCurrency}</small></strong>
          <p>{ledgerBalance<0?"الرصيد دخل بالسالب ويحتاج دفعة.":ledgerBalance>0?"رصيد متاح للحصص القادمة.":"الرصيد صفر."}</p>
        </section>

        <section className="finance-stats-v69">
          <article className="paid">
            <span>إجمالي الدفعات</span>
            <strong>{ledgerPayments.toLocaleString("ar-EG")} {ledgerCurrency}</strong>
          </article>
          <article className="charged">
            <span>تكلفة الحصص</span>
            <strong>{ledgerCharges.toLocaleString("ar-EG")} {ledgerCurrency}</strong>
          </article>
          <article>
            <span>الحصص المحسوبة</span>
            <strong>{ledgerSessions}</strong>
          </article>
          <article>
            <span>سعر الحصة</span>
            <strong>{Number(billingProfile?.session_price||0).toLocaleString("ar-EG")} {ledgerCurrency}</strong>
          </article>
        </section>

        <section className="finance-ledger-list-v69">
          <h3>كشف الحساب</h3>
          {ledger.length?ledger.map((t:any)=><article key={t.id} className={Number(t.amount)>=0?"credit":"debit"}>
            <div className="finance-ledger-icon-v69">{Number(t.amount)>=0?"+":"−"}</div>
            <div>
              <strong>{t.title}</strong>
              <small>{t.transaction_date}{t.note?` · ${t.note}`:""}</small>
            </div>
            <b>{Number(t.amount)>0?"+":""}{Number(t.amount).toLocaleString("ar-EG")} {t.currency}</b>
          </article>):<p className="empty-mini-v61">لا توجد حركات مالية حتى الآن.</p>}
        </section>
      </main>}

      <nav className="old-bottom-nav-v61 parent-nav-v122">
        <a className={tab==="home"?"active":""} href={navHref("home",student.id,ctx.linkToken)}><i>⌂</i><span>الرئيسية</span></a>
        <a className={tab==="exams"?"active":""} href={navHref("exams",student.id,ctx.linkToken)}><i>▤</i><span>الامتحانات</span></a>
        <a className={tab==="attendance"?"active":""} href={navHref("attendance",student.id,ctx.linkToken)}><i>✓</i><span>الحضور</span></a>
        <a className={tab==="tasks"?"active":""} href={navHref("tasks",student.id,ctx.linkToken)}><i>☑</i><span>الواجبات</span></a>
        <a className={tab==="finance"?"active":""} href={navHref("finance",student.id,ctx.linkToken)}><i>ج</i><span>المالية</span></a>
        <a href={withSession(`/parent/reports?student=${student.id}`,ctx.linkToken)}><i>▣</i><span>التقرير</span></a>
      </nav>
    </div>
  </div>;
}
