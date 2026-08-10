"use client";
import {useEffect,useMemo,useState} from "react";

type Student={id:string;name:string;code:string;course:string;phone?:string;parentName?:string;parentPhone?:string;reportVisible?:boolean};
type Tab="overview"|"attendance"|"homework"|"exams"|"finance"|"reports"|"schedule"|"contact";

const today=()=>new Date().toISOString().slice(0,10);
const blankAtt=()=>({id:"",reportId:"",date:today(),status:"present",note:""});
const blankHw=()=>({id:"",title:"",dueDate:today(),status:"completed",score:"",maxScore:""});
const blankExam=()=>({id:"",title:"",date:today(),status:"completed",reading:"",writing:""});
const blankEvent=()=>({id:"",eventType:"class",title:"",eventAt:"",note:"",isActive:true});
const blankReport=()=>({id:"",weekLabel:"",weekStart:today(),teacherNote:"",followupNote:"",nextWeekPlan:"",status:"draft"});
const formatDateTime=(v:string)=>v?new Date(v).toLocaleString("ar-EG"):"—";

export default function ParentAppAdminSettings(){
  const [students,setStudents]=useState<Student[]>([]);
  const [studentId,setStudentId]=useState("");
  const [tab,setTab]=useState<Tab>("overview");
  const [data,setData]=useState<any>({student:null,reports:[],events:[]});
  const [billing,setBilling]=useState<any>(null);
  const [settings,setSettings]=useState<any>({contactTitle:"تواصل معنا",contactSubtitle:"",phone:"",whatsapp:"",email:"",address:"",reminderMinutes:30});
  const [att,setAtt]=useState(blankAtt());
  const [hw,setHw]=useState(blankHw());
  const [exam,setExam]=useState(blankExam());
  const [event,setEvent]=useState(blankEvent());
  const [report,setReport]=useState(blankReport());
  const [studentForm,setStudentForm]=useState<any>({name:"",phone:"",course:"",reportVisible:true,parentName:"",parentPhone:"",parentPassword:""});
  const [payment,setPayment]=useState({amount:"",date:today(),note:""});
  const [msg,setMsg]=useState("");
  const [busy,setBusy]=useState(false);

  const loadStudents=async()=>{
    const r=await fetch("/api/admin/all-students",{cache:"no-store"});const d=await r.json();
    const rows=d.students||[];setStudents(rows);
    if(!studentId&&rows[0])setStudentId(rows[0].id);
  };
  const loadSettings=async()=>{
    const r=await fetch("/api/admin/parent-app-settings",{cache:"no-store"});const d=await r.json();
    if(d.settings)setSettings({
      contactTitle:d.settings.contact_title||"تواصل معنا",contactSubtitle:d.settings.contact_subtitle||"",
      phone:d.settings.phone||"",whatsapp:d.settings.whatsapp||"",email:d.settings.email||"",address:d.settings.address||"",
      reminderMinutes:d.settings.reminder_minutes||30
    });
  };
  const loadStudent=async(id=studentId)=>{
    if(!id)return;
    setBusy(true);setMsg("");
    try{
      const [a,b]=await Promise.all([
        fetch(`/api/admin/parent-control?studentId=${encodeURIComponent(id)}`,{cache:"no-store"}).then(r=>r.json()),
        fetch(`/api/admin/billing?studentId=${encodeURIComponent(id)}`,{cache:"no-store"}).then(r=>r.json()).catch(()=>null)
      ]);
      setData(a);setBilling(b);
      if(a.student){
        const links=Array.isArray(a.student.student_parents)?a.student.student_parents:[];
        const first=[...links].sort((x:any,y:any)=>Number(x.relation_order||0)-Number(y.relation_order||0))[0]?.parent_accounts;
        setStudentForm({
          name:a.student.name||"",phone:a.student.phone||"",course:a.student.courses?.name||"",reportVisible:a.student.report_visible!==false,
          parentName:first?.name||"",parentPhone:first?.phone||"",parentPassword:""
        });
      }
    }finally{setBusy(false)}
  };
  useEffect(()=>{loadStudents();loadSettings()},[]);
  useEffect(()=>{if(studentId)loadStudent(studentId)},[studentId]);

  const reports=useMemo(()=>data.reports||[],[data]);
  const attendance=useMemo(()=>reports.flatMap((r:any)=>(r.attendance_entries||[]).map((x:any)=>({...x,reportId:r.id}))),[reports]);
  const homework=useMemo(()=>reports.flatMap((r:any)=>(r.homework_entries||[]).map((x:any)=>({...x,reportId:r.id}))),[reports]);
  const exams=useMemo(()=>reports.flatMap((r:any)=>(r.exam_entries||[]).map((x:any)=>({...x,reportId:r.id}))),[reports]);
  const selected=students.find(s=>s.id===studentId);

  const send=async(url:string,method:string,body?:any)=>{
    setBusy(true);setMsg("");
    try{
      const r=await fetch(url,{method,headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||"تعذر تنفيذ العملية");
      setMsg("تم الحفظ بنجاح ✓");await loadStudent();
      return d;
    }catch(e:any){setMsg(e.message||"تعذر تنفيذ العملية");return null}
    finally{setBusy(false)}
  };
  const remove=async(kind:string,id:string)=>{
    if(!confirm("هل تريد حذف هذا العنصر؟"))return;
    await send(`/api/admin/parent-control?kind=${kind}&id=${encodeURIComponent(id)}`,"DELETE");
  };

  const saveStudent=()=>send("/api/admin/students","PATCH",{
    id:studentId,name:studentForm.name,phone:studentForm.phone,course:studentForm.course,reportVisible:studentForm.reportVisible,
    parent1:{name:studentForm.parentName,phone:studentForm.parentPhone,password:studentForm.parentPassword.trim()||undefined}
  });
  const saveAtt=async()=>{
    const body={studentId,action:"attendance",...att};
    if(att.id)await send("/api/admin/parent-control","PATCH",{kind:"attendance",id:att.id,studentId,reportId:att.reportId,date:att.date,status:att.status,note:att.note});
    else await send("/api/admin/parent-control","POST",body);
    setAtt(blankAtt());
  };
  const saveHw=async()=>{
    if(hw.id)await send("/api/admin/parent-control","PATCH",{kind:"homework",...hw});
    else await send("/api/admin/parent-control","POST",{studentId,action:"homework",...hw});
    setHw(blankHw());
  };
  const saveExam=async()=>{
    if(exam.id)await send("/api/admin/parent-control","PATCH",{kind:"exam",...exam});
    else await send("/api/admin/parent-control","POST",{studentId,action:"exam",...exam});
    setExam(blankExam());
  };
  const saveEvent=async()=>{
    if(event.id)await send("/api/admin/parent-control","PATCH",{kind:"event",...event});
    else await send("/api/admin/parent-control","POST",{studentId,action:"event",...event});
    setEvent(blankEvent());
  };
  const saveReport=async()=>{
    if(report.id)await send("/api/admin/parent-control","PATCH",{kind:"report",...report});
    else await send("/api/admin/parent-control","POST",{studentId,action:"report",...report});
    setReport(blankReport());
  };
  const addPayment=async()=>{
    await send("/api/admin/billing","POST",{studentId,action:"payment",amount:Number(payment.amount),date:payment.date,note:payment.note});
    setPayment({amount:"",date:today(),note:""});
  };
  const saveSettings=async()=>{
    await send("/api/admin/parent-app-settings","POST",{action:"settings",...settings});
    await loadSettings();
  };

  const chooseExam=(e:any)=>{
    const sec=e.exam_sections||[];
    const rd=sec.find((x:any)=>String(x.name).toLowerCase().includes("reading"));
    const wr=sec.find((x:any)=>String(x.name).toLowerCase().includes("writing"));
    setExam({id:e.id,title:e.title||"",date:e.date||today(),status:e.status||"completed",reading:rd?.score==null?"":String(rd.score),writing:wr?.score==null?"":String(wr.score)});
  };
  const chooseReport=(r:any)=>setReport({id:r.id,weekLabel:r.week_label||"",weekStart:r.week_start||today(),teacherNote:r.teacher_note||"",followupNote:r.followup_note||"",nextWeekPlan:r.next_week_plan||"",status:r.status||"draft"});

  const tabs:[Tab,string,string][]=[
    ["overview","ملف الطالب","◎"],["attendance","الحضور","✓"],["homework","الواجبات","☑"],["exams","الامتحانات","▤"],
    ["finance","المالية","ج"],["reports","التقرير الأسبوعي","▣"],["schedule","المواعيد والتنبيهات","◷"],["contact","تواصل معنا","☎"]
  ];

  return <main className="parent-control-v120" dir="rtl">
    <section className="all-students-hero-v76 parent-control-hero-v120">
      <div><span>مركز التحكم الكامل</span><h1>تطبيق ولي الأمر</h1><p>اختر الطالب وتحكم في كل ما يظهر لولي الأمر من شاشة واحدة.</p></div>
      <div className="parent-control-student-picker-v120">
        <label>الطالب الحالي</label>
        <select value={studentId} onChange={e=>setStudentId(e.target.value)}>
          <option value="">اختر الطالب</option>{students.map(s=><option key={s.id} value={s.id}>{s.name} · {s.code}</option>)}
        </select>
        {selected?<span>{selected.course}</span>:null}
      </div>
    </section>

    {studentId?<section className="parent-control-toolbar-v120">
      <div className="parent-control-tabs-v120">{tabs.map(([k,l,i])=><button key={k} className={tab===k?"active":""} onClick={()=>setTab(k)}><i>{i}</i><span>{l}</span></button>)}</div>
      <a className="parent-preview-v120" href="/parent-login" target="_blank">فتح تطبيق ولي الأمر ↗</a>
    </section>:null}

    {msg?<div className="admin-user-message-v115">{msg}</div>:null}
    {busy?<div className="parent-control-loading-v120">جاري تحديث بيانات الطالب...</div>:null}

    {studentId&&tab==="overview"?<section className="parent-control-panel-v120">
      <div className="parent-control-panel-head-v120"><div><span>الملف الأساسي</span><h2>بيانات الطالب وحالة التطبيق</h2></div></div>
      <div className="parent-control-form-grid-v120">
        <label><span>اسم الطالب</span><input value={studentForm.name} onChange={e=>setStudentForm({...studentForm,name:e.target.value})}/></label>
        <label><span>رقم الطالب</span><input value={studentForm.phone} onChange={e=>setStudentForm({...studentForm,phone:e.target.value})}/></label>
        <label><span>الكورس</span><input value={studentForm.course} onChange={e=>setStudentForm({...studentForm,course:e.target.value})}/></label>
        <label><span>اسم ولي الأمر</span><input value={studentForm.parentName} onChange={e=>setStudentForm({...studentForm,parentName:e.target.value})}/></label>
        <label><span>موبايل ولي الأمر</span><input value={studentForm.parentPhone} onChange={e=>setStudentForm({...studentForm,parentPhone:e.target.value})}/></label>
        <label><span>تغيير باسورد ولي الأمر (اختياري)</span><input type="password" value={studentForm.parentPassword} onChange={e=>setStudentForm({...studentForm,parentPassword:e.target.value})}/></label>
        <label className="parent-control-switch-v120"><input type="checkbox" checked={studentForm.reportVisible} onChange={e=>setStudentForm({...studentForm,reportVisible:e.target.checked})}/><span>{studentForm.reportVisible?"تطبيق المتابعة مفعّل":"تطبيق المتابعة موقوف"}</span></label>
      </div>
      <div className="parent-control-actions-v120"><button className="primary" onClick={saveStudent}>حفظ بيانات الطالب</button></div>
    </section>:null}

    {studentId&&tab==="attendance"?<section className="parent-control-panel-v120">
      <EditorTitle title="الحضور والغياب" sub="إضافة أو تعديل أو حذف أي يوم حضور"/>
      <div className="parent-control-inline-form-v120">
        <input type="date" value={att.date} onChange={e=>setAtt({...att,date:e.target.value})}/>
        <select value={att.status} onChange={e=>setAtt({...att,status:e.target.value})}><option value="present">حاضر</option><option value="late">متأخر</option><option value="absent">غائب</option></select>
        <input placeholder="ملاحظة" value={att.note} onChange={e=>setAtt({...att,note:e.target.value})}/>
        <button className="primary" onClick={saveAtt}>{att.id?"حفظ التعديل":"إضافة"}</button>{att.id?<button onClick={()=>setAtt(blankAtt())}>إلغاء</button>:null}
      </div>
      <DataTable heads={["التاريخ","الحالة","الملاحظة","الإدارة"]}>{attendance.map((a:any)=><tr key={a.id}><td>{a.date}</td><td><StatusBadge value={a.status}/></td><td>{a.note||"—"}</td><td><RowActions edit={()=>setAtt({id:a.id,reportId:a.reportId,date:a.date,status:a.status,note:a.note||""})} del={()=>remove("attendance",a.id)}/></td></tr>)}</DataTable>
    </section>:null}

    {studentId&&tab==="homework"?<section className="parent-control-panel-v120">
      <EditorTitle title="الواجبات" sub="تحكم كامل في الواجب والحالة والدرجة"/>
      <div className="parent-control-inline-form-v120 wide">
        <input placeholder="اسم الواجب" value={hw.title} onChange={e=>setHw({...hw,title:e.target.value})}/>
        <input type="date" value={hw.dueDate} onChange={e=>setHw({...hw,dueDate:e.target.value})}/>
        <select value={hw.status} onChange={e=>setHw({...hw,status:e.target.value})}><option value="completed">تم</option><option value="partial">ناقص</option><option value="not_done">لم يعمل</option></select>
        <input type="number" placeholder="الدرجة" value={hw.score} onChange={e=>setHw({...hw,score:e.target.value})}/>
        <input type="number" placeholder="من" value={hw.maxScore} onChange={e=>setHw({...hw,maxScore:e.target.value})}/>
        <button className="primary" onClick={saveHw}>{hw.id?"حفظ":"إضافة"}</button>{hw.id?<button onClick={()=>setHw(blankHw())}>إلغاء</button>:null}
      </div>
      <DataTable heads={["الواجب","التاريخ","الحالة","الدرجة","الإدارة"]}>{homework.map((h:any)=><tr key={h.id}><td>{h.title}</td><td>{h.due_date||"—"}</td><td><StatusBadge value={h.status}/></td><td>{h.score==null?"—":`${h.score} / ${h.max_score??"—"}`}</td><td><RowActions edit={()=>setHw({id:h.id,title:h.title||"",dueDate:h.due_date||today(),status:h.status||"completed",score:h.score==null?"":String(h.score),maxScore:h.max_score==null?"":String(h.max_score)})} del={()=>remove("homework",h.id)}/></td></tr>)}</DataTable>
    </section>:null}

    {studentId&&tab==="exams"?<section className="parent-control-panel-v120">
      <EditorTitle title="الامتحانات" sub="Reading + Writing والتوتال يُحسب تلقائيًا"/>
      <div className="parent-control-inline-form-v120 wide">
        <input placeholder="اسم الامتحان" value={exam.title} onChange={e=>setExam({...exam,title:e.target.value})}/>
        <input type="date" value={exam.date} onChange={e=>setExam({...exam,date:e.target.value})}/>
        <select value={exam.status} onChange={e=>setExam({...exam,status:e.target.value})}><option value="completed">أدى الامتحان</option><option value="not_done">لم يؤدِ</option></select>
        <input type="number" placeholder="Reading" disabled={exam.status==="not_done"} value={exam.reading} onChange={e=>setExam({...exam,reading:e.target.value})}/>
        <input type="number" placeholder="Writing" disabled={exam.status==="not_done"} value={exam.writing} onChange={e=>setExam({...exam,writing:e.target.value})}/>
        <div className="parent-total-v120">Total: {exam.status==="not_done"?"—":(Number(exam.reading||0)+Number(exam.writing||0))*10}</div>
        <button className="primary" onClick={saveExam}>{exam.id?"حفظ":"إضافة"}</button>{exam.id?<button onClick={()=>setExam(blankExam())}>إلغاء</button>:null}
      </div>
      <DataTable heads={["الامتحان","التاريخ","الحالة","Reading","Writing","Total","الإدارة"]}>{exams.map((e:any)=>{
        const rd=(e.exam_sections||[]).find((x:any)=>String(x.name).toLowerCase().includes("reading"));const wr=(e.exam_sections||[]).find((x:any)=>String(x.name).toLowerCase().includes("writing"));
        return <tr key={e.id}><td>{e.title}</td><td>{e.date||"—"}</td><td><StatusBadge value={e.status||"completed"}/></td><td>{rd?.score??"—"}</td><td>{wr?.score??"—"}</td><td><strong>{e.score??"—"}</strong></td><td><RowActions edit={()=>chooseExam(e)} del={()=>remove("exam",e.id)}/></td></tr>})}</DataTable>
    </section>:null}

    {studentId&&tab==="finance"?<section className="parent-control-panel-v120">
      <EditorTitle title="الموقف المالي" sub="الرصيد والحصص المتبقية والدفعات"/>
      <div className="parent-finance-summary-v120">
        <div><span>الرصيد الحالي</span><strong>{Number(billing?.balance||0).toLocaleString("ar-EG")} {billing?.profile?.currency||"EGP"}</strong></div>
        <div><span>سعر الحصة</span><strong>{Number(billing?.profile?.session_price||0).toLocaleString("ar-EG")}</strong></div>
        <div><span>الحصص المتبقية</span><strong>{Number(billing?.profile?.session_price||0)>0?Math.max(0,Math.floor(Number(billing?.balance||0)/Number(billing?.profile?.session_price||1))):0}</strong></div>
      </div>
      <div className="parent-control-inline-form-v120">
        <input type="number" placeholder="المبلغ" value={payment.amount} onChange={e=>setPayment({...payment,amount:e.target.value})}/>
        <input type="date" value={payment.date} onChange={e=>setPayment({...payment,date:e.target.value})}/>
        <input placeholder="ملاحظة" value={payment.note} onChange={e=>setPayment({...payment,note:e.target.value})}/>
        <button className="primary" onClick={addPayment}>إضافة دفعة</button>
      </div>
      <DataTable heads={["التاريخ","العملية","المبلغ","الملاحظة"]}>{(billing?.transactions||[]).map((x:any)=><tr key={x.id}><td>{x.transaction_date}</td><td>{x.title||x.transaction_type}</td><td className={Number(x.amount)<0?"money-negative-v120":"money-positive-v120"}>{Number(x.amount).toLocaleString("ar-EG")}</td><td>{x.note||"—"}</td></tr>)}</DataTable>
    </section>:null}

    {studentId&&tab==="reports"?<section className="parent-control-panel-v120">
      <EditorTitle title="التقرير الأسبوعي" sub="الملاحظات والخطة وحالة النشر"/>
      <div className="parent-control-form-grid-v120">
        <label><span>اسم الأسبوع</span><input value={report.weekLabel} onChange={e=>setReport({...report,weekLabel:e.target.value})}/></label>
        <label><span>بداية الأسبوع</span><input type="date" value={report.weekStart} onChange={e=>setReport({...report,weekStart:e.target.value})}/></label>
        <label><span>الحالة</span><select value={report.status} onChange={e=>setReport({...report,status:e.target.value})}><option value="draft">مسودة</option><option value="published">منشور لولي الأمر</option></select></label>
        <label className="span-2"><span>ملاحظات المدرس</span><textarea value={report.teacherNote} onChange={e=>setReport({...report,teacherNote:e.target.value})}/></label>
        <label className="span-2"><span>ملاحظات المتابعة</span><textarea value={report.followupNote} onChange={e=>setReport({...report,followupNote:e.target.value})}/></label>
        <label className="span-2"><span>خطة الأسبوع القادم</span><textarea value={report.nextWeekPlan} onChange={e=>setReport({...report,nextWeekPlan:e.target.value})}/></label>
      </div>
      <div className="parent-control-actions-v120"><button className="primary" onClick={saveReport}>{report.id?"حفظ التقرير":"إنشاء التقرير"}</button>{report.id?<button onClick={()=>setReport(blankReport())}>إلغاء</button>:null}</div>
      <DataTable heads={["الأسبوع","الفترة","الحالة","الإدارة"]}>{reports.map((r:any)=><tr key={r.id}><td>{r.week_label}</td><td>{r.week_start} — {r.week_end}</td><td><StatusBadge value={r.status}/></td><td><RowActions edit={()=>chooseReport(r)} del={()=>remove("report",r.id)}/></td></tr>)}</DataTable>
    </section>:null}

    {studentId&&tab==="schedule"?<section className="parent-control-panel-v120">
      <EditorTitle title="المواعيد والتنبيهات" sub="الحصص والواجبات والامتحانات القادمة"/>
      <div className="parent-control-inline-form-v120 wide">
        <select value={event.eventType} onChange={e=>setEvent({...event,eventType:e.target.value})}><option value="class">حصة</option><option value="homework">واجب</option><option value="exam">امتحان</option></select>
        <input placeholder="العنوان" value={event.title} onChange={e=>setEvent({...event,title:e.target.value})}/>
        <input type="datetime-local" value={event.eventAt} onChange={e=>setEvent({...event,eventAt:e.target.value})}/>
        <input placeholder="ملاحظة" value={event.note} onChange={e=>setEvent({...event,note:e.target.value})}/>
        <button className="primary" onClick={saveEvent}>{event.id?"حفظ":"إضافة"}</button>{event.id?<button onClick={()=>setEvent(blankEvent())}>إلغاء</button>:null}
      </div>
      <DataTable heads={["النوع","العنوان","الموعد","الملاحظة","الإدارة"]}>{(data.events||[]).map((e:any)=><tr key={e.id}><td>{e.event_type==="class"?"حصة":e.event_type==="homework"?"واجب":"امتحان"}</td><td>{e.title}</td><td>{formatDateTime(e.event_at)}</td><td>{e.note||"—"}</td><td><RowActions edit={()=>setEvent({id:e.id,eventType:e.event_type,title:e.title,eventAt:String(e.event_at).slice(0,16),note:e.note||"",isActive:e.is_active!==false})} del={()=>remove("event",e.id)}/></td></tr>)}</DataTable>
    </section>:null}

    {tab==="contact"?<section className="parent-control-panel-v120">
      <EditorTitle title="تواصل معنا" sub="هذه البيانات تظهر لكل أولياء الأمور"/>
      <div className="parent-control-form-grid-v120">
        <label><span>العنوان</span><input value={settings.contactTitle} onChange={e=>setSettings({...settings,contactTitle:e.target.value})}/></label>
        <label><span>الوصف</span><input value={settings.contactSubtitle} onChange={e=>setSettings({...settings,contactSubtitle:e.target.value})}/></label>
        <label><span>الهاتف</span><input value={settings.phone} onChange={e=>setSettings({...settings,phone:e.target.value})}/></label>
        <label><span>WhatsApp</span><input value={settings.whatsapp} onChange={e=>setSettings({...settings,whatsapp:e.target.value})}/></label>
        <label><span>البريد الإلكتروني</span><input value={settings.email} onChange={e=>setSettings({...settings,email:e.target.value})}/></label>
        <label><span>العنوان</span><input value={settings.address} onChange={e=>setSettings({...settings,address:e.target.value})}/></label>
        <label><span>التنبيه قبل الموعد بالدقائق</span><input type="number" value={settings.reminderMinutes} onChange={e=>setSettings({...settings,reminderMinutes:Number(e.target.value)})}/></label>
      </div>
      <div className="parent-control-actions-v120"><button className="primary" onClick={saveSettings}>حفظ إعدادات التواصل</button></div>
    </section>:null}
  </main>
}

function EditorTitle({title,sub}:{title:string;sub:string}){return <div className="parent-control-panel-head-v120"><div><span>تحكم مباشر</span><h2>{title}</h2><p>{sub}</p></div></div>}
function RowActions({edit,del}:{edit:()=>void;del:()=>void}){return <div className="parent-row-actions-v120"><button onClick={edit}>تعديل</button><button className="danger" onClick={del}>حذف</button></div>}
function StatusBadge({value}:{value:string}){const labels:any={present:"حاضر",late:"متأخر",absent:"غائب",completed:"تم",partial:"ناقص",not_done:"لم يتم",published:"منشور",draft:"مسودة"};return <span className={`parent-status-v120 ${value}`}>{labels[value]||value}</span>}
function DataTable({heads,children}:{heads:string[];children:any}){return <div className="all-students-table-wrap-v76 parent-table-v120"><table className="all-students-table-v76"><thead><tr>{heads.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>}
