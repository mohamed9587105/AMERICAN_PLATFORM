"use client";

import { useEffect, useMemo, useState } from "react";
import { parentDataSource } from "@/lib/services";
import { evaluateStudent } from "@/lib/evaluation";
import type {
  AcademicSnapshot,
  AttendanceItem,
  ExamItem,
  FinanceSnapshot,
  HomeworkItem,
  NotificationItem,
  Student,
  PaymentItem,
  WeeklyReport,
  ParentProfile
} from "@/lib/types";

type Tab = "home"|"academic"|"exams"|"attendance"|"tasks"|"commitment"|"finance"|"notifications"|"weekly"|"contact"|"account";

const money = (n:number) => n.toLocaleString("ar-EG");
const examPercent = (x:ExamItem) => x.maxScore ? Math.round((x.score/x.maxScore)*100) : x.score;
const examScoreText = (x:ExamItem) => x.maxScore ? `${x.score} / ${x.maxScore}` : `${x.score}`;
const sectionScoreText = (s:{score:number;maxScore?:number}) => s.maxScore ? `${s.score} / ${s.maxScore}` : `${s.score}`;

export default function ParentApp({initialTab="home"}:{initialTab?:Tab}){
  const [tab,setTab]=useState<Tab>(initialTab);
  // Mobile-safe first render: keep a complete local snapshot visible immediately.
  // The service layer refreshes this data after mount and can later be swapped
  // for American Platform without changing the UI.
  const initialStudents:Student[]=[
    { id:"std_001", name:"محمود أحمد", level:"American Diploma", course:"EST Advanced" },
    { id:"std_002", name:"سارة أحمد", level:"Foundation", course:"Beginners EST" }
  ];
  const initialAcademic:AcademicSnapshot={
    examAverage:86,homeworkCompletion:92,attendanceRate:95,commitmentRate:90,
    absences:1,lateCount:2,trend:"up",
    subjectScores:[
      {name:"Reading",score:81},{name:"Writing",score:90},{name:"Vocabulary",score:87}
    ]
  };
  const initialAttendance:AttendanceItem[]=[
    {date:"2026-08-02",status:"present"},{date:"2026-08-04",status:"present"},
    {date:"2026-08-06",status:"late"},{date:"2026-08-08",status:"present"}
  ];
  const initialHomework:HomeworkItem[]=[
    {id:"hw1",title:"Reading Practice 04",status:"completed",dueDate:"2026-08-05",score:92},
    {id:"hw2",title:"Writing Homework 03",status:"completed",dueDate:"2026-08-07",score:88},
    {id:"hw3",title:"Vocabulary Set 06",status:"late",dueDate:"2026-08-09",score:null}
  ];
  const initialExams:ExamItem[]=[
    {id:"ex1",title:"Weekly Exam 01",score:42,maxScore:50,date:"2026-08-01",sections:[{name:"Reading",score:16,maxScore:20},{name:"Writing",score:17,maxScore:20},{name:"Vocabulary",score:9,maxScore:10}]},
    {id:"ex2",title:"Weekly Exam 02",score:44,maxScore:50,date:"2026-08-08",sections:[{name:"Reading",score:17,maxScore:20},{name:"Writing",score:18,maxScore:20},{name:"Vocabulary",score:9,maxScore:10}]}
  ];
  const initialFinance:FinanceSnapshot={
    totalCourseFee:5000,paid:3750,remaining:1250,nextInstallment:1250,nextInstallmentDate:"2026-08-15"
  };
  const initialNotifications:NotificationItem[]=[
    {id:"n1",type:"academic",title:"تحسن في المستوى",body:"متوسط نتائج محمود ارتفع خلال آخر اختبارين.",createdAt:"اليوم 10:30"},
    {id:"n2",type:"homework",title:"واجب غير مكتمل",body:"يوجد واجب Vocabulary لم يتم تسليمه بعد.",createdAt:"اليوم 09:15"},
    {id:"n3",type:"finance",title:"موعد قسط قريب",body:"القسط القادم يوم 15 أغسطس.",createdAt:"أمس 18:00"}
  ];

  const [students,setStudents]=useState<Student[]>(initialStudents);
  const [studentId,setStudentId]=useState("std_001");
  const [academic,setAcademic]=useState<AcademicSnapshot|null>(initialAcademic);
  const [attendance,setAttendance]=useState<AttendanceItem[]>(initialAttendance);
  const [homework,setHomework]=useState<HomeworkItem[]>(initialHomework);
  const [exams,setExams]=useState<ExamItem[]>(initialExams);
  const [finance,setFinance]=useState<FinanceSnapshot|null>(initialFinance);
  const [notifications,setNotifications]=useState<NotificationItem[]>(initialNotifications);
  const [payments,setPayments]=useState<PaymentItem[]>([
    {id:"pay1",amount:2000,date:"2026-07-01",method:"نقدي",receiptNo:"R-1001"},
    {id:"pay2",amount:1750,date:"2026-08-01",method:"InstaPay",receiptNo:"R-1044"}
  ]);
  const [weekly,setWeekly]=useState<WeeklyReport>({
    weekLabel:"الأسبوع 3–9 أغسطس",attendanceRate:95,homeworkCompletion:92,examAverage:86,commitmentRate:90,trend:"up",
    summary:"الأسبوع جيد جدًا. الحضور والواجبات ممتازان، ونتائج الاختبارات تتحسن. يحتاج الطالب فقط لمتابعة واجب Vocabulary المتأخر."
  });
  const [parent,setParent]=useState<ParentProfile>({id:"parent_001",fullName:"ولي أمر محمود",phone:"01000000000"});
  const [pushEnabled,setPushEnabled]=useState(false);

  useEffect(()=>{
    parentDataSource.getStudents("parent_001").then(list=>{
      if(list.length){
        setStudents(list);
        setStudentId(current=>list.some(s=>s.id===current)?current:list[0].id);
      }
    }).catch(error=>console.error("PARENT STUDENTS LOAD ERROR:",error));
  },[]);

  useEffect(()=>{
    parentDataSource.getParentProfile("parent_001").then(setParent).catch(()=>{});
  },[]);

  useEffect(()=>{
    if(!studentId) return;
    Promise.all([
      parentDataSource.getAcademic(studentId),
      parentDataSource.getAttendance(studentId),
      parentDataSource.getHomework(studentId),
      parentDataSource.getExams(studentId),
      parentDataSource.getFinance(studentId),
      parentDataSource.getNotifications(studentId),
      parentDataSource.getPayments(studentId),
      parentDataSource.getWeeklyReport(studentId)
    ]).then(([a,att,hw,ex,fin,n,pays,w])=>{
      setAcademic(a);setAttendance(att);setHomework(hw);setExams(ex);setFinance(fin);setNotifications(n);setPayments(pays);setWeekly(w);
    }).catch((error)=>{
      console.error("PARENT APP DATA REFRESH ERROR:",error);
      // Keep the last visible snapshot instead of collapsing the mobile UI.
    });
  },[studentId]);

  const student=students.find(s=>s.id===studentId);
  const evaluation=useMemo(()=>academic?evaluateStudent(academic):null,[academic]);
  const strongestSubject=useMemo(()=>{
    if(!academic?.subjectScores?.length) return null;
    return [...academic.subjectScores].sort((a,b)=>b.score-a.score)[0];
  },[academic]);
  const weakestSubject=useMemo(()=>{
    if(!academic?.subjectScores?.length) return null;
    return [...academic.subjectScores].sort((a,b)=>a.score-b.score)[0];
  },[academic]);

  return <div className="app-shell">
    <header className="topbar">
      <div>
        <span className="eyebrow">تطبيق ولي الأمر</span>
        <h1>أهلًا بك 👋</h1>
      </div>
      <div className="top-actions-v9">
        <a className="account-shortcut-v9" href="/?tab=account" aria-label="الحساب">👤</a>
        <a className="bell" href="/?tab=notifications" aria-label="الإشعارات">🔔<b>{notifications.length}</b></a>
      </div>
    </header>

    <section className="student-card student-card-v11">
      <div className="avatar">{student?.name?.slice(0,1)||"ط"}</div>
      <div className="student-info">
        <div className="student-name-row-v11">
          <strong>{student?.name||"جاري التحميل..."}</strong>
        </div>
        <span>{student?.course||""}</span>
        <small>{student?.level||""}</small>
      </div>
      <a className="weekly-report-shortcut-v13" href="/?tab=weekly" aria-label="التقرير الأسبوعي" title="التقرير الأسبوعي">
        <span className="weekly-report-icon-v13">
          <i className="report-sheet-v13"><em></em><em></em><em></em></i>
        </span>
        <b>جديد</b>
      </a>
      {students.length>1?<select value={studentId} onChange={e=>setStudentId(e.target.value)}>
        {students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
      </select>:null}
    </section>

    <main>
      {tab==="home" && academic && finance && evaluation ? <Home
        academic={academic} evaluation={evaluation} finance={finance}
        homework={homework} notifications={notifications} setTab={setTab}
        strongestSubject={strongestSubject} weakestSubject={weakestSubject}
      />:null}

      {tab==="academic" && academic && evaluation ? <Academic academic={academic} evaluation={evaluation} exams={exams}/>:null}
      {tab==="exams" ? <ExamsPage exams={exams} academic={academic}/>:null}
      {tab==="attendance" ? <Attendance items={attendance} academic={academic}/>:null}
      {tab==="tasks" ? <Tasks homework={homework}/>:null}
      {tab==="commitment" && academic ? <Commitment academic={academic}/>:null}
      {tab==="finance" && finance ? <Finance data={finance} payments={payments}/>:null}
      {tab==="notifications" ? <Notifications items={notifications} pushEnabled={pushEnabled} setPushEnabled={setPushEnabled}/>:null}
      {tab==="weekly" ? <Weekly weekly={weekly} exams={exams} homework={homework} attendance={attendance} academic={academic}/>:null}
      {tab==="contact" ? <Contact/>:null}
      {tab==="account" ? <Account parent={parent} students={students} currentStudentId={studentId}/>:null}
    </main>

    <nav className="bottom-nav">
      <Nav active={tab==="home"} icon="⌂" label="الرئيسية" href="/?tab=home"/>
      <Nav active={tab==="exams"} icon="▤" label="الامتحانات" href="/?tab=exams"/>
      <Nav active={tab==="attendance"} icon="✓" label="الحضور" href="/?tab=attendance"/>
      <Nav active={tab==="tasks"} icon="☑" label="الواجبات" href="/?tab=tasks"/>
      <Nav active={tab==="finance"} icon="ج" label="المالية" href="/?tab=finance"/>
    </nav>
  </div>
}

function Nav({active,icon,label,href}:{active:boolean;icon:string;label:string;href:string}){
  return <a href={href} className={active?"active":""}>
    <span className="android-nav-indicator-v8"><i>{icon}</i></span>
    <small>{label}</small>
  </a>
}

function Home({academic,evaluation,finance,homework,notifications,setTab,strongestSubject,weakestSubject}:any){
  const missing=homework.filter((x:HomeworkItem)=>x.status==="missing");
  const needsAttention:any[]=[];
  if(academic.trend==="down") needsAttention.push({tone:"red",title:"المستوى يتراجع",body:"يوجد انخفاض مقارنة بالفترة السابقة. راجع تحليل الأداء."});
  if(missing.length) needsAttention.push({tone:"orange",title:`${missing.length} واجب غير مكتمل`,body:missing[0].title});
  if(academic.absences>0) needsAttention.push({tone:"orange",title:`غياب ${academic.absences} مرة`,body:"الانتظام في الحضور جزء أساسي من التقييم العام."});
  if(academic.lateCount>=2) needsAttention.push({tone:"blue",title:`تأخير ${academic.lateCount} مرات`,body:"يفضل الوصول قبل بداية الحصة بوقت كافٍ."});
  if(finance.remaining>0) needsAttention.push({tone:"purple",title:"استحقاق مالي قادم",body:`${money(finance.nextInstallment)} ج.م — ${finance.nextInstallmentDate}`});

  const trendLabel=academic.trend==="up"?"↑ يتحسن":academic.trend==="down"?"↓ يتراجع":"→ مستقر";

  return <div className="page-stack home-v2">
    <section className="hero-evaluation-v2">
      <div className="hero-eval-top">
        <div>
          <span className="hero-kicker">الحالة العامة للطالب</span>
          <h2>{evaluation.label}</h2>
          <em className={`trend ${academic.trend}`}>{trendLabel}</em>
        </div>
        <div className="score-ring score-ring-v2">{evaluation.score}<small>/100</small></div>
      </div>
      <p>{evaluation.comment}{weakestSubject&&strongestSubject?` أقوى جزء حاليًا ${strongestSubject.name} بنسبة ${strongestSubject.score}%، ويحتاج ${weakestSubject.name} إلى تركيز أكبر بنسبة ${weakestSubject.score}%.`:""}</p>
      <a className="hero-report-link-v6" href="/?tab=academic">عرض التقرير الدراسي الكامل ←</a>
    </section>

    <section className="home-section-v2">
      <div className="section-heading-v2">
        <div><span>نظرة سريعة</span><h3>مؤشرات الطالب</h3></div>
        <small>آخر تحديث الآن</small>
      </div>
      <div className="quick-grid quick-grid-v2 clickable-metrics-v3">
        <MetricButton title="الامتحانات" value={`${academic.examAverage}%`} tone={academic.examAverage>=80?"green":"orange"} href="/?tab=exams" detail="عرض التفاصيل" icon="▤"/>
        <MetricButton title="الواجبات" value={`${academic.homeworkCompletion}%`} tone={academic.homeworkCompletion>=85?"green":"orange"} href="/?tab=tasks" detail="عرض التفاصيل" icon="☑"/>
        <MetricButton title="الحضور" value={`${academic.attendanceRate}%`} tone={academic.attendanceRate>=90?"green":"orange"} href="/?tab=attendance" detail="عرض التفاصيل" icon="✓"/>
        <MetricButton title="الالتزام" value={`${academic.commitmentRate}%`} tone={academic.commitmentRate>=85?"blue":"orange"} href="/?tab=commitment" detail="عرض التفاصيل" icon="★"/>
      </div>
    </section>

    <section className={`attention-card-v2 ${needsAttention.length?"attention-has-alerts-v18":"attention-all-good-v18"}`}>
      <div className="section-heading-v2">
        <div>
          <span>{needsAttention.length?"الأهم الآن":"الحالة الحالية"}</span>
          <h3>{needsAttention.length?"يحتاج انتباهك":"كل شيء يسير بشكل جيد"}</h3>
        </div>
        <b>{needsAttention.length?needsAttention.length:"✓"}</b>
      </div>
      <div className="attention-list-v2">
        {needsAttention.length ? needsAttention.slice(0,3).map((x,i)=>
          <article key={i} className={`attention-${x.tone}`}>
            <i>!</i><div><strong>{x.title}</strong><p>{x.body}</p></div>
          </article>
        ):<article className="attention-green"><i>✓</i><div><strong>لا توجد ملاحظات عاجلة</strong><p>الطالب ملتزم حاليًا ولا يوجد ما يحتاج تدخلًا مباشرًا.</p></div></article>}
      </div>
    </section>

    <a className={`finance-summary finance-summary-v2 finance-link-v6 finance-glass-v18 ${finance.remaining>0?"finance-due-v18":"finance-clear-v18"}`} href="/?tab=finance">
      <div className="finance-icon-v2">ج</div>
      <div className="finance-solid-data-v18">
        <div className="finance-copy-v2">
          <span>الموقف المالي</span>
          <strong>{finance.remaining>0?`${money(finance.remaining)} ج.م متبقي`:"لا توجد مستحقات حاليًا ✓"}</strong>
          <small>{finance.remaining>0?`القسط القادم ${finance.nextInstallmentDate}`:"جميع المدفوعات مكتملة"}</small>
        </div>
      </div>
      <span className="finance-details-v6">التفاصيل ←</span>
    </a>

    <section className="home-actions-v9 home-actions-v11">
      <a href="/?tab=contact"><span>☎</span><div><strong>تواصل مع الإدارة</strong><small>دراسة أو حسابات أو استفسار عام</small></div><b>←</b></a>
    </section>


  </div>
}
function Academic({academic,evaluation,exams}:any){
  const trend = academic.trend==="up"?"↑ يتحسن":academic.trend==="down"?"↓ يتراجع":"→ مستقر";
  return <div className="page-stack">
    <PageTitle title="الأداء الدراسي" subtitle="تحليل شامل مبني على الامتحانات والواجبات والحضور والالتزام"/>
    <section className="evaluation-card">
      <div className="evaluation-head">
        <div><span>التقييم العام</span><h2>{evaluation.label}</h2><em className={`trend ${academic.trend}`}>{trend}</em></div>
        <div className="score-ring">{evaluation.score}<small>/100</small></div>
      </div>
      <p>{evaluation.comment}</p>
    </section>

    <section className="breakdown-card">
      <h3>مكونات التقييم</h3>
      <Bar label="الامتحانات" value={academic.examAverage} weight="40%"/>
      <Bar label="الواجبات" value={academic.homeworkCompletion} weight="25%"/>
      <Bar label="الحضور" value={academic.attendanceRate} weight="15%"/>
      <Bar label="الالتزام" value={academic.commitmentRate} weight="15%"/>
      <Bar label="الغياب والتأخير" value={Math.max(0,100-(academic.absences*8+academic.lateCount*3))} weight="5%"/>
    </section>

    <section className="subjects-card">
      <h3>المستوى حسب المادة</h3>
      {academic.subjectScores.map((s:any)=><Bar key={s.name} label={s.name} value={s.score}/>)}
    </section>

    <section className="list-card">
      <h3>آخر الاختبارات</h3>
      {exams.map((x:ExamItem)=><article key={x.id}><div><strong>{x.title}</strong><small>{x.date}</small></div><b>{x.score}%</b></article>)}
    </section>

    <section className="advice-card">
      <span>نصيحة هذا الأسبوع</span>
      <p>{evaluation.concerns.length ? `ركزوا هذا الأسبوع على ${evaluation.concerns[0]}.` : "استمروا على نفس مستوى الالتزام، مع الحفاظ على المراجعة الأسبوعية."}</p>
    </section>
  </div>
}

function ExamsPage({exams,academic}:{exams:ExamItem[];academic:AcademicSnapshot|null}){
  const latest=exams[exams.length-1];
  const previous=exams.length>1?exams[exams.length-2]:null;
  const delta=latest&&previous ? latest.score-previous.score : 0;
  const trend=delta>0?"↑ تحسن":delta<0?"↓ تراجع":"→ ثابت";
  const allSections=latest?.sections||[];
  const weakest=allSections.length?[...allSections].sort((a,b)=>a.score-b.score)[0]:null;
  const strongest=allSections.length?[...allSections].sort((a,b)=>b.score-a.score)[0]:null;

  return <div className="page-stack">
    <PageTitle title="الامتحانات" subtitle="تحليل النتائج، المقارنة، ونقاط القوة والضعف"/>
    <section className="quick-grid">
      <Metric title="متوسط الاختبارات" value={`${academic?.examAverage||0}%`} tone={(academic?.examAverage||0)>=85?"green":(academic?.examAverage||0)>=70?"blue":"orange"}/>
      <Metric title="آخر اختبار" value={`${latest?.score||0}%`} tone={(latest?.score||0)>=85?"green":(latest?.score||0)>=70?"blue":"orange"}/>
    </section>

    <section className="evaluation-card exams-summary-v7 exam-analysis-v19">
      <div className="evaluation-head">
        <div>
          <span>مقارنة بآخر اختبار</span>
          <h2>{trend}</h2>
          <em className={`trend ${delta>0?"up":delta<0?"down":"stable"}`}>{delta>0?`+${delta}`:delta} درجات</em>
        </div>
        <div className="score-ring">{latest?.score||0}<small>%</small></div>
      </div>
      <p>
        {strongest&&weakest
          ? `أقوى جزء في آخر اختبار هو ${strongest.name} بنسبة ${strongest.score}%. أضعف جزء هو ${weakest.name} بنسبة ${weakest.score}%. ${delta>0?"النتيجة تتحسن مقارنة بالاختبار السابق.":delta<0?"هناك تراجع ويحتاج الطالب لمراجعة نقاط الضعف.":"المستوى ثابت تقريبًا مقارنة بالاختبار السابق."}`
          :"يتم تحديث التحليل مع كل اختبار جديد."}
      </p>
    </section>

    {latest?.sections?.length?<section className="breakdown-card">
      <h3>تفاصيل آخر اختبار</h3>
      {latest.sections.map(s=><Bar key={s.name} label={s.name} value={s.score}/>)}
    </section>:null}

    {weakest?<section className="advice-card exam-advice-v19">
      <span>توصية الاختبار القادم</span>
      <p>ركزوا على <strong>{weakest.name}</strong> خلال الفترة القادمة، مع الحفاظ على مستوى <strong>{strongest?.name}</strong>. الهدف التالي الوصول إلى تحسن لا يقل عن 5 درجات.</p>
    </section>:null}

    <section className="list-card">
      <h3>سجل الامتحانات</h3>
      {exams.map((x:ExamItem,index:number)=>{
        const prev=index>0?exams[index-1]:null;
        const change=prev?x.score-prev.score:0;
        return <details className="exam-details-v9" key={x.id}>
          <summary>
            <div><strong>{x.title}</strong><small>{x.date}{prev?` · ${change>0?"تحسن":change<0?"تراجع":"ثابت"} ${Math.abs(change)} درجات`:""}</small></div>
            <b>{x.score}%</b>
          </summary>
          {x.sections?.length?<div className="exam-sections-v9">{x.sections.map(s=><span key={s.name}>{s.name}<b>{sectionScoreText(s)}</b></span>)}</div>:null}
        </details>
      })}
      {!exams.length?<div className="empty-v7">لا توجد نتائج امتحانات حتى الآن.</div>:null}
    </section>
  </div>
}

function Attendance({items,academic}:{items:AttendanceItem[];academic:AcademicSnapshot|null}){
  return <div className="page-stack">
    <PageTitle title="الحضور والالتزام" subtitle="متابعة الحضور والغياب والتأخير"/>
    <section className="quick-grid">
      <Metric title="نسبة الحضور" value={`${academic?.attendanceRate||0}%`} tone="green"/>
      <Metric title="الغياب" value={`${academic?.absences||0}`} tone="red"/>
      <Metric title="التأخير" value={`${academic?.lateCount||0}`} tone="orange"/>
      <Metric title="الالتزام" value={`${academic?.commitmentRate||0}%`} tone="blue"/>
    </section>
    <section className="list-card">
      <h3>سجل الحضور</h3>
      {items.map((x,i)=><article key={i}><div><strong>{x.date}</strong><small>حصة الكورس</small></div><b className={`status ${x.status}`}>{x.status==="present"?"حاضر":x.status==="absent"?"غائب":"متأخر"}</b></article>)}
    </section>
  </div>
}

function Tasks({homework}:{homework:HomeworkItem[]}){
  const completed=homework.filter(x=>x.status==="completed").length;
  const missing=homework.filter(x=>x.status!=="completed").length;
  const completion=homework.length?Math.round((completed/homework.length)*100):0;
  const ordered=[...homework].sort((a,b)=>{
    const rank=(s:HomeworkItem["status"])=>s==="late"?0:s==="missing"?1:2;
    return rank(a.status)-rank(b.status);
  });

  return <div className="page-stack">
    <PageTitle title="الواجبات" subtitle="متابعة التسليم ودرجات الواجبات ومدى الالتزام"/>
    <section className="quick-grid">
      <Metric title="نسبة الإنجاز" value={`${completion}%`} tone={completion>=85?"green":"orange"}/>
      <Metric title="تحتاج متابعة" value={`${missing}`} tone={missing===0?"green":"red"}/>
    </section>
    <section className="list-card">
      <h3>سجل الواجبات</h3>
      {ordered.map(x=><article key={x.id}>
        <div><strong>{x.title}</strong><small>موعد التسليم: {x.dueDate}{typeof x.score==="number"?` · الدرجة ${x.score}%`:""}</small></div>
        <b className={`status ${x.status}`}>{x.status==="completed"?"تم التسليم":x.status==="late"?"متأخر":"لم يُسلّم"}</b>
      </article>)}
      {!homework.length?<div className="empty-v7">لا توجد واجبات مسجلة حتى الآن.</div>:null}
    </section>
  </div>
}

function Commitment({academic}:{academic:AcademicSnapshot}){
  const attendanceScore=academic.attendanceRate;
  const punctuality=Math.max(0,100-academic.lateCount*8);
  const homeworkScore=academic.homeworkCompletion;
  const overall=academic.commitmentRate;

  return <div className="page-stack">
    <PageTitle title="الالتزام والانضباط" subtitle="تفاصيل التزام الطالب بالحضور والمواعيد والواجبات"/>
    <section className="evaluation-card commitment-hero-v3">
      <div className="evaluation-head">
        <div><span>التقييم الحالي</span><h2>{overall>=90?"ممتاز":overall>=80?"جيد جدًا":overall>=70?"جيد":"يحتاج متابعة"}</h2></div>
        <div className="score-ring">{overall}<small>/100</small></div>
      </div>
      <p>
        التقييم مبني على الانتظام في الحضور، الالتزام بالمواعيد، تسليم الواجبات، والاستمرار على نفس مستوى الجدية خلال الكورس.
      </p>
    </section>

    <section className="breakdown-card">
      <h3>تفاصيل الالتزام</h3>
      <Bar label="الالتزام بالحضور" value={attendanceScore}/>
      <Bar label="الالتزام بالمواعيد" value={punctuality}/>
      <Bar label="تسليم الواجبات" value={homeworkScore}/>
      <Bar label="الالتزام العام" value={overall}/>
    </section>

    <section className="quick-grid">
      <Metric title="الغياب" value={`${academic.absences}`} tone={academic.absences===0?"green":"orange"}/>
      <Metric title="التأخير" value={`${academic.lateCount}`} tone={academic.lateCount<=1?"green":"orange"}/>
    </section>
  </div>
}

function Finance({data,payments}:{data:FinanceSnapshot;payments?:PaymentItem[]}){
  return <div className="page-stack">
    <PageTitle title="الموقف المالي" subtitle="تفاصيل المدفوعات والمستحقات"/>
    <section className="money-card hero-money">
      <span>إجمالي قيمة الكورس</span><strong>{money(data.totalCourseFee)} ج.م</strong>
    </section>
    <section className="quick-grid">
      <Metric title="المدفوع" value={`${money(data.paid)} ج.م`} tone="green"/>
      <Metric title="المتبقي" value={`${money(data.remaining)} ج.م`} tone="red"/>
    </section>
    <section className="installment-card">
      <span>القسط القادم</span>
      <strong>{money(data.nextInstallment)} ج.م</strong>
      <small>{data.nextInstallmentDate}</small>
    </section>
    <section className="list-card">
      <h3>سجل الدفعات</h3>
      {(payments||[]).map(p=><article key={p.id}><div><strong>{money(p.amount)} ج.م</strong><small>{p.date} · {p.method}{p.receiptNo?` · إيصال ${p.receiptNo}`:""}</small></div><b className="status completed">مدفوع</b></article>)}
    </section>
  </div>
}

function Notifications({items,pushEnabled,setPushEnabled}:{items:NotificationItem[];pushEnabled:boolean;setPushEnabled:(v:boolean)=>void}){
  const important=items.filter(x=>["attendance","homework","finance","academic"].includes(x.type));
  const actionFor=(n:NotificationItem)=>{
    if(n.type==="homework") return {href:"/?tab=tasks",label:"عرض الواجبات"};
    if(n.type==="finance") return {href:"/?tab=finance",label:"عرض المالية"};
    if(n.type==="attendance") return {href:"/?tab=attendance",label:"عرض الحضور"};
    return {href:"/?tab=exams",label:"عرض الامتحانات"};
  };
  return <div className="page-stack">
    <PageTitle title="الإشعارات" subtitle="الغياب والواجبات والنتائج والمستحقات المهمة"/>
    <section className="push-card-v9">
      <div><span>Push Notifications</span><strong>{pushEnabled?"مفعّلة":"غير مفعّلة"}</strong><small>سيتم ربطها لاحقًا بخدمة الإشعارات الحقيقية على Android/iOS.</small></div>
      <button type="button" onClick={()=>setPushEnabled(!pushEnabled)}>{pushEnabled?"إيقاف":"تفعيل"}</button>
    </section>
    <section className="notification-list">
      {important.map(n=>{
        const action=actionFor(n);
        return <article key={n.id} className={`notice ${n.type} actionable-notice-v19`}>
          <span>●</span>
          <div>
            <strong>{n.title}</strong>
            <p>{n.body}</p>
            <small>{n.createdAt}</small>
            <a href={action.href}>{action.label} ←</a>
          </div>
        </article>
      })}
    </section>
  </div>
}

function Weekly({
  weekly,exams,homework,attendance,academic
}:{
  weekly:WeeklyReport;
  exams:ExamItem[];
  homework:HomeworkItem[];
  attendance:AttendanceItem[];
  academic:AcademicSnapshot|null;
}){
  const previousWeeks=[
    {
      id:"week-1",
      label:"الأسبوع الأول",
      date:"20–26 يوليو",
      weekly:{...weekly,weekLabel:"20–26 يوليو",attendanceRate:90,homeworkCompletion:86,examAverage:82,commitmentRate:88,trend:"stable" as const},
      exams:exams.map((x,i)=>({...x,score:Math.max(0,x.score-(i+1))})),
      homework:homework.map((x,i)=>({...x,score:typeof x.score==="number"?Math.max(0,x.score-(i+1)*2):x.score})),
      attendance
    },
    {
      id:"week-2",
      label:"الأسبوع الثاني",
      date:"27 يوليو–2 أغسطس",
      weekly:{...weekly,weekLabel:"27 يوليو–2 أغسطس",attendanceRate:92,homeworkCompletion:89,examAverage:84,commitmentRate:89,trend:"up" as const},
      exams:exams.map((x,i)=>({...x,score:Math.max(0,x.score-1)})),
      homework:homework.map((x,i)=>({...x,score:typeof x.score==="number"?Math.max(0,x.score-(i+1)):x.score})),
      attendance
    }
  ];

  const reportWeekly=weekly;
  const reportExams=exams;
  const reportHomework=homework;
  const reportAttendance=attendance;

  const trend=reportWeekly.trend==="up"?"↑ يتحسن":reportWeekly.trend==="down"?"↓ يتراجع":"→ مستقر";
  const weeklyScore=Math.round((reportWeekly.attendanceRate+reportWeekly.homeworkCompletion+reportWeekly.examAverage+reportWeekly.commitmentRate)/4);

  const examPercentages=reportExams.map(examPercent);
  const highestExam=examPercentages.length?Math.max(...examPercentages):0;
  const lowestExam=examPercentages.length?Math.min(...examPercentages):0;
  const latestExam=reportExams[reportExams.length-1];
  const previousExam=reportExams.length>1?reportExams[reportExams.length-2]:null;
  const examDelta=latestExam&&previousExam?latestExam.score-previousExam.score:0;

  const homeworkScores=reportHomework.filter(x=>typeof x.score==="number").map(x=>Number(x.score));
  const homeworkAverage=homeworkScores.length?Math.round(homeworkScores.reduce((a,b)=>a+b,0)/homeworkScores.length):0;
  const completedHomework=reportHomework.filter(x=>x.status==="completed").length;
  const missingHomework=reportHomework.filter(x=>x.status!=="completed").length;

  const presentCount=reportAttendance.filter(x=>x.status==="present").length;
  const absentCount=reportAttendance.filter(x=>x.status==="absent").length;
  const lateCount=reportAttendance.filter(x=>x.status==="late").length;

  const allSections=reportExams.flatMap(x=>x.sections||[]);
  const sectionMap=new Map<string,number[]>();
  for(const s of allSections){
    const arr=sectionMap.get(s.name)||[];
    arr.push(s.maxScore?Math.round((s.score/s.maxScore)*100):s.score);
    sectionMap.set(s.name,arr);
  }
  const sectionAverages=[...sectionMap.entries()].map(([name,scores])=>({
    name,
    score:Math.round(scores.reduce((a,b)=>a+b,0)/scores.length)
  }));
  const strongest=sectionAverages.length?[...sectionAverages].sort((a,b)=>b.score-a.score)[0]:null;
  const weakest=sectionAverages.length?[...sectionAverages].sort((a,b)=>a.score-b.score)[0]:null;

  const strengths=[
    reportWeekly.attendanceRate>=90?"الحضور":"",
    homeworkAverage>=85?"الواجبات":"",
    reportWeekly.examAverage>=85?"الامتحانات":"",
    reportWeekly.commitmentRate>=90?"الالتزام":""
  ].filter(Boolean);

  const concerns=[
    absentCount>0?"الغياب":"",
    lateCount>=2?"التأخير":"",
    missingHomework>0?"الواجبات غير المكتملة":"",
    reportWeekly.examAverage<75?"نتائج الامتحانات":"",
    weakest&&weakest.score<80?weakest.name:""
  ].filter(Boolean);

  const summaryText=
    `حقق الطالب هذا الأسبوع متوسط ${reportWeekly.examAverage}% في الاختبارات و${homeworkAverage||reportWeekly.homeworkCompletion}% في الواجبات. `+
    `حضر ${presentCount} من ${reportAttendance.length||0} حصص، مع ${absentCount} غياب و${lateCount} تأخير. `+
    `${examDelta>0?`تحسن آخر اختبار بمقدار ${examDelta} درجات.`:examDelta<0?`انخفض آخر اختبار بمقدار ${Math.abs(examDelta)} درجات.`:"نتائج الاختبارات مستقرة تقريبًا."} `+
    `${strongest&&weakest?`أقوى جزء هو ${strongest.name} بمتوسط ${strongest.score}%، بينما يحتاج ${weakest.name} إلى تركيز أكبر بمتوسط ${weakest.score}%.`:""}`;

  return <div className="page-stack">
    <PageTitle title="التقرير الأسبوعي التفصيلي" subtitle={reportWeekly.weekLabel}/>

    <section className="weekly-archive-safe-v25">
      <div className="weekly-archive-head-v25">
        <div><span>أرشيف التقارير</span><h3>الأسابيع السابقة</h3></div>
        <b>{previousWeeks.length} تقارير محفوظة</b>
      </div>

      <div className="weekly-current-v25">
        <span>الأسبوع الحالي</span>
        <strong>{weekly.weekLabel}</strong>
      </div>

      <div className="weekly-native-archive-v25">
        {previousWeeks.map((x,index)=><details key={x.id} className="weekly-native-week-v25">
          <summary>
            <div>
              <strong>{x.label}</strong>
              <small>{x.date}</small>
            </div>
            <span>فتح التقرير</span>
          </summary>

          <div className="weekly-native-preview-v25">
            <div className="weekly-native-kpis-v25">
              <span>الامتحانات <b>{x.weekly.examAverage}%</b></span>
              <span>الواجبات <b>{x.weekly.homeworkCompletion}%</b></span>
              <span>الحضور <b>{x.weekly.attendanceRate}%</b></span>
              <span>الالتزام <b>{x.weekly.commitmentRate}%</b></span>
            </div>

            <div className="weekly-native-section-v25">
              <strong>الامتحانات</strong>
              {x.exams.map(ex=><div key={ex.id}><span>{ex.title}</span><b>{examScoreText(ex)}</b></div>)}
            </div>

            <div className="weekly-native-section-v25">
              <strong>الواجبات</strong>
              {x.homework.map(hw=><div key={hw.id}>
                <span>{hw.title}</span>
                <b>{typeof hw.score==="number"?`${hw.score}%`:"—"}</b>
              </div>)}
            </div>

            <div className="weekly-native-section-v25">
              <strong>الحضور</strong>
              {x.attendance.map((att,i)=><div key={i}>
                <span>{att.date}</span>
                <b>{att.status==="present"?"حاضر":att.status==="absent"?"غائب":"متأخر"}</b>
              </div>)}
            </div>
          </div>
        </details>)}
      </div>
    </section>

    <section className="evaluation-card weekly-hero-v20">
      <div className="evaluation-head">
        <div>
          <span>التقييم العام للأسبوع</span>
          <h2>{trend}</h2>
          <em className={`trend ${reportWeekly.trend}`}>درجة الأسبوع {weeklyScore}/100</em>
        </div>
        <div className="score-ring">{weeklyScore}<small>/100</small></div>
      </div>
      <p>{summaryText}</p>
    </section>

    <section className="quick-grid">
      <Metric title="متوسط الامتحانات" value={`${reportWeekly.examAverage}%`} tone={reportWeekly.examAverage>=85?"green":reportWeekly.examAverage>=70?"blue":"orange"}/>
      <Metric title="متوسط الواجبات" value={`${homeworkAverage||reportWeekly.homeworkCompletion}%`} tone={(homeworkAverage||reportWeekly.homeworkCompletion)>=85?"green":"orange"}/>
      <Metric title="الحضور" value={`${reportWeekly.attendanceRate}%`} tone={reportWeekly.attendanceRate>=90?"green":"orange"}/>
      <Metric title="الالتزام" value={`${reportWeekly.commitmentRate}%`} tone={reportWeekly.commitmentRate>=90?"green":"blue"}/>
    </section>

    <section className="weekly-detail-card-v20 weekly-attendance-card-v26">
      <div className="weekly-detail-title-v20">
        <div><span>الحضور والالتزام</span><h3>تفاصيل الحصص</h3></div>
        <b>{presentCount} حاضر · {absentCount} غياب · {lateCount} تأخير</b>
      </div>
      <div className="weekly-attendance-list-v20">
        {reportAttendance.map((x,i)=><article key={i}>
          <div><strong>{x.date}</strong><small>حصة الكورس</small></div>
          <span className={`status ${x.status}`}>{x.status==="present"?"حاضر":x.status==="absent"?"غائب":"متأخر"}</span>
        </article>)}
      </div>
    </section>

    <section className="weekly-detail-card-v20 weekly-homework-card-v26">
      <div className="weekly-detail-title-v20">
        <div><span>الواجبات</span><h3>كل واجبات الأسبوع</h3></div>
        <b>{completedHomework} مكتمل · {missingHomework} يحتاج متابعة</b>
      </div>
      <div className="weekly-homework-list-v20">
        {reportHomework.map(x=><article key={x.id}>
          <div><strong>{x.title}</strong><small>موعد التسليم: {x.dueDate}</small></div>
          <div className="weekly-grade-block-v20">
            <b>{typeof x.score==="number"?`${x.score}%`:"—"}</b>
            <span className={`status ${x.status}`}>{x.status==="completed"?"تم التسليم":x.status==="late"?"متأخر":"لم يُسلّم"}</span>
          </div>
        </article>)}
      </div>
    </section>

    <section className="weekly-detail-card-v20 weekly-exams-card-v26">
      <div className="weekly-detail-title-v20">
        <div><span>الامتحانات</span><h3>تفاصيل كل اختبار</h3></div>
        <b>أعلى أداء {highestExam}% · أقل أداء {lowestExam}%</b>
      </div>
      <div className="weekly-exams-list-v20">
        {reportExams.map((x,index)=>{
          const prev=index>0?reportExams[index-1]:null;
          const delta=prev?x.score-prev.score:0;
          return <article key={x.id}>
            <div className="weekly-exam-head-v20">
              <div><strong>{x.title}</strong><small>{x.date}{prev?` · ${delta>0?`تحسن +${delta}`:delta<0?`تراجع ${delta}`:"ثابت"}`:""}</small></div>
              <b>{examScoreText(x)}</b>
            </div>
            {x.sections?.length?<div className="weekly-exam-sections-v20">
              {x.sections.map(s=><span key={s.name}>{s.name}<b>{sectionScoreText(s)}</b></span>)}
            </div>:null}
          </article>
        })}
      </div>
    </section>

    {sectionAverages.length?<section className="breakdown-card">
      <h3>متوسط الأداء حسب الجزء</h3>
      {sectionAverages.map(s=><Bar key={s.name} label={s.name} value={s.score}/>)}
    </section>:null}

    <section className="weekly-insights-v19">
      <article className="weekly-strengths-v19"><span>نقاط القوة</span><strong>{strengths.length?strengths.join("، "):"لا توجد نقطة قوة واضحة هذا الأسبوع"}</strong></article>
      <article className="weekly-concerns-v19"><span>يحتاج تحسين</span><strong>{concerns.length?concerns.join("، "):"لا توجد ملاحظات كبيرة"}</strong></article>
    </section>

    <section className="weekly-comment-v20"><span>التعليق الأسبوعي</span><p>{summaryText}</p></section>
    <section className="weekly-plan-v20"><span>خطة الأسبوع القادم</span><p>{weakest?`التركيز على ${weakest.name} مع هدف رفع المتوسط بما لا يقل عن 5 درجات، وإنهاء أي واجبات غير مكتملة، والحفاظ على الحضور الكامل.`:"الحفاظ على مستوى الالتزام الحالي وزيادة التدريب تدريجيًا في الأجزاء الأقل من 85%."}</p></section>
    <section className="weekly-teacher-note-v20"><span>ملاحظات المدرس / المتابعة</span><p>مساحة جاهزة لإضافة ملاحظة المدرس أو فريق المتابعة عند الربط الحقيقي مع النظام الإداري أو American Platform.</p></section>
  </div>
}

function Contact(){
  return <div className="page-stack">
    <PageTitle title="تواصل مع الإدارة" subtitle="اختر نوع الاستفسار"/>
    <section className="contact-grid-v9">
      <a href="tel:01000000000"><span>☎</span><strong>الدراسة والمتابعة</strong><small>الحضور، الواجبات، المستوى</small></a>
      <a href="tel:01000000001"><span>ج</span><strong>الحسابات</strong><small>الأقساط والمدفوعات</small></a>
      <a href="https://wa.me/201000000000"><span>◉</span><strong>WhatsApp</strong><small>تواصل سريع مع الإدارة</small></a>
    </section>
  </div>
}

function Account({parent,students,currentStudentId}:{parent:ParentProfile;students:Student[];currentStudentId:string}){
  return <div className="page-stack">
    <PageTitle title="حساب ولي الأمر" subtitle="بيانات الحساب والأبناء المرتبطون به"/>
    <section className="account-card-v9"><div className="avatar">و</div><div><strong>{parent.fullName}</strong><span>{parent.phone}</span></div></section>
    <section className="list-card">
      <h3>الأبناء</h3>
      {students.map(s=><article key={s.id}><div><strong>{s.name}</strong><small>{s.course} · {s.level}</small></div><b className={`status ${s.id===currentStudentId?"completed":"present"}`}>{s.id===currentStudentId?"الحالي":"متاح"}</b></article>)}
    </section>
    <section className="security-note-v9">يتم ربط كل ولي أمر بأبنائه فقط. عند الربط الحقيقي سيتم التحقق برقم الهاتف/OTP ومنع الوصول لأي طالب غير مرتبط بالحساب.</section>
  </div>
}


function MetricButton({title,value,tone,href,detail,icon}:{title:string;value:string;tone:string;href:string;detail:string;icon:string}){
  return <a href={href} className={`metric metric-button-v3 ${tone}`}>
    <i className="metric-icon-v18">{icon}</i>
    <span>{title}</span>
    <strong>{value}</strong>
    <small>{detail} ←</small>
  </a>
}

function Metric({title,value,tone}:{title:string;value:string;tone:string}){
  return <article className={`metric ${tone}`}><span>{title}</span><strong>{value}</strong></article>
}

function Bar({label,value,weight}:{label:string;value:number;weight?:string}){
  return <div className="bar-row"><div><span>{label}</span>{weight?<small>وزن {weight}</small>:null}<b>{value}%</b></div><div className="bar"><i style={{width:`${Math.max(0,Math.min(100,value))}%`}}/></div></div>
}

function PageTitle({title,subtitle}:{title:string;subtitle:string}){
  return <div className="page-title"><span>تقرير الطالب</span><h2>{title}</h2><p>{subtitle}</p></div>
}
