"use client";

import {useEffect,useMemo,useState} from "react";
import {useSearchParams} from "next/navigation";

type Student={id:string;code:string;name:string;course:string;reportVisible:boolean};
type Report={
  id:string;student_id:string;week_label:string;week_start:string;week_end:string;
  status:"draft"|"published";published_at?:string|null;
  teacher_note?:string|null;followup_note?:string|null;next_week_plan?:string|null;
  attendance_entries?:any[];homework_entries?:any[];exam_entries?:any[];finance_entries?:any[];
};

const percent=(score:number,max:number)=>max>0?Math.round(score/max*100):0;

function asArray<T=any>(value:T|T[]|null|undefined):T[]{
  if(Array.isArray(value)) return value;
  if(value==null) return [];
  return [value];
}

function makeDemo(){
  const students:Student[]=[
    {id:"std_001",code:"ST-0001",name:"محمود أحمد",course:"EST",reportVisible:true},
    {id:"std_002",code:"ST-0002",name:"سارة أحمد",course:"Beginners 1",reportVisible:true},
    {id:"std_003",code:"ST-0003",name:"يوسف علي",course:"SAT",reportVisible:false},
  ];
  const base=(id:string,name:string,code:string,course:string,week:string,start:string,end:string,score:number,status:"draft"|"published"="published"):Report=>({
    id,student_id:id.startsWith("r2")?"std_002":"std_001",week_label:week,week_start:start,week_end:end,status,
    teacher_note:"تحسن واضح في الأداء.",followup_note:"الالتزام جيد هذا الأسبوع.",next_week_plan:"التركيز على نقاط الضعف الأسبوع القادم.",
    attendance_entries:[
      {id:id+"a1",date:start,status:"present"},
      {id:id+"a2",date:end,status:"late"}
    ],
    homework_entries:[
      {id:id+"h1",title:"Reading Practice",score:18,max_score:20,status:"completed"},
      {id:id+"h2",title:"Writing Sheet",score:17,max_score:20,status:"completed"}
    ],
    exam_entries:[
      {id:id+"e1",title:"Weekly Exam",date:end,score,max_score:50,exam_sections:[
        {id:id+"s1",name:"Reading",score:17,max_score:20},
        {id:id+"s2",name:"Writing",score:18,max_score:20},
        {id:id+"s3",name:"Vocabulary",score:9,max_score:10}
      ]}
    ],
    finance_entries:[{id:id+"f1",paid:1500,due:500,due_date:end,note:"القسط الحالي"}]
  });

  const reports:Report[]=[
    base("r1","محمود أحمد","ST-0001","EST","الأسبوع الحالي","2026-08-09","2026-08-15",44),
    base("r12","محمود أحمد","ST-0001","EST","الأسبوع الثالث","2026-08-02","2026-08-08",41),
    base("r13","محمود أحمد","ST-0001","EST","الأسبوع الثاني","2026-07-26","2026-08-01",38,"draft"),
    {...base("r21","سارة أحمد","ST-0002","Beginners 1","الأسبوع الحالي","2026-08-09","2026-08-15",27),student_id:"std_002",
      exam_entries:[{id:"r21e1",title:"Beginners Quiz",date:"2026-08-15",score:27,max_score:30,exam_sections:[]}]}
  ];
  return {students,reports};
}

export default function AdminReportsManager(){
  const searchParams=useSearchParams();
  const requestedStudent=searchParams.get("student");
  const demo=useMemo(()=>makeDemo(),[]);
  const [students,setStudents]=useState<Student[]>(demo.students);
  const [reports,setReports]=useState<Report[]>(demo.reports);
  const [selectedStudentId,setSelectedStudentId]=useState("std_001");
  const [selectedReportId,setSelectedReportId]=useState("r1");
  const [query,setQuery]=useState("");
  const [courseFilter,setCourseFilter]=useState("الكل");
  const [mode,setMode]=useState<"checking"|"demo"|"online">("checking");
  const [editing,setEditing]=useState(false);
  const [edit,setEdit]=useState({weekLabel:"",weekStart:"",weekEnd:"",teacherNote:"",followupNote:"",nextWeekPlan:""});

  const selectedStudent=students.find(s=>s.id===selectedStudentId)||null;
  const selectedReport=reports.find(r=>r.id===selectedReportId)||null;

  useEffect(()=>{
    fetch("/api/admin/students").then(r=>r.json()).then(async data=>{
      setMode(data.mode==="online"?"online":"demo");
      if(data.mode==="online" && Array.isArray(data.students) && data.students.length){
        const mapped=data.students.map((s:any)=>({
          id:s.id,code:s.code,name:s.name,course:s.course_name,reportVisible:s.report_visible
        }));
        setStudents(mapped);
        const first=mapped[0];
        setSelectedStudentId(first.id);
        const rr=await fetch(`/api/admin/reports/manage?studentId=${encodeURIComponent(first.id)}`).then(r=>r.json());
        if(Array.isArray(rr.reports)){
          setReports(rr.reports);
          setSelectedReportId(rr.reports[0]?.id||"");
        }
      }
    }).catch(()=>setMode("demo"));
  },[]);

  useEffect(()=>{
    if(!requestedStudent) return;
    const exists=students.some(s=>s.id===requestedStudent);
    if(!exists) return;
    setSelectedStudentId(requestedStudent);
    const rr=reports.filter(r=>r.student_id===requestedStudent).sort((a,b)=>b.week_start.localeCompare(a.week_start));
    setSelectedReportId(rr[0]?.id||"");
  },[requestedStudent,students.length]);

  useEffect(()=>{
    if(!selectedReport) return;
    setEdit({
      weekLabel:selectedReport.week_label,weekStart:selectedReport.week_start,weekEnd:selectedReport.week_end,
      teacherNote:selectedReport.teacher_note||"",followupNote:selectedReport.followup_note||"",nextWeekPlan:selectedReport.next_week_plan||""
    });
  },[selectedReportId]);

  const courses=useMemo(()=>Array.from(new Set(students.map(s=>s.course))).sort(),[students]);
  const filteredStudents=useMemo(()=>students.filter(s=>{
    const q=query.trim().toLowerCase();
    return (courseFilter==="الكل"||s.course===courseFilter) && (!q||s.name.toLowerCase().includes(q)||s.code.toLowerCase().includes(q));
  }),[students,query,courseFilter]);

  const studentReports=useMemo(()=>reports.filter(r=>r.student_id===selectedStudentId).sort((a,b)=>b.week_start.localeCompare(a.week_start)),[reports,selectedStudentId]);
  const last4=studentReports.slice(0,4);

  const metrics=useMemo(()=>{
    const examVals=last4.flatMap(r=>asArray(r.exam_entries).map((e:any)=>percent(Number(e.score),Number(e.max_score))));
    const hwVals=last4.flatMap(r=>asArray(r.homework_entries).filter((h:any)=>h.score!=null&&h.max_score).map((h:any)=>percent(Number(h.score),Number(h.max_score))));
    const att=last4.flatMap(r=>asArray(r.attendance_entries));
    const avg=(a:number[])=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):0;
    const weekly=last4.map(r=>{
      const x=asArray(r.exam_entries).map((e:any)=>percent(Number(e.score),Number(e.max_score)));
      return avg(x);
    }).filter(Boolean);
    const delta=weekly.length>1?weekly[0]-weekly[weekly.length-1]:0;
    return {
      exam:avg(examVals),homework:avg(hwVals),
      attendance:att.length?Math.round(att.filter((x:any)=>x.status==="present").length/att.length*100):0,
      trend:delta>0?"تحسن":delta<0?"تراجع":"مستقر",delta
    };
  },[last4]);

  const selectStudent=async(id:string)=>{
    setSelectedStudentId(id); setEditing(false);
    if(mode==="online"){
      const data=await fetch(`/api/admin/reports/manage?studentId=${encodeURIComponent(id)}`).then(r=>r.json());
      if(Array.isArray(data.reports)){
        setReports(prev=>[...prev.filter(r=>r.student_id!==id),...data.reports]);
        setSelectedReportId(data.reports[0]?.id||"");
      }
    }else{
      const rr=reports.filter(r=>r.student_id===id).sort((a,b)=>b.week_start.localeCompare(a.week_start));
      setSelectedReportId(rr[0]?.id||"");
    }
  };

  const save=async()=>{
    if(!selectedReport) return;
    if(mode==="online"){
      const res=await fetch("/api/admin/reports/manage",{method:"PATCH",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({id:selectedReport.id,...edit})});
      if(!res.ok){alert("تعذر حفظ التعديلات");return}
    }
    setReports(v=>v.map(r=>r.id===selectedReport.id?{
      ...r,week_label:edit.weekLabel,week_start:edit.weekStart,week_end:edit.weekEnd,
      teacher_note:edit.teacherNote,followup_note:edit.followupNote,next_week_plan:edit.nextWeekPlan
    }:r));
    setEditing(false);
  };

  const toggleStatus=async()=>{
    if(!selectedReport) return;
    const next=selectedReport.status==="published"?"draft":"published";
    if(mode==="online"){
      const res=await fetch("/api/admin/reports/manage",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:selectedReport.id,status:next})});
      if(!res.ok){alert("تعذر تغيير الحالة");return}
    }
    setReports(v=>v.map(r=>r.id===selectedReport.id?{...r,status:next}:r));
  };

  const toggleVisibility=async()=>{
    if(!selectedStudent||!selectedReport) return;
    const next=!selectedStudent.reportVisible;
    if(mode==="online"){
      const res=await fetch("/api/admin/reports/manage",{method:"PATCH",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({id:selectedReport.id,studentId:selectedStudent.id,studentReportVisible:next})});
      if(!res.ok){alert("تعذر تغيير ظهور التقرير");return}
    }
    setStudents(v=>v.map(s=>s.id===selectedStudent.id?{...s,reportVisible:next}:s));
  };

  const remove=async()=>{
    if(!selectedReport||!confirm(`حذف ${selectedReport.week_label} نهائيًا؟`)) return;
    if(mode==="online"){
      const res=await fetch(`/api/admin/reports/manage?id=${encodeURIComponent(selectedReport.id)}`,{method:"DELETE"});
      if(!res.ok){alert("تعذر حذف التقرير");return}
    }
    const nextReports=reports.filter(r=>r.id!==selectedReport.id);
    setReports(nextReports);
    const next=nextReports.filter(r=>r.student_id===selectedStudentId).sort((a,b)=>b.week_start.localeCompare(a.week_start))[0];
    setSelectedReportId(next?.id||"");
  };

  const selectedAttendance=asArray(selectedReport?.attendance_entries);
  const selectedHomework=asArray(selectedReport?.homework_entries);
  const selectedExams=asArray(selectedReport?.exam_entries);
  const selectedFinance=asArray(selectedReport?.finance_entries);

  return <div className="admin-reports-page-v37 premium-admin-reports-v77">
    <header className="admin-reports-topbar-v37">
      <div><span>لوحة الإدارة</span><h1>سجل تقارير الطلاب</h1><p>كل التقارير الحالية والسابقة في شاشة واحدة.</p></div>
      <div className="admin-reports-actions-v37">
        <span className={`backend-mode-v36 ${mode}`}>{mode==="online"?"Online DB":mode==="demo"?"Demo Mode":"Checking..."}</span>
        <a href="/manual-entry">+ تقرير جديد</a>
      </div>
    </header>

    <div className="admin-reports-layout-v37">
      <aside className="reports-students-sidebar-v37">
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="بحث بالاسم أو الكود"/>
        <select value={courseFilter} onChange={e=>setCourseFilter(e.target.value)}>
          <option value="الكل">كل الكورسات</option>{courses.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <div className="reports-student-count-v37">{filteredStudents.length} طالب</div>
        <div className="reports-students-list-v37">
          {filteredStudents.map(s=><button key={s.id} className={s.id===selectedStudentId?"active":""} onClick={()=>selectStudent(s.id)}>
            <span>{s.code}</span><div><strong>{s.name}</strong><small>{s.course} · {reports.filter(r=>r.student_id===s.id).length} تقارير</small></div>
            <i className={s.reportVisible?"on":"off"}>{s.reportVisible?"●":"×"}</i>
          </button>)}
        </div>
      </aside>

      <main className="admin-reports-main-v37">
        {selectedStudent?<section className="student-report-overview-v37">
          <div><span>ملف الطالب</span><h2>{selectedStudent.name}</h2><small>{selectedStudent.code} · {selectedStudent.course}</small></div>
          <button className={selectedStudent.reportVisible?"visible":"hidden"} onClick={toggleVisibility}>
            {selectedStudent.reportVisible?"التقارير ظاهرة لولي الأمر":"التقارير مخفية عن ولي الأمر"}
          </button>
        </section>:null}

        <section className="report-trend-grid-v37">
          <article><span>الاتجاه</span><strong>{metrics.trend}</strong><small>{metrics.delta>0?`+${metrics.delta}`:metrics.delta} نقطة</small></article>
          <article><span>الامتحانات</span><strong>{metrics.exam}%</strong><small>آخر 4 أسابيع</small></article>
          <article><span>الواجبات</span><strong>{metrics.homework}%</strong><small>آخر 4 أسابيع</small></article>
          <article><span>الحضور</span><strong>{metrics.attendance}%</strong><small>آخر 4 أسابيع</small></article>
        </section>

        <div className="report-workspace-v37">
          <aside className="weeks-sidebar-v37">
            <h3>كل الأسابيع</h3>
            {studentReports.map(r=><button key={r.id} className={r.id===selectedReportId?"active":""} onClick={()=>{setSelectedReportId(r.id);setEditing(false)}}>
              <div><strong>{r.week_label}</strong><small>{r.week_start} → {r.week_end}</small></div>
              <span className={r.status}>{r.status==="published"?"منشور":"مسودة"}</span>
            </button>)}
          </aside>

          <section className="report-detail-v37">
            {selectedReport?<>
              <div className="report-detail-head-v37">
                <div><span>{selectedReport.status==="published"?"منشور":"مسودة"}</span><h2>{selectedReport.week_label}</h2><small>{selectedReport.week_start} إلى {selectedReport.week_end}</small></div>
                <div className="report-detail-actions-v37">
                  <button onClick={()=>setEditing(v=>!v)}>{editing?"إلغاء":"تعديل التقرير"}</button>
                  <button onClick={toggleStatus}>{selectedReport.status==="published"?"تحويل لمسودة":"إعادة نشر"}</button>
                  <button className="danger" onClick={remove}>حذف التقرير</button>
                </div>
              </div>

              {editing?<section className="report-edit-form-v37">
                <input value={edit.weekLabel} onChange={e=>setEdit({...edit,weekLabel:e.target.value})} placeholder="اسم الأسبوع"/>
                <input type="date" value={edit.weekStart} onChange={e=>setEdit({...edit,weekStart:e.target.value})}/>
                <input type="date" value={edit.weekEnd} onChange={e=>setEdit({...edit,weekEnd:e.target.value})}/>
                <textarea value={edit.teacherNote} onChange={e=>setEdit({...edit,teacherNote:e.target.value})} placeholder="ملاحظة المدرس"/>
                <textarea value={edit.followupNote} onChange={e=>setEdit({...edit,followupNote:e.target.value})} placeholder="ملاحظة المتابعة"/>
                <textarea value={edit.nextWeekPlan} onChange={e=>setEdit({...edit,nextWeekPlan:e.target.value})} placeholder="خطة الأسبوع القادم"/>
                <button onClick={save}>حفظ التعديلات</button>
              </section>:null}

              <section className="report-block-v37 attendance"><h3>الحضور</h3>{selectedAttendance.map((a:any)=><div key={a.id}><span>{a.date}</span><strong>{a.status==="present"?"حاضر":a.status==="absent"?"غائب":"متأخر"}</strong></div>)}</section>

              <section className="report-block-v37 homework"><h3>الواجبات</h3>{selectedHomework.map((h:any)=><div key={h.id}><span>{h.title}</span><strong>{h.score!=null&&h.max_score?`${h.score} / ${h.max_score}`:"—"}</strong><small>{h.status}</small></div>)}</section>

              <section className="report-block-v37 exams"><h3>الامتحانات</h3>{selectedExams.map((e:any)=><article key={e.id}>
                <div><strong>{e.title}</strong><b>{e.score} / {e.max_score}</b></div>
                {asArray(e.exam_sections).length?<div className="exam-sections-v37">{asArray(e.exam_sections).map((s:any)=><span key={s.id}>{s.name}<b>{s.score} / {s.max_score}</b></span>)}</div>:null}
              </article>)}</section>

              <section className="report-block-v37 finance"><h3>المالية</h3>{selectedFinance.map((f:any)=><div className="finance-report-grid-v37" key={f.id}>
                <span>المدفوع <b>{f.paid} ج.م</b></span><span>المستحق <b>{f.due} ج.م</b></span><span>الاستحقاق <b>{f.due_date||"—"}</b></span>
              </div>)}</section>

              <section className="report-notes-grid-v37">
                <article><span>ملاحظة المدرس</span><p>{selectedReport.teacher_note||"—"}</p></article>
                <article><span>ملاحظة المتابعة</span><p>{selectedReport.followup_note||"—"}</p></article>
                <article><span>خطة الأسبوع القادم</span><p>{selectedReport.next_week_plan||"—"}</p></article>
              </section>
            </>:<div className="empty-report-detail-v37">اختر تقريرًا من قائمة الأسابيع.</div>}
          </section>
        </div>
      </main>
    </div>
  </div>
}
