"use client";
import {useEffect,useMemo,useState} from "react";
import {createPortal} from "react-dom";
import StudentAdminTools from "@/components/student-admin-tools";

type Student={
  id:string;code:string;name:string;phone:string;course:string;
  parentName:string;parentPhone:string;reportVisible:boolean;
};

const uid=()=>Math.random().toString(36).slice(2,9);
const asArray=(v:any)=>Array.isArray(v)?v:(v?[v]:[]);

export default function AllStudentsManager(){
  const [students,setStudents]=useState<Student[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [query,setQuery]=useState("");
  const [course,setCourse]=useState("all");

  const [mounted,setMounted]=useState(false);
  const [modal,setModal]=useState<null|"data"|"report"|"finance">(null);
  const [selected,setSelected]=useState<Student|null>(null);
  const [modalBusy,setModalBusy]=useState(false);
  const [modalMessage,setModalMessage]=useState("");

  const [dataForm,setDataForm]=useState({
    name:"",phone:"",course:"",parentName:"",parentPhone:"",parentPassword:"",reportVisible:true
  });

  const [reports,setReports]=useState<any[]>([]);
  const [selectedReportId,setSelectedReportId]=useState("");
  const [reportForm,setReportForm]=useState<any>(null);

  const [billing,setBilling]=useState<any>(null);
  const [billingForm,setBillingForm]=useState({
    currency:"EGP",sessionPrice:"0",autoCharge:true,chargeAbsent:false
  });
  const [paymentForm,setPaymentForm]=useState({
    amount:"",date:new Date().toISOString().slice(0,10),note:""
  });

  const load=async()=>{
    setLoading(true);setError("");
    try{
      const res=await fetch("/api/admin/all-students",{cache:"no-store"});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"تعذر تحميل الطلاب");
      setStudents(data.students||[]);
    }catch(err:any){
      setError(err.message||"تعذر تحميل الطلاب");
    }finally{setLoading(false)}
  };

  useEffect(()=>{load()},[]);
  useEffect(()=>{setMounted(true)},[]);
  useEffect(()=>{
    if(!mounted) return;
    const previous=document.body.style.overflow;
    if(modal) document.body.style.overflow="hidden";
    else document.body.style.overflow=previous||"";
    return ()=>{document.body.style.overflow=previous||""};
  },[modal,mounted]);

  const courses=useMemo(
    ()=>Array.from(new Set(students.map(s=>s.course).filter(Boolean))).sort(),
    [students]
  );

  const filtered=useMemo(()=>students.filter(s=>{
    const q=query.trim().toLowerCase();
    const hit=!q||
      s.name.toLowerCase().includes(q)||
      s.code.toLowerCase().includes(q)||
      s.phone.toLowerCase().includes(q)||
      s.parentName.toLowerCase().includes(q)||
      s.parentPhone.toLowerCase().includes(q);
    return hit&&(course==="all"||s.course===course);
  }),[students,query,course]);

  const closeModal=()=>{
    if(modalBusy) return;
    setModal(null);setSelected(null);setModalMessage("");
    setReports([]);setSelectedReportId("");setReportForm(null);setBilling(null);
  };

  const openData=async(s:Student)=>{
    setSelected(s);setModal("data");setModalMessage("");setModalBusy(true);
    try{
      const res=await fetch("/api/admin/students",{cache:"no-store"});
      const data=await res.json();
      const raw=(data.students||[]).find((x:any)=>x.id===s.id);
      const links=asArray(raw?.student_parents);
      const p1=[...links].sort((a:any,b:any)=>Number(a.relation_order||0)-Number(b.relation_order||0))[0]?.parent_accounts;
      setDataForm({
        name:raw?.name||s.name,
        phone:raw?.phone||s.phone,
        course:raw?.course_name||s.course,
        parentName:p1?.name||s.parentName,
        parentPhone:p1?.phone||s.parentPhone,
        parentPassword:"",
        reportVisible:raw?.report_visible!==false
      });
    }catch{
      setDataForm({
        name:s.name,phone:s.phone,course:s.course,
        parentName:s.parentName,parentPhone:s.parentPhone,parentPassword:"",reportVisible:s.reportVisible
      });
    }finally{setModalBusy(false)}
  };

  const saveData=async()=>{
    if(!selected) return;
    setModalBusy(true);setModalMessage("جاري حفظ البيانات...");
    try{
      const res=await fetch("/api/admin/students",{
        method:"PATCH",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          id:selected.id,
          name:dataForm.name,phone:dataForm.phone,course:dataForm.course,
          reportVisible:dataForm.reportVisible,
          parent1:{
            name:dataForm.parentName,
            phone:dataForm.parentPhone,
            password:dataForm.parentPassword.trim()||undefined
          }
        })
      });
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"تعذر حفظ البيانات");

      const instant:Student={
        ...selected,
        name:dataForm.name,
        phone:dataForm.phone,
        course:dataForm.course,
        parentName:dataForm.parentName,
        parentPhone:dataForm.parentPhone,
        reportVisible:dataForm.reportVisible
      };
      setStudents(prev=>prev.map(x=>x.id===selected.id?instant:x));
      setSelected(instant);
      setDataForm(prev=>({...prev,parentPassword:""}));
      setModalMessage("تم حفظ البيانات وتحديث الكارت ✓");
      await load();
    }catch(err:any){setModalMessage(err.message||"تعذر حفظ البيانات")}
    finally{setModalBusy(false)}
  };

  const normalizeReport=(r:any)=>({
    id:r.id,weekLabel:r.week_label||"",weekStart:r.week_start||"",weekEnd:r.week_end||"",
    teacher:r.teacher_note||"",followup:r.followup_note||"",nextWeek:r.next_week_plan||"",
    attendance:asArray(r.attendance_entries).map((a:any)=>({
      id:a.id||uid(),date:a.date||"",status:a.status||"present",note:a.note||""
    })),
    homework:asArray(r.homework_entries).map((h:any)=>({
      id:h.id||uid(),title:h.title||"",dueDate:h.due_date||"",
      score:h.score==null?"":String(h.score),maxScore:h.max_score==null?"":String(h.max_score),
      status:h.status||"completed"
    })),
    exams:asArray(r.exam_entries).map((e:any)=>{
      const sections=asArray(e.exam_sections);
      const find=(name:string)=>sections.find((s:any)=>String(s.name||"").toLowerCase().includes(name));
      const rd=find("reading"),wr=find("writing"),vo=find("vocabulary");
      return {
        id:e.id||uid(),title:e.title||"",date:e.date||"",
        score:e.score==null?"":String(e.score),maxScore:e.max_score==null?"":String(e.max_score),
        reading:rd?.score==null?"":String(rd.score),readingMax:rd?.max_score==null?"":String(rd.max_score),
        writing:wr?.score==null?"":String(wr.score),writingMax:wr?.max_score==null?"":String(wr.max_score),
        vocabulary:vo?.score==null?"":String(vo.score),vocabularyMax:vo?.max_score==null?"":String(vo.max_score)
      };
    })
  });

  const openReport=async(s:Student)=>{
    setSelected(s);setModal("report");setModalMessage("");setModalBusy(true);
    try{
      const res=await fetch(`/api/admin/reports/manage?studentId=${encodeURIComponent(s.id)}`,{cache:"no-store"});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"تعذر تحميل التقارير");
      const rows=data.reports||[];
      setReports(rows);
      if(rows[0]){
        setSelectedReportId(rows[0].id);
        setReportForm(normalizeReport(rows[0]));
      }else{
        setSelectedReportId("");
        setReportForm({
          id:null,weekLabel:"الأسبوع الحالي",
          weekStart:new Date().toISOString().slice(0,10),weekEnd:new Date().toISOString().slice(0,10),
          teacher:"",followup:"",nextWeek:"",
          attendance:[],homework:[],exams:[]
        });
      }
    }catch(err:any){setModalMessage(err.message||"تعذر تحميل التقارير")}
    finally{setModalBusy(false)}
  };

  const selectReport=(id:string)=>{
    setSelectedReportId(id);
    const r=reports.find(x=>x.id===id);
    if(r) setReportForm(normalizeReport(r));
  };

  const saveReport=async()=>{
    if(!selected||!reportForm) return;
    setModalBusy(true);setModalMessage("جاري حفظ التقرير...");
    try{
      const res=await fetch("/api/admin/reports",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          studentId:selected.id,
          reportId:reportForm.id||undefined,
          weekLabel:reportForm.weekLabel,weekStart:reportForm.weekStart,weekEnd:reportForm.weekEnd,
          attendance:reportForm.attendance,
          homework:reportForm.homework,
          exams:reportForm.exams,
          finance:{dueDate:""},
          notes:{teacher:reportForm.teacher,followup:reportForm.followup,nextWeek:reportForm.nextWeek}
        })
      });
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"تعذر حفظ التقرير");
      setModalMessage("تم حفظ التقرير وتحديثه ✓");
      await openReport(selected);
      setModalMessage("تم حفظ التقرير وتحديثه ✓");
    }catch(err:any){setModalMessage(err.message||"تعذر حفظ التقرير")}
    finally{setModalBusy(false)}
  };

  const openFinance=async(s:Student)=>{
    setSelected(s);setModal("finance");setModalMessage("");setModalBusy(true);
    try{
      const res=await fetch(`/api/admin/billing?studentId=${encodeURIComponent(s.id)}`,{cache:"no-store"});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"تعذر تحميل الحساب");
      setBilling(data);
      setBillingForm({
        currency:data.profile?.currency||"EGP",
        sessionPrice:String(data.profile?.session_price??0),
        autoCharge:data.profile?.auto_charge!==false,
        chargeAbsent:Boolean(data.profile?.charge_absent)
      });
    }catch(err:any){setModalMessage(err.message||"تعذر تحميل الحساب")}
    finally{setModalBusy(false)}
  };

  const refreshBilling=async()=>{
    if(!selected) return;
    const res=await fetch(`/api/admin/billing?studentId=${encodeURIComponent(selected.id)}`,{cache:"no-store"});
    const data=await res.json();
    if(res.ok) setBilling(data);
  };

  const saveBilling=async()=>{
    if(!selected) return;
    setModalBusy(true);setModalMessage("جاري حفظ الحساب...");
    try{
      const res=await fetch("/api/admin/billing",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          action:"profile",studentId:selected.id,
          currency:billingForm.currency,sessionPrice:Number(billingForm.sessionPrice),
          autoCharge:billingForm.autoCharge,chargeAbsent:billingForm.chargeAbsent
        })
      });
      const data=await res.json();
      if(!res.ok) throw new Error(data.error==="CANNOT_CHANGE_CURRENCY_WITH_EXISTING_LEDGER"?"لا يمكن تغيير العملة بعد وجود حركات مالية.":data.error||"تعذر حفظ الحساب");
      setBilling(data);setModalMessage("تم حفظ إعدادات الحساب ✓");
    }catch(err:any){setModalMessage(err.message||"تعذر حفظ الحساب")}
    finally{setModalBusy(false)}
  };

  const addPayment=async()=>{
    if(!selected||Number(paymentForm.amount)<=0) return setModalMessage("اكتب مبلغ دفعة صحيح.");
    setModalBusy(true);setModalMessage("جاري تسجيل الدفعة...");
    try{
      const res=await fetch("/api/admin/billing",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          action:"payment",studentId:selected.id,amount:Number(paymentForm.amount),
          date:paymentForm.date,note:paymentForm.note
        })
      });
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"تعذر تسجيل الدفعة");
      setBilling(data);setPaymentForm({amount:"",date:new Date().toISOString().slice(0,10),note:""});
      setModalMessage("تم تسجيل الدفعة ✓");
    }catch(err:any){setModalMessage(err.message||"تعذر تسجيل الدفعة")}
    finally{setModalBusy(false)}
  };

  return <main className="all-students-page-v76" dir="rtl">
    <section className="all-students-hero-v76">
      <div><span>إدارة الطلاب</span><h1>كل الطلاب</h1><p>تعديل سريع من نفس الصفحة بدون تنقل.</p></div>
      <div className="all-students-count-v76"><strong>{filtered.length}</strong><span>طالب</span></div>
    </section>

    <StudentAdminTools
      students={students.map(s=>({...s,parent2Name:"",parent2Phone:""}))}
      backendMode="online"
      studentPageOnly
    />

    <section className="all-students-toolbar-v76">
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="بحث بالاسم أو الكود أو الموبايل أو ولي الأمر"/>
      <select value={course} onChange={e=>setCourse(e.target.value)}>
        <option value="all">كل الكورسات</option>
        {courses.map(c=><option key={c} value={c}>{c}</option>)}
      </select>
      <button onClick={load} disabled={loading}>{loading?"جاري التحديث...":"تحديث"}</button>
    </section>

    {error?<div className="all-students-error-v76">{error}</div>:null}

    <section className="all-students-table-wrap-v76">
      <table className="all-students-table-v76">
        <thead><tr><th>الطالب</th><th>الكود</th><th>الكورس</th><th>موبايل الطالب</th><th>ولي الأمر</th><th>موبايل ولي الأمر</th><th>حالة التقرير</th><th>الإدارة</th></tr></thead>
        <tbody>{filtered.map(s=><tr key={s.id}>
          <td><strong>{s.name}</strong></td><td>{s.code}</td><td>{s.course||"—"}</td><td>{s.phone||"—"}</td>
          <td>{s.parentName||"—"}</td><td>{s.parentPhone||"—"}</td>
          <td><span className={`report-status-v76 ${s.reportVisible?"visible":"hidden"}`}>{s.reportVisible?"ظاهر":"موقوف"}</span></td>
          <td><div className="student-management-actions-v76">
            <button className="edit-data" onClick={()=>openData(s)}>تعديل البيانات</button>
            <button className="edit-report" onClick={()=>openReport(s)}>تعديل التقرير</button>
            <button className="edit-finance" onClick={()=>openFinance(s)}>تعديل الحسابات</button>
          </div></td>
        </tr>)}</tbody>
      </table>
      {!loading&&!filtered.length?<div className="all-students-empty-v76">لا يوجد طلاب مطابقون للبحث.</div>:null}
    </section>

    {mounted && modal && selected
      ? createPortal(
          <div className="student-modal-backdrop-v80" onMouseDown={e=>{if(e.target===e.currentTarget)closeModal()}}>
      <section className={`student-edit-modal-v80 ${modal}`}>
        <header className="student-modal-head-v80">
          <div>
            <span>{modal==="data"?"بيانات الطالب":modal==="report"?"التقرير الأسبوعي":"الحساب المالي"}</span>
            <h2>{selected.name}</h2>
            <p>{selected.code} · {selected.course}</p>
          </div>
          <button onClick={closeModal}>×</button>
        </header>

        {modal==="data"?<div className="student-modal-body-v80 student-data-premium-v85">
          <section className="student-data-section-v85">
            <div className="student-data-section-title-v85">
              <div>
                <span>الطالب</span>
                <h3>بيانات الطالب الأساسية</h3>
              </div>
              <b>01</b>
            </div>

            <div className="modal-form-grid-v80 student-data-grid-v85">
              <label>
                <span>اسم الطالب</span>
                <input value={dataForm.name} onChange={e=>setDataForm({...dataForm,name:e.target.value})}/>
              </label>

              <label>
                <span>موبايل الطالب</span>
                <input inputMode="tel" value={dataForm.phone} onChange={e=>setDataForm({...dataForm,phone:e.target.value})}/>
              </label>

              <label className="wide">
                <span>الكورس</span>
                <select value={dataForm.course} onChange={e=>setDataForm({...dataForm,course:e.target.value})}>
                  {courses.map(c=><option key={c}>{c}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className="student-data-section-v85 parent">
            <div className="student-data-section-title-v85">
              <div>
                <span>ولي الأمر</span>
                <h3>بيانات الدخول والتواصل</h3>
              </div>
              <b>02</b>
            </div>

            <div className="modal-form-grid-v80 student-data-grid-v85">
              <label>
                <span>اسم ولي الأمر</span>
                <input value={dataForm.parentName} onChange={e=>setDataForm({...dataForm,parentName:e.target.value})}/>
              </label>

              <label>
                <span>موبايل ولي الأمر</span>
                <input inputMode="tel" value={dataForm.parentPhone} onChange={e=>setDataForm({...dataForm,parentPhone:e.target.value})}/>
              </label>

              <label className="wide">
                <span>باسورد جديد لولي الأمر <small>اختياري</small></span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={dataForm.parentPassword}
                  onChange={e=>setDataForm({...dataForm,parentPassword:e.target.value})}
                  placeholder="اتركه فارغًا لو مش عايز تغيّر الباسورد"
                />
              </label>
            </div>
          </section>

          <section className="student-data-section-v85 settings">
            <div className="student-data-section-title-v85">
              <div>
                <span>التقرير</span>
                <h3>إعدادات ظهور التقرير</h3>
              </div>
              <b>03</b>
            </div>

            <label className="student-report-toggle-v85">
              <div>
                <strong>إظهار التقرير لولي الأمر</strong>
                <small>لو أوقفت الخيار، ولي الأمر مش هيشوف تقارير الطالب في التطبيق.</small>
              </div>
              <input
                type="checkbox"
                checked={dataForm.reportVisible}
                onChange={e=>setDataForm({...dataForm,reportVisible:e.target.checked})}
              />
              <i></i>
            </label>
          </section>

          <div className="student-data-savebar-v85">
            <button type="button" className="secondary" onClick={closeModal} disabled={modalBusy}>إلغاء</button>
            <button type="button" className="primary" onClick={saveData} disabled={modalBusy}>
              {modalBusy?"جاري الحفظ...":"حفظ كل التعديلات"}
            </button>
          </div>
        </div>:null}

        {modal==="report"?<div className="student-modal-body-v80">
          <div className="report-picker-v80">
            <label><span>الأسبوع</span><select value={selectedReportId} onChange={e=>selectReport(e.target.value)}>
              {reports.map(r=><option key={r.id} value={r.id}>{r.week_label} — {r.week_start}</option>)}
              {!reports.length?<option value="">تقرير جديد</option>:null}
            </select></label>
          </div>

          {reportForm?<>
            <div className="modal-form-grid-v80 three">
              <label><span>اسم الأسبوع</span><input value={reportForm.weekLabel} onChange={e=>setReportForm({...reportForm,weekLabel:e.target.value})}/></label>
              <label><span>من</span><input type="date" value={reportForm.weekStart} onChange={e=>setReportForm({...reportForm,weekStart:e.target.value})}/></label>
              <label><span>إلى</span><input type="date" value={reportForm.weekEnd} onChange={e=>setReportForm({...reportForm,weekEnd:e.target.value})}/></label>
            </div>

            <div className="modal-report-section-v80">
              <div className="modal-section-head-v80"><h3>الحضور</h3><button onClick={()=>setReportForm({...reportForm,attendance:[...reportForm.attendance,{id:uid(),date:reportForm.weekStart,status:"present",note:""}]})}>+ يوم</button></div>
              {reportForm.attendance.map((a:any,i:number)=><div className="report-row-v80 attendance" key={a.id}>
                <input type="date" value={a.date} onChange={e=>{const x=[...reportForm.attendance];x[i]={...a,date:e.target.value};setReportForm({...reportForm,attendance:x})}}/>
                <select value={a.status} onChange={e=>{const x=[...reportForm.attendance];x[i]={...a,status:e.target.value};setReportForm({...reportForm,attendance:x})}}>
                  <option value="present">حاضر</option><option value="absent">غائب</option><option value="late">متأخر</option>
                </select>
                <input placeholder="ملاحظة" value={a.note} onChange={e=>{const x=[...reportForm.attendance];x[i]={...a,note:e.target.value};setReportForm({...reportForm,attendance:x})}}/>
                <button className="remove" onClick={()=>setReportForm({...reportForm,attendance:reportForm.attendance.filter((_:any,j:number)=>j!==i)})}>×</button>
              </div>)}
            </div>

            <div className="modal-report-section-v80">
              <div className="modal-section-head-v80"><h3>الواجبات</h3><button onClick={()=>setReportForm({...reportForm,homework:[...reportForm.homework,{id:uid(),title:"",dueDate:"",score:"",maxScore:"",status:"completed"}]})}>+ واجب</button></div>
              {reportForm.homework.map((h:any,i:number)=><div className="report-row-v80 homework" key={h.id}>
                <input placeholder="اسم الواجب" value={h.title} onChange={e=>{const x=[...reportForm.homework];x[i]={...h,title:e.target.value};setReportForm({...reportForm,homework:x})}}/>
                <input type="date" value={h.dueDate} onChange={e=>{const x=[...reportForm.homework];x[i]={...h,dueDate:e.target.value};setReportForm({...reportForm,homework:x})}}/>
                <input type="number" placeholder="الدرجة" value={h.score} onChange={e=>{const x=[...reportForm.homework];x[i]={...h,score:e.target.value};setReportForm({...reportForm,homework:x})}}/>
                <input type="number" placeholder="من" value={h.maxScore} onChange={e=>{const x=[...reportForm.homework];x[i]={...h,maxScore:e.target.value};setReportForm({...reportForm,homework:x})}}/>
                <select value={h.status} onChange={e=>{const x=[...reportForm.homework];x[i]={...h,status:e.target.value};setReportForm({...reportForm,homework:x})}}>
                  <option value="completed">تم</option><option value="late">متأخر</option><option value="missing">لم يسلم</option>
                </select>
                <button className="remove" onClick={()=>setReportForm({...reportForm,homework:reportForm.homework.filter((_:any,j:number)=>j!==i)})}>×</button>
              </div>)}
            </div>

            <div className="modal-report-section-v80">
              <div className="modal-section-head-v80"><h3>الامتحانات</h3><button onClick={()=>setReportForm({...reportForm,exams:[...reportForm.exams,{id:uid(),title:"",date:"",score:"",maxScore:"800",reading:"",readingMax:"400",writing:"",writingMax:"400",vocabulary:"",vocabularyMax:""}]})}>+ امتحان</button></div>
              {reportForm.exams.map((e:any,i:number)=><div className="exam-editor-v80" key={e.id}>
                <div className="report-row-v80 exam">
                  <input placeholder="اسم الامتحان" value={e.title} onChange={x=>{const a=[...reportForm.exams];a[i]={...e,title:x.target.value};setReportForm({...reportForm,exams:a})}}/>
                  <input type="date" value={e.date} onChange={x=>{const a=[...reportForm.exams];a[i]={...e,date:x.target.value};setReportForm({...reportForm,exams:a})}}/>
                  <input type="number" placeholder="Total" value={e.score} onChange={x=>{const a=[...reportForm.exams];a[i]={...e,score:x.target.value};setReportForm({...reportForm,exams:a})}}/>
                  <input type="number" placeholder="من" value={e.maxScore} onChange={x=>{const a=[...reportForm.exams];a[i]={...e,maxScore:x.target.value};setReportForm({...reportForm,exams:a})}}/>
                  <button className="remove" onClick={()=>setReportForm({...reportForm,exams:reportForm.exams.filter((_:any,j:number)=>j!==i)})}>×</button>
                </div>
                <div className="exam-sections-editor-v80">
                  <label>Reading <input type="number" value={e.reading} onChange={x=>{const a=[...reportForm.exams];a[i]={...e,reading:x.target.value};setReportForm({...reportForm,exams:a})}}/><input type="number" value={e.readingMax} onChange={x=>{const a=[...reportForm.exams];a[i]={...e,readingMax:x.target.value};setReportForm({...reportForm,exams:a})}}/></label>
                  <label>Writing <input type="number" value={e.writing} onChange={x=>{const a=[...reportForm.exams];a[i]={...e,writing:x.target.value};setReportForm({...reportForm,exams:a})}}/><input type="number" value={e.writingMax} onChange={x=>{const a=[...reportForm.exams];a[i]={...e,writingMax:x.target.value};setReportForm({...reportForm,exams:a})}}/></label>
                  <label>Vocabulary <input type="number" value={e.vocabulary} onChange={x=>{const a=[...reportForm.exams];a[i]={...e,vocabulary:x.target.value};setReportForm({...reportForm,exams:a})}}/><input type="number" value={e.vocabularyMax} onChange={x=>{const a=[...reportForm.exams];a[i]={...e,vocabularyMax:x.target.value};setReportForm({...reportForm,exams:a})}}/></label>
                </div>
              </div>)}
            </div>

            <div className="modal-form-grid-v80">
              <label><span>ملاحظة المدرس</span><textarea value={reportForm.teacher} onChange={e=>setReportForm({...reportForm,teacher:e.target.value})}/></label>
              <label><span>ملاحظة المتابعة</span><textarea value={reportForm.followup} onChange={e=>setReportForm({...reportForm,followup:e.target.value})}/></label>
              <label className="wide"><span>خطة الأسبوع القادم</span><textarea value={reportForm.nextWeek} onChange={e=>setReportForm({...reportForm,nextWeek:e.target.value})}/></label>
            </div>
            <button className="modal-save-v80" onClick={saveReport} disabled={modalBusy}>حفظ التقرير</button>
          </>:null}
        </div>:null}

        {modal==="finance"?<div className="student-modal-body-v80">
          <section className="finance-balance-inline-v80">
            <span>الرصيد الحالي</span>
            <strong className={Number(billing?.balance||0)<0?"negative":"positive"}>{Number(billing?.balance||0).toLocaleString("ar-EG")} {billing?.profile?.currency||billingForm.currency}</strong>
          </section>

          <div className="modal-form-grid-v80">
            <label><span>العملة</span><select value={billingForm.currency} onChange={e=>setBillingForm({...billingForm,currency:e.target.value})}>
              <option value="EGP">جنيه EGP</option>{selected.course.toLowerCase().includes("sat")?<option value="USD">دولار USD</option>:null}
            </select></label>
            <label><span>سعر الحصة</span><input type="number" value={billingForm.sessionPrice} onChange={e=>setBillingForm({...billingForm,sessionPrice:e.target.value})}/></label>
            <label className="modal-check-v80"><input type="checkbox" checked={billingForm.autoCharge} onChange={e=>setBillingForm({...billingForm,autoCharge:e.target.checked})}/><span>خصم تلقائي</span></label>
            <label className="modal-check-v80"><input type="checkbox" checked={billingForm.chargeAbsent} onChange={e=>setBillingForm({...billingForm,chargeAbsent:e.target.checked})}/><span>احتساب الغياب</span></label>
          </div>
          <button className="modal-save-v80" onClick={saveBilling} disabled={modalBusy}>حفظ الحساب</button>

          <section className="inline-payment-v80">
            <h3>إضافة دفعة</h3>
            <div className="modal-form-grid-v80 three">
              <label><span>المبلغ</span><input type="number" value={paymentForm.amount} onChange={e=>setPaymentForm({...paymentForm,amount:e.target.value})}/></label>
              <label><span>التاريخ</span><input type="date" value={paymentForm.date} onChange={e=>setPaymentForm({...paymentForm,date:e.target.value})}/></label>
              <label><span>ملاحظة</span><input value={paymentForm.note} onChange={e=>setPaymentForm({...paymentForm,note:e.target.value})}/></label>
            </div>
            <button className="modal-payment-v80" onClick={addPayment} disabled={modalBusy}>+ تسجيل الدفعة</button>
          </section>

          <section className="inline-ledger-v80">
            <h3>آخر الحركات</h3>
            {asArray(billing?.transactions).slice(0,10).map((t:any)=><article key={t.id}>
              <div><strong>{t.title}</strong><small>{t.transaction_date}{t.note?` · ${t.note}`:""}</small></div>
              <b className={Number(t.amount)>=0?"credit":"debit"}>{Number(t.amount)>0?"+":""}{Number(t.amount).toLocaleString("ar-EG")} {t.currency}</b>
            </article>)}
          </section>
        </div>:null}

        {modalMessage?<div className="student-modal-message-v80">{modalMessage}</div>:null}
      </section>
    </div>,
          document.body
        )
      : null}
  </main>;
}
