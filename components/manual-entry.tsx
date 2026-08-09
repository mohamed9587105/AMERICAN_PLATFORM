"use client";

import { useEffect, useMemo, useState } from "react";
import {useSearchParams} from "next/navigation";
import UniversalDataImporter, {ImportedStudentData} from "@/components/universal-data-importer";
import StudentAdminTools from "@/components/student-admin-tools";

type AttendanceStatus = "present"|"absent"|"late";
type HomeworkStatus = "completed"|"missing"|"late";

type Student = {
  id:string;
  code:string;
  name:string;
  phone:string;
  course:string;
  parentName:string;
  parentPhone:string;
  parentPassword:string;
  parent2Name:string;
  parent2Phone:string;
  parent2Password:string;
  reportVisible:boolean;
};

type AttendanceRow = { id:string; date:string; status:AttendanceStatus; note:string; };
type HomeworkRow = { id:string; title:string; dueDate:string; score:string; maxScore:string; status:HomeworkStatus; };
type ExamRow = {
  id:string; title:string; date:string; score:string; maxScore:string;
  reading:string; readingMax:string; writing:string; writingMax:string; vocabulary:string; vocabularyMax:string;
};

const uid=()=>Math.random().toString(36).slice(2,9);
const makeCode=(count:number)=>`ST-${String(count+1).padStart(4,"0")}`;
const makePassword=()=>Math.random().toString(36).slice(2,8).toUpperCase();

export default function ManualEntry(){
  const searchParams=useSearchParams();
  const requestedStudentId=searchParams.get("student");
  const requestedEdit=searchParams.get("edit");
  const [courses,setCourses]=useState([
    "SAT",
    "EST",
    "Beginners 1",
    "Beginners 2",
    "Math"
  ]);
  const [showAddCourse,setShowAddCourse]=useState(false);
  const [newCourseName,setNewCourseName]=useState("");
  const [courseFilter,setCourseFilter]=useState("الكل");
  const [showPreview,setShowPreview]=useState(false);
  const [backendMode,setBackendMode]=useState<"checking"|"demo"|"online">("checking");
  const [saveMessage,setSaveMessage]=useState("");
  const [savingParent,setSavingParent]=useState<1|2|0>(0);

  const demoStudents:Student[]=[
    {id:"std_001",code:"ST-0001",name:"محمود أحمد",phone:"01012345678",course:"EST",parentName:"أحمد محمد",parentPhone:"01098765432",parentPassword:"PARENT1",parent2Name:"منى أحمد",parent2Phone:"01111222333",parent2Password:"PARENT1B",reportVisible:true},
    {id:"std_002",code:"ST-0002",name:"سارة أحمد",phone:"01122334455",course:"Beginners 1",parentName:"أحمد محمد",parentPhone:"01098765432",parentPassword:"PARENT2",parent2Name:"منى أحمد",parent2Phone:"01111222333",parent2Password:"PARENT2B",reportVisible:true},
    {id:"std_003",code:"ST-0003",name:"يوسف علي",phone:"01233445566",course:"SAT",parentName:"علي محمود",parentPhone:"01299887766",parentPassword:"PARENT3",parent2Name:"",parent2Phone:"",parent2Password:"",reportVisible:true},
  ];
  const [students,setStudents]=useState<Student[]>([]);

  useEffect(()=>{
    if(!requestedStudentId||!students.length) return;
    const found=students.find(s=>s.id===requestedStudentId);
    if(!found) return;
    setStudentId(found.id);
    if(requestedEdit==="student"){
      setStudentEdit({
        name:found.name,
        phone:found.phone,
        course:found.course,
        parentName:found.parentName,
        parentPhone:found.parentPhone,
        parent2Name:found.parent2Name,
        parent2Phone:found.parent2Phone
      });
      setEditingStudent(true);
    }
  },[requestedStudentId,requestedEdit,students]);

  const demoStudentsKey="parent-admin-students-v38";
useEffect(()=>{
    if(backendMode==="demo"){
      try{
        localStorage.setItem(demoStudentsKey,JSON.stringify(students));
      }catch{}
    }
  },[students,backendMode]);

  const [query,setQuery]=useState("");
  const [studentId,setStudentId]=useState("std_001");
  const [searchFocused,setSearchFocused]=useState(false);
  const [showResults,setShowResults]=useState(false);
  const [showAdd,setShowAdd]=useState(false);
  const [showPassword,setShowPassword]=useState(false);
  const [showPassword2,setShowPassword2]=useState(false);
  const [editingStudent,setEditingStudent]=useState(false);
  const [studentEdit,setStudentEdit]=useState({
    name:"",phone:"",course:"",
    parentName:"",parentPhone:"",
    parent2Name:"",parent2Phone:""
  });

  const [newStudent,setNewStudent]=useState({
    name:"",phone:"",course:"",
    parentName:"",parentPhone:"",parentPassword:"",
    parent2Name:"",parent2Phone:"",parent2Password:""
  });

  const [weekLabel,setWeekLabel]=useState("الأسبوع الحالي");
  const [weekStart,setWeekStart]=useState("2026-08-09");
  const [weekEnd,setWeekEnd]=useState("2026-08-15");
  const [active,setActive]=useState<"attendance"|"homework"|"exams"|"finance"|"notes">("attendance");
  const [published,setPublished]=useState(false);

  const [attendance,setAttendance]=useState<AttendanceRow[]>([
    {id:uid(),date:"2026-08-09",status:"present",note:""},
  ]);
  const [homework,setHomework]=useState<HomeworkRow[]>([
    {id:uid(),title:"Reading Practice",dueDate:"2026-08-10",score:"18",maxScore:"20",status:"completed"},
  ]);
  const [exams,setExams]=useState<ExamRow[]>([
    {id:uid(),title:"Weekly Exam",date:"2026-08-13",score:"42",maxScore:"50",reading:"16",readingMax:"20",writing:"17",writingMax:"20",vocabulary:"9",vocabularyMax:"10"},
  ]);

  const [finance,setFinance]=useState({paid:"0",due:"0",dueDate:"",note:""});
  const [billing,setBilling]=useState<any>(null);
  const [billingLoading,setBillingLoading]=useState(false);
  const [billingForm,setBillingForm]=useState({currency:"EGP",sessionPrice:"0",autoCharge:true,chargeAbsent:false});
  const [paymentForm,setPaymentForm]=useState({amount:"",date:new Date().toISOString().slice(0,10),note:""});
  const [billingMessage,setBillingMessage]=useState("");
  const [notes,setNotes]=useState({teacher:"",followup:"",nextWeek:""});

  const selectedStudent=students.find(s=>s.id===studentId);

  const loadBilling=async(id=studentId)=>{
    if(!id||backendMode!=="online") return;
    setBillingLoading(true);
    try{
      const res=await fetch(`/api/admin/billing?studentId=${encodeURIComponent(id)}`,{cache:"no-store"});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"تعذر تحميل الحساب المالي");
      setBilling(data);
      setBillingForm({
        currency:data.profile?.currency||"EGP",
        sessionPrice:String(data.profile?.session_price??0),
        autoCharge:data.profile?.auto_charge!==false,
        chargeAbsent:Boolean(data.profile?.charge_absent)
      });
    }catch(err:any){
      setBillingMessage(err.message||"تعذر تحميل الحساب المالي");
    }finally{
      setBillingLoading(false);
    }
  };

  useEffect(()=>{
    if(studentId&&backendMode==="online") loadBilling(studentId);
  },[studentId,backendMode]);

  const saveBillingProfile=async()=>{
    if(!studentId) return;
    setBillingMessage("جاري حفظ إعدادات التسعير...");
    try{
      const res=await fetch("/api/admin/billing",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          action:"profile",
          studentId,
          currency:billingForm.currency,
          sessionPrice:Number(billingForm.sessionPrice),
          autoCharge:billingForm.autoCharge,
          chargeAbsent:billingForm.chargeAbsent
        })
      });
      const data=await res.json();
      if(!res.ok) throw new Error(
        data.error==="CANNOT_CHANGE_CURRENCY_WITH_EXISTING_LEDGER"
          ?"لا يمكن تغيير العملة بعد بدء الحركات المالية. اعمل حساب جديد أو تسوية أولًا."
          :data.error==="USD_ONLY_FOR_SAT"
          ?"الدولار متاح لكورس SAT فقط."
          :data.error||"تعذر حفظ التسعير"
      );
      setBilling(data);
      setBillingMessage("تم حفظ التسعير ✓");
    }catch(err:any){
      setBillingMessage(err.message||"تعذر حفظ التسعير");
    }
  };

  const addBillingPayment=async()=>{
    if(!studentId||!paymentForm.amount||Number(paymentForm.amount)<=0){
      setBillingMessage("اكتب مبلغ دفعة صحيح.");
      return;
    }
    setBillingMessage("جاري تسجيل الدفعة...");
    try{
      const res=await fetch("/api/admin/billing",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          action:"payment",
          studentId,
          amount:Number(paymentForm.amount),
          date:paymentForm.date,
          note:paymentForm.note
        })
      });
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"تعذر تسجيل الدفعة");
      setBilling(data);
      setPaymentForm({...paymentForm,amount:"",note:""});
      setBillingMessage("تم تسجيل الدفعة وإضافتها للرصيد ✓");
    }catch(err:any){
      setBillingMessage(err.message||"تعذر تسجيل الدفعة");
    }
  };

  const filteredStudents=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q) return students.slice(0,6);
    return students.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.phone.includes(q) ||
      s.parentPhone.includes(q) ||
      s.parent2Phone.includes(q) ||
      s.code.toLowerCase().includes(q)
    ).slice(0,8);
  },[students,query]);

  const sidebarStudents=useMemo(()=>{
    if(courseFilter==="الكل") return students;
    return students.filter(s=>s.course===courseFilter);
  },[students,courseFilter]);

  const courseCounts=useMemo(()=>{
    const map:Record<string,number>={};
    for(const c of courses) map[c]=students.filter(s=>s.course===c).length;
    return map;
  },[students,courses]);

  useEffect(()=>{
    let active=true;
    fetch("/api/admin/students",{cache:"no-store"})
      .then(async r=>{
        if(!r.ok) throw new Error(`STUDENTS_API_${r.status}`);
        return r.json();
      })
      .then(data=>{
        if(!active) return;
        if(data.mode==="online"){
          setBackendMode("online");
          const mapped=(Array.isArray(data.students)?data.students:[]).map((s:any)=>({
            id:s.id,
            code:s.code,
            name:s.name,
            phone:s.phone||"",
            course:s.courses?.name||s.course?.name||s.course_name||"",
            parentName:s.student_parents?.[0]?.parent_accounts?.name||"",
            parentPhone:s.student_parents?.[0]?.parent_accounts?.phone||"",
            parentPassword:"",
            parent2Name:s.student_parents?.[1]?.parent_accounts?.name||"",
            parent2Phone:s.student_parents?.[1]?.parent_accounts?.phone||"",
            parent2Password:"",
            reportVisible:s.report_visible!==false
          }));
          setStudents(mapped);
          if(mapped.length){
            setStudentId(current=>mapped.some((s:any)=>s.id===current)?current:mapped[0].id);
          }else{
            setStudentId("");
          }
          return;
        }

        setBackendMode("demo");
        try{
          const saved=localStorage.getItem(demoStudentsKey);
          const parsed=saved?JSON.parse(saved):null;
          const fallback=Array.isArray(parsed)&&parsed.length?parsed:demoStudents;
          setStudents(fallback);
          if(fallback.length) setStudentId(current=>fallback.some((s:any)=>s.id===current)?current:fallback[0].id);
        }catch{
          setStudents(demoStudents);
          if(demoStudents.length) setStudentId(demoStudents[0].id);
        }
      })
      .catch(()=>{
        if(!active) return;
        setBackendMode("demo");
        try{
          const saved=localStorage.getItem(demoStudentsKey);
          const parsed=saved?JSON.parse(saved):null;
          const fallback=Array.isArray(parsed)&&parsed.length?parsed:demoStudents;
          setStudents(fallback);
          if(fallback.length) setStudentId(fallback[0].id);
        }catch{
          setStudents(demoStudents);
          if(demoStudents.length) setStudentId(demoStudents[0].id);
        }
      });
    return ()=>{active=false};
  },[]);

  const validationErrors=useMemo(()=>{
    const errors:string[]=[];
    for(const h of homework){
      if(h.score!==""&&h.maxScore!==""){
        const s=Number(h.score),m=Number(h.maxScore);
        if(!Number.isFinite(s)||!Number.isFinite(m)||m<=0||s<0||s>m) errors.push(`درجة الواجب "${h.title||"بدون اسم"}" غير صحيحة`);
      }
    }
    for(const e of exams){
      const s=Number(e.score),m=Number(e.maxScore);
      if(!e.title.trim()) errors.push("يوجد امتحان بدون اسم");
      if(!Number.isFinite(s)||!Number.isFinite(m)||m<=0||s<0||s>m) errors.push(`درجة الامتحان "${e.title||"بدون اسم"}" غير صحيحة`);
    }
    if(!selectedStudent) errors.push("اختر طالبًا");
    return errors;
  },[homework,exams,selectedStudent]);

  const summary=useMemo(()=>{
    const present=attendance.filter(x=>x.status==="present").length;
    const absent=attendance.filter(x=>x.status==="absent").length;
    const late=attendance.filter(x=>x.status==="late").length;
    const hw=homework.filter(x=>Number(x.maxScore)>0);
    const ex=exams.filter(x=>Number(x.maxScore)>0);

    const hwPercent=hw.length?Math.round(hw.reduce((s,x)=>s+(Number(x.score)/Number(x.maxScore))*100,0)/hw.length):0;
    const examPercent=ex.length?Math.round(ex.reduce((s,x)=>s+(Number(x.score)/Number(x.maxScore))*100,0)/ex.length):0;
    const attendancePercent=attendance.length?Math.round((present/attendance.length)*100):0;
    return {present,absent,late,hwPercent,examPercent,attendancePercent};
  },[attendance,homework,exams]);

  const pickStudent=(id:string)=>{
    setStudentId(id);
    const s=students.find(x=>x.id===id);
    setQuery("");
    setShowResults(false);
    setSearchFocused(false);
    setShowResults(false);
    setPublished(false);
    if(s){
      setStudentEdit({
        name:s.name,
        phone:s.phone,
        course:s.course,
        parentName:s.parentName,
        parentPhone:s.parentPhone,
        parent2Name:s.parent2Name,
        parent2Phone:s.parent2Phone
      });
    }
    setEditingStudent(false);
  };

  const addStudent=async()=>{
    if(!newStudent.name.trim() || !newStudent.parentPhone.trim() || !newStudent.course.trim()){
      alert("اكتب اسم الطالب ورقم هاتف ولي الأمر واختر الكورس.");
      return;
    }

    const code=makeCode(students.length);
    const password=newStudent.parentPassword.trim() || makePassword();
    const password2=newStudent.parent2Phone.trim()
      ? (newStudent.parent2Password.trim() || makePassword())
      : "";

    const student:Student={
      id:uid(),
      code,
      name:newStudent.name.trim(),
      phone:newStudent.phone.trim(),
      course:newStudent.course.trim(),
      parentName:newStudent.parentName.trim()||"ولي الأمر",
      parentPhone:newStudent.parentPhone.trim(),
      parentPassword:password,
      parent2Name:newStudent.parent2Name.trim(),
      parent2Phone:newStudent.parent2Phone.trim(),
      parent2Password:password2,
      reportVisible:true
    };

    try{
      if(backendMode==="online"){
        const res=await fetch("/api/admin/students",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify(student)
        });
        const data=await res.json();
        if(!res.ok) throw new Error(data.error||"تعذر حفظ الطالب");
        if(data.student?.id) student.id=data.student.id;
      }

      setStudents(v=>[...v,student]);

      if(backendMode!=="online"){
        try{
          const next=[...students,student];
          localStorage.setItem(demoStudentsKey,JSON.stringify(next));
        }catch{}
      }

      setStudentId(student.id);
      setQuery(student.name);
      setNewStudent({
        name:"",phone:"",course:"",
        parentName:"",parentPhone:"",parentPassword:"",
        parent2Name:"",parent2Phone:"",parent2Password:""
      });
      setShowAdd(false);

      alert(
        `تمت إضافة الطالب وحفظه بنجاح.\n`+
        `الكود: ${code}\n`+
        `باسورد ولي الأمر الأول: ${password}`+
        (password2?`\nباسورد ولي الأمر الثاني: ${password2}`:"")
      );
    }catch(err:any){
      alert(err.message||"تعذر حفظ الطالب");
    }
  };

  const saveStudentEdit=async()=>{
    const current=students.find(s=>s.id===studentId);
    if(!current) return;

    const updated={
      ...current,
      name:studentEdit.name.trim()||current.name,
      phone:studentEdit.phone.trim(),
      course:studentEdit.course,
      parentName:studentEdit.parentName.trim()||current.parentName,
      parentPhone:studentEdit.parentPhone.trim()||current.parentPhone,
      parent2Name:studentEdit.parent2Name.trim(),
      parent2Phone:studentEdit.parent2Phone.trim()
    };

    try{
      if(backendMode==="online"){
        const res=await fetch("/api/admin/students",{
          method:"PATCH",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            id:studentId,
            name:updated.name,
            phone:updated.phone,
            course:updated.course,
            reportVisible:updated.reportVisible,
            parent1:{
              name:updated.parentName,
              phone:updated.parentPhone
            },
            parent2:updated.parent2Phone?{
              name:updated.parent2Name||"ولي الأمر الثاني",
              phone:updated.parent2Phone
            }:undefined
          })
        });
        if(!res.ok) throw new Error("تعذر حفظ تعديل الطالب");
      }

      setStudents(v=>v.map(s=>s.id===studentId?updated:s));
      if(backendMode!=="online"){
        try{
          localStorage.setItem(
            demoStudentsKey,
            JSON.stringify(students.map(s=>s.id===studentId?updated:s))
          );
        }catch{}
      }
      setEditingStudent(false);
    }catch(err:any){
      alert(err.message||"تعذر حفظ تعديل الطالب");
    }
  };

  const deleteStudent=async()=>{
    const s=students.find(x=>x.id===studentId);
    if(!s) return;
    if(!confirm(`هل أنت متأكد من حذف الطالب ${s.name}؟`)) return;

    try{
      if(backendMode==="online"){
        const res=await fetch(`/api/admin/students?id=${encodeURIComponent(studentId)}`,{
          method:"DELETE"
        });
        if(!res.ok) throw new Error("تعذر حذف الطالب");
      }

      const remaining=students.filter(x=>x.id!==studentId);
      setStudents(remaining);

      if(backendMode!=="online"){
        try{
          localStorage.setItem(demoStudentsKey,JSON.stringify(remaining));
        }catch{}
      }

      setStudentId(remaining[0]?.id||"");
      if(remaining[0]){
        setStudentEdit({
          name:remaining[0].name,
          phone:remaining[0].phone,
          course:remaining[0].course,
          parentName:remaining[0].parentName,
          parentPhone:remaining[0].parentPhone,
          parent2Name:remaining[0].parent2Name,
          parent2Phone:remaining[0].parent2Phone
        });
      }
    }catch(err:any){
      alert(err.message||"تعذر حذف الطالب");
    }
  };

  const toggleReportVisibility=async()=>{
    const current=students.find(s=>s.id===studentId);
    if(!current) return;
    const next=!current.reportVisible;

    try{
      if(backendMode==="online"){
        const res=await fetch("/api/admin/students",{
          method:"PATCH",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({id:studentId,reportVisible:next})
        });
        if(!res.ok) throw new Error("تعذر تحديث ظهور التقرير");
      }

      const updated=students.map(s=>s.id===studentId?{...s,reportVisible:next}:s);
      setStudents(updated);

      if(backendMode!=="online"){
        try{localStorage.setItem(demoStudentsKey,JSON.stringify(updated))}catch{}
      }
    }catch(err:any){
      alert(err.message||"تعذر تحديث ظهور التقرير");
    }
  };

  const updateStudentPassword=(value:string)=>{
    const updated=students.map(s=>s.id===studentId?{...s,parentPassword:value}:s);
    setStudents(updated);
    if(backendMode!=="online"){
      try{localStorage.setItem(demoStudentsKey,JSON.stringify(updated))}catch{}
    }
  };

  const updateStudentPassword2=(value:string)=>{
    const updated=students.map(s=>s.id===studentId?{...s,parent2Password:value}:s);
    setStudents(updated);
    if(backendMode!=="online"){
      try{localStorage.setItem(demoStudentsKey,JSON.stringify(updated))}catch{}
    }
  };

  const saveParentPassword=async(order:1|2)=>{
    const current=students.find(s=>s.id===studentId);
    if(!current) return;

    const password=(order===1?current.parentPassword:current.parent2Password).trim();
    const phone=(order===1?current.parentPhone:current.parent2Phone).trim();
    const name=(order===1?current.parentName:current.parent2Name).trim();

    if(!phone){
      alert(order===1?"اكتب رقم ولي الأمر الأول أولًا.":"أضف ولي الأمر الثاني أولًا.");
      return;
    }
    if(password.length<6){
      alert("اكتب باسورد لا يقل عن 6 أحرف أو أرقام.");
      return;
    }

    if(backendMode!=="online"){
      alert("تم حفظ الباسورد في نسخة العرض.");
      return;
    }

    setSavingParent(order);
    try{
      const payload:any={id:studentId};
      payload[order===1?"parent1":"parent2"]={
        name:name||`ولي الأمر ${order===1?"الأول":"الثاني"}`,
        phone,
        password
      };

      const res=await fetch("/api/admin/students",{
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload)
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error||"تعذر حفظ باسورد ولي الأمر");

      alert(`تم حفظ باسورد ولي الأمر ${order===1?"الأول":"الثاني"} في Supabase بنجاح.`);
    }catch(err:any){
      alert(err.message||"تعذر حفظ الباسورد");
    }finally{
      setSavingParent(0);
    }
  };

  const addCourse=()=>{
    const name=newCourseName.trim();
    if(!name) return;
    if(courses.some(c=>c.toLowerCase()===name.toLowerCase())){
      alert("الكورس موجود بالفعل.");
      return;
    }
    setCourses(v=>[...v,name]);
    setNewCourseName("");
    setShowAddCourse(false);
  };

  const updateAttendance=(id:string,key:keyof AttendanceRow,value:string)=>{
    setAttendance(rows=>rows.map(r=>r.id===id?{...r,[key]:value}:r) as AttendanceRow[]);
  };
  const updateHomework=(id:string,key:keyof HomeworkRow,value:string)=>{
    setHomework(rows=>rows.map(r=>r.id===id?{...r,[key]:value}:r) as HomeworkRow[]);
  };
  const updateExam=(id:string,key:keyof ExamRow,value:string)=>{
    setExams(rows=>rows.map(r=>r.id===id?{...r,[key]:value}:r));
  };

  const importStoreKey="parent-app-imported-student-data-v45";

  const mergeImportedData=(studentIdToApply:string,data:ImportedStudentData)=>{
    if(studentIdToApply!==studentId) return;

    if(data.attendance.length){
      setAttendance(prev=>{
        const next=[...prev];
        for(const a of data.attendance){
          const idx=next.findIndex(x=>x.date===a.date);
          const row={id:idx>=0?next[idx].id:uid(),date:a.date,status:a.status,note:a.note};
          if(idx>=0) next[idx]=row; else next.push(row);
        }
        return next;
      });
    }

    if(data.homework.length){
      setHomework(prev=>{
        const next=[...prev];
        for(const h of data.homework){
          const idx=next.findIndex(x=>normalizeImportKey(x.title)===normalizeImportKey(h.title));
          const row={id:idx>=0?next[idx].id:uid(),...h};
          if(idx>=0) next[idx]=row; else next.push(row);
        }
        return next;
      });
    }

    if(data.exams.length){
      setExams(prev=>{
        const next=[...prev];
        for(const e of data.exams){
          const idx=next.findIndex(x=>normalizeImportKey(x.title)===normalizeImportKey(e.title)&&x.date===e.date);
          const row={id:idx>=0?next[idx].id:uid(),...e};
          if(idx>=0) next[idx]=row; else next.push(row);
        }
        return next;
      });
    }

    if(data.finance.length){
      const last=data.finance[data.finance.length-1];
      setFinance({paid:last.paid,due:last.due,dueDate:last.dueDate,note:last.note});
    }
  };

  const normalizeImportKey=(v:string)=>v.toLowerCase().trim().replace(/\s+/g," ");

  const applyImportedBatch=async(batch:ImportedStudentData[])=>{
    setSaveMessage("");

    if(backendMode==="online"){
      const res=await fetch("/api/admin/import",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({weekLabel,weekStart,weekEnd,batch})
      });
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"تعذر حفظ البيانات المستوردة");
      for(const item of batch) mergeImportedData(item.studentId,item);
      const importedCount=(data.results||[]).length;
      const errorCount=(data.errors||[]).length;
      setSaveMessage(`تم حفظ الاستيراد Online لـ ${importedCount} طالب كمسودة${errorCount?` · ${errorCount} ملاحظات`:""}. راجع التقارير ثم انشرها.`);
      return;
    }

    let store:Record<string,ImportedStudentData>={};
    try{store=JSON.parse(localStorage.getItem(importStoreKey)||"{}")}catch{}
    for(const item of batch){
      const old=store[item.studentId]||{studentId:item.studentId,attendance:[],homework:[],exams:[],finance:[]};
      store[item.studentId]={
        studentId:item.studentId,
        attendance:[...old.attendance,...item.attendance],
        homework:[...old.homework,...item.homework],
        exams:[...old.exams,...item.exams],
        finance:[...old.finance,...item.finance]
      };
      mergeImportedData(item.studentId,item);
    }
    try{localStorage.setItem(importStoreKey,JSON.stringify(store))}catch{}
    setSaveMessage(`تم حفظ الاستيراد محليًا لـ ${batch.length} طالب. اربط Supabase للحفظ على كل الأجهزة.`);
  };

  useEffect(()=>{
    try{
      const store=JSON.parse(localStorage.getItem(importStoreKey)||"{}");
      const data=store[studentId] as ImportedStudentData|undefined;
      if(data) mergeImportedData(studentId,data);
    }catch{}
  },[studentId]);

  const addImportedStudentsLocal=(rows:any[])=>{
    const existingCodes=new Set(students.map(s=>s.code));
    const created:Student[]=rows.map((r:any,i:number)=>{
      let code=(r.code||"").trim()||makeCode(students.length+i);
      while(existingCodes.has(code)) code=`${code}-${i+1}`;
      existingCodes.add(code);
      return {
        id:uid(),code,name:r.name,phone:r.phone||"",course:r.course,
        parentName:r.parentName||"ولي الأمر",parentPhone:r.parentPhone||"",parentPassword:r.parentPassword||makePassword(),
        parent2Name:r.parent2Name||"",parent2Phone:r.parent2Phone||"",parent2Password:r.parent2Phone?(r.parent2Password||makePassword()):"",
        reportVisible:true
      };
    });
    const next=[...students,...created];
    setStudents(next);
    try{localStorage.setItem(demoStudentsKey,JSON.stringify(next))}catch{}
    if(created[0]) setStudentId(created[0].id);
  };

  const saveDraft=()=>{
    setPublished(false);
    alert("تم حفظ المسودة في نسخة العرض.");
  };

  const publish=async()=>{
    setSaveMessage("");
    if(validationErrors.length){
      alert(validationErrors.join("\n"));
      return;
    }
    try{
      const res=await fetch("/api/admin/reports",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          studentId,
          weekLabel,weekStart,weekEnd,
          attendance,homework,exams,finance,notes
        })
      });
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"تعذر نشر التقرير");
      setPublished(true);
      setSaveMessage(data.mode==="demo"
        ?"تم التحقق من التقرير بنجاح. قاعدة البيانات غير مربوطة بعد، لذلك لم يُحفظ Online."
        :"تم حفظ التقرير ونشره لولي الأمر.");
    }catch(err:any){
      alert(err.message||"تعذر نشر التقرير");
    }
  };

  return <div className="manual-entry-shell manual-v28">
    <header className="manual-topbar manual-topbar-v28">
      <div>
        <span>لوحة الإدارة</span>
        <h1>تقرير الطالب الأسبوعي</h1>
        <p>ابحث عن الطالب، أدخل بيانات الأسبوع، ثم اضغط نشر.</p>
      </div>
      <div className="manual-header-actions-v36">
        <span className={`backend-mode-v36 ${backendMode}`}>{backendMode==="online"?"Online DB":backendMode==="demo"?"Demo Mode":"Checking..."}</span>
        <a href="/admin/reports" className="reports-main-btn-v39 admin-highlight-3d-v74">سجل تقارير الطلاب</a>
        <a href="/parent-login" className="ghost-btn admin-highlight-3d-v74">تجربة دخول ولي الأمر</a>
        <a href="/" className="ghost-btn admin-highlight-3d-v74">عرض تطبيق ولي الأمر</a>
      </div>
    </header>

    <StudentAdminTools
      students={students}
      backendMode={backendMode}
      onLocalImported={addImportedStudentsLocal}
    />

    <section className="student-search-box-v28">
      <div className="student-search-main-v28">
        <label>ابحث عن الطالب</label>
        <div className="search-input-wrap-v28">
          <span>⌕</span>
          <input
            value={query}
            autoComplete="off"
            onFocus={()=>{
              setSearchFocused(true);
              setShowResults(Boolean(query.trim()));
            }}
            onBlur={()=>setTimeout(()=>{
              setSearchFocused(false);
              setShowResults(false);
            },150)}
            onChange={e=>{
              const value=e.target.value;
              setQuery(value);
              setShowResults(Boolean(value.trim()));
            }}
            placeholder="اسم الطالب أو رقم التليفون أو الكود"
          />
          {query?<button type="button" onClick={()=>{setQuery("");setShowResults(false)}}>×</button>:null}
        </div>

        {searchFocused && showResults && query.trim()?<div className="student-results-v28">
          {filteredStudents.length?filteredStudents.map(s=><button type="button" key={s.id} onClick={()=>pickStudent(s.id)}>
            <div className="student-result-avatar-v28">{s.name.slice(0,1)}</div>
            <div>
              <strong>{s.name}</strong>
              <span>{s.code} · {s.phone||s.parentPhone}</span>
              <small>{s.course}</small>
            </div>
          </button>):<div className="empty-search-v28">لا يوجد طالب مطابق للبحث.</div>}
        </div>:null}
      </div>
      <button type="button" className="add-student-btn-v28" onClick={()=>setShowAdd(true)}>+ إضافة طالب جديد</button>
    </section>

    <div className="student-admin-layout-v30">
      <aside className="student-sidebar-v30 premium-student-sidebar-v77">
        <div className="student-sidebar-head-v30">
          <div><span>الطلبة</span><h2>كل الطلبة</h2></div>
          <b>{students.length}</b>
        </div>
        <div className="course-filter-v36">
          <select value={courseFilter} onChange={e=>setCourseFilter(e.target.value)}>
            <option value="الكل">كل الكورسات — {students.length}</option>
            {courses.map(c=><option key={c} value={c}>{c} — {courseCounts[c]||0}</option>)}
          </select>
          <div className="course-counts-v36">
            {courses.map(c=><span key={c}>{c}<b>{courseCounts[c]||0}</b></span>)}
          </div>
        </div>
        {backendMode==="checking"?<div className="students-loading-v49">جاري تحميل الطلبة من قاعدة البيانات...</div>:null}
        {backendMode==="online" && students.length===0?<div className="students-empty-v49">لا يوجد طلبة مسجلون حتى الآن.</div>:null}
        <div className="student-sidebar-list-v30 student-sidebar-list-v73">
          {sidebarStudents.map(s=><div key={s.id} className={`student-side-row-v73 ${s.id===studentId?"active":""}`}>
            <button type="button" className="student-side-main-v73" onClick={()=>pickStudent(s.id)}>
              <span className="student-side-code-v30">{s.code}</span>
              <div>
                <strong>{s.name}</strong>
                <small>{s.course}</small>
                <small>📱 {s.phone||"بدون رقم طالب"}</small>
                <small>👤 {s.parentName} · {s.parentPhone}</small>
                <small>{s.reportVisible?"التقرير ظاهر لولي الأمر":"التقرير موقوف"}</small>
              </div>
              <i className={s.reportVisible?"visible":"hidden"}>{s.reportVisible?"●":"×"}</i>
            </button>

            <a
              href={`/admin/finance?student=${encodeURIComponent(s.id)}`}
              className="student-finance-row-btn-v73"
            >
              الحساب المالي
            </a>
          </div>)}
        </div>
      </aside>

      <div className="student-admin-main-v30">
    {selectedStudent?<section className="student-control-card-v30">
      <div className="student-control-top-v30">
        <div className="selected-avatar-v28">{selectedStudent.name.slice(0,1)}</div>
        <div className="student-control-identity-v30">
          <span>ملف الطالب</span>
          <strong>{selectedStudent.name}</strong>
          <small>{selectedStudent.code} · {selectedStudent.course}</small>
        </div>
        <div className={`report-visibility-v30 ${selectedStudent.reportVisible?"on":"off"}`}>
          <span>ظهور التقرير لولي الأمر</span>
          <strong>{selectedStudent.reportVisible?"مسموح":"موقوف"}</strong>
          <button type="button" onClick={toggleReportVisibility}>{selectedStudent.reportVisible?"إيقاف الظهور":"تفعيل الظهور"}</button>
        </div>
      </div>

      <div className="student-details-grid-v30">
        <div><span>تليفون الطالب</span><strong>{selectedStudent.phone||"—"}</strong></div>
        <div><span>الكورس</span><strong>{selectedStudent.course}</strong></div>
        <div><span>ولي الأمر الأول</span><strong>{selectedStudent.parentName}</strong><small>{selectedStudent.parentPhone}</small></div>
        <div><span>ولي الأمر الثاني</span><strong>{selectedStudent.parent2Name||"غير مضاف"}</strong><small>{selectedStudent.parent2Phone||"—"}</small></div>
      </div>

      <div className="two-parent-passwords-v32">
        <div className="parent-password-v28 parent-password-v30">
          <label>باسورد ولي الأمر الأول</label>
          <div>
            <input type={showPassword?"text":"password"} value={selectedStudent.parentPassword} onChange={e=>updateStudentPassword(e.target.value)}/>
            <button type="button" onClick={()=>setShowPassword(v=>!v)}>{showPassword?"إخفاء":"إظهار"}</button>
            <button type="button" onClick={()=>updateStudentPassword(makePassword())}>توليد</button>
            <button type="button" className="save-parent-pass-v50" disabled={savingParent===1} onClick={()=>saveParentPassword(1)}>{savingParent===1?"حفظ...":"حفظ الباسورد"}</button>
          </div>
        </div>

        <div className="parent-password-v28 parent-password-v30">
          <label>باسورد ولي الأمر الثاني</label>
          <div>
            <input
              type={showPassword2?"text":"password"}
              value={selectedStudent.parent2Password}
              disabled={!selectedStudent.parent2Phone}
              placeholder={selectedStudent.parent2Phone?"باسورد ولي الأمر الثاني":"أضف ولي أمر ثانٍ أولًا"}
              onChange={e=>updateStudentPassword2(e.target.value)}
            />
            <button type="button" disabled={!selectedStudent.parent2Phone} onClick={()=>setShowPassword2(v=>!v)}>{showPassword2?"إخفاء":"إظهار"}</button>
            <button type="button" disabled={!selectedStudent.parent2Phone} onClick={()=>updateStudentPassword2(makePassword())}>توليد</button>
            <button type="button" className="save-parent-pass-v50" disabled={!selectedStudent.parent2Phone||savingParent===2} onClick={()=>saveParentPassword(2)}>{savingParent===2?"حفظ...":"حفظ الباسورد"}</button>
          </div>
        </div>
      </div>

      {!editingStudent?<div className="student-control-actions-v30">
        <a href={`/admin/reports?student=${encodeURIComponent(selectedStudent.id)}`} className="student-reports-link-v39">عرض كل تقارير الطالب</a>
        <button type="button" className="edit-student-v30" onClick={()=>setEditingStudent(true)}>تعديل بيانات الطالب</button>
        <button type="button" className="delete-student-v30" onClick={deleteStudent}>حذف الطالب</button>
      </div>:<div className="student-edit-panel-v30">
        <div className="field"><label>اسم الطالب</label><input value={studentEdit.name} onChange={e=>setStudentEdit({...studentEdit,name:e.target.value})}/></div>
        <div className="field"><label>تليفون الطالب</label><input value={studentEdit.phone} onChange={e=>setStudentEdit({...studentEdit,phone:e.target.value})}/></div>
        <div className="field">
          <label>الكورس</label>
          <div className="course-select-row-v32">
            <select value={studentEdit.course} onChange={e=>setStudentEdit({...studentEdit,course:e.target.value})}>{courses.map(c=><option key={c} value={c}>{c}</option>)}</select>
            <button type="button" onClick={()=>setShowAddCourse(true)}>+ إضافة</button>
          </div>
        </div>
        <div className="field parent-group-title-v32"><strong>ولي الأمر الأول</strong></div>
        <div className="field"><label>اسم ولي الأمر الأول</label><input value={studentEdit.parentName} onChange={e=>setStudentEdit({...studentEdit,parentName:e.target.value})}/></div>
        <div className="field"><label>تليفون ولي الأمر الأول</label><input value={studentEdit.parentPhone} onChange={e=>setStudentEdit({...studentEdit,parentPhone:e.target.value})}/></div>

        <div className="field parent-group-title-v32"><strong>ولي الأمر الثاني (اختياري)</strong></div>
        <div className="field"><label>اسم ولي الأمر الثاني</label><input value={studentEdit.parent2Name} onChange={e=>setStudentEdit({...studentEdit,parent2Name:e.target.value})}/></div>
        <div className="field"><label>تليفون ولي الأمر الثاني</label><input value={studentEdit.parent2Phone} onChange={e=>setStudentEdit({...studentEdit,parent2Phone:e.target.value})}/></div>
        <div className="student-edit-actions-v30">
          <button type="button" className="ghost-btn" onClick={()=>setEditingStudent(false)}>إلغاء</button>
          <button type="button" className="primary-btn" onClick={saveStudentEdit}>حفظ التعديلات</button>
        </div>
      </div>}
    </section>:null}

    <section className="week-bar-v28">
      <div className="field"><label>اسم الأسبوع</label><input value={weekLabel} onChange={e=>setWeekLabel(e.target.value)}/></div>
      <div className="field"><label>من</label><input type="date" value={weekStart} onChange={e=>setWeekStart(e.target.value)}/></div>
      <div className="field"><label>إلى</label><input type="date" value={weekEnd} onChange={e=>setWeekEnd(e.target.value)}/></div>
      <div className={`publish-status ${published?"done":""}`}><span>{published?"منشور":"مسودة"}</span><strong>{published?"تم الإرسال لولي الأمر":"لم يتم النشر بعد"}</strong></div>
    </section>

    <section className="manual-summary-grid manual-summary-grid-v28">
      <article><span>الحضور</span><strong>{summary.attendancePercent}%</strong><small>{summary.present} حاضر · {summary.absent} غياب · {summary.late} تأخير</small></article>
      <article><span>الواجبات</span><strong>{summary.hwPercent}%</strong><small>يُحسب تلقائيًا</small></article>
      <article><span>الامتحانات</span><strong>{summary.examPercent}%</strong><small>من الدرجات الفعلية</small></article>
    </section>

    <UniversalDataImporter
      students={students.map(s=>({id:s.id,code:s.code,name:s.name,phone:s.phone,parentPhone:s.parentPhone}))}
      onApply={applyImportedBatch}
    />

    <section className="big-section-buttons-v28">
      <button className={active==="attendance"?"active green":""} onClick={()=>setActive("attendance")}><i>✓</i><strong>الحضور</strong><span>حاضر / غائب / متأخر</span></button>
      <button className={active==="homework"?"active gold":""} onClick={()=>setActive("homework")}><i>☑</i><strong>الواجبات</strong><span>الدرجة والحالة</span></button>
      <button className={active==="exams"?"active blue":""} onClick={()=>setActive("exams")}><i>▤</i><strong>الامتحانات</strong><span>الدرجة الفعلية</span></button>
      <button className={active==="finance"?"active purple":""} onClick={()=>setActive("finance")}><i>ج</i><strong>المالية</strong><span>المدفوع والمستحق</span></button>
      <button className={active==="notes"?"active orange":""} onClick={()=>setActive("notes")}><i>✎</i><strong>الملاحظات</strong><span>المدرس والمتابعة</span></button>
    </section>

    <main className={`simple-entry-panel-v28 panel-${active}-v28`}>
      {active==="attendance" && <section>
        <div className="panel-head panel-head-v28">
          <div><span>الحضور</span><h2>تسجيل الحصص</h2></div>
          <button onClick={()=>setAttendance(v=>[...v,{id:uid(),date:weekStart,status:"present",note:""}])}>+ إضافة حصة</button>
        </div>
        <div className="simple-rows-v28">
          {attendance.map((r,index)=><article key={r.id}>
            <b>حصة {index+1}</b>
            <input type="date" value={r.date} onChange={e=>updateAttendance(r.id,"date",e.target.value)}/>
            <select value={r.status} onChange={e=>updateAttendance(r.id,"status",e.target.value)}>
              <option value="present">حاضر</option><option value="absent">غائب</option><option value="late">متأخر</option>
            </select>
            <input placeholder="ملاحظة اختيارية" value={r.note} onChange={e=>updateAttendance(r.id,"note",e.target.value)}/>
            <button className="danger-link" onClick={()=>setAttendance(v=>v.filter(x=>x.id!==r.id))}>حذف</button>
          </article>)}
        </div>
      </section>}

      {active==="homework" && <section>
        <div className="panel-head panel-head-v28">
          <div><span>الواجبات</span><h2>إدخال الواجبات</h2></div>
          <button onClick={()=>setHomework(v=>[...v,{id:uid(),title:"",dueDate:weekEnd,score:"",maxScore:"",status:"completed"}])}>+ إضافة واجب</button>
        </div>
        <div className="simple-rows-v28">
          {homework.map((r,index)=><article className="homework-row-v28" key={r.id}>
            <b>واجب {index+1}</b>
            <input value={r.title} onChange={e=>updateHomework(r.id,"title",e.target.value)} placeholder="اسم الواجب"/>
            <input type="date" value={r.dueDate} onChange={e=>updateHomework(r.id,"dueDate",e.target.value)}/>
            <div className="score-pair score-pair-big-v28"><input type="number" value={r.score} onChange={e=>updateHomework(r.id,"score",e.target.value)} placeholder="18"/><span>من</span><input type="number" value={r.maxScore} onChange={e=>updateHomework(r.id,"maxScore",e.target.value)} placeholder="20"/></div>
            <select value={r.status} onChange={e=>updateHomework(r.id,"status",e.target.value)}>
              <option value="completed">تم التسليم</option><option value="late">متأخر</option><option value="missing">لم يُسلّم</option>
            </select>
            <button className="danger-link" onClick={()=>setHomework(v=>v.filter(x=>x.id!==r.id))}>حذف</button>
          </article>)}
        </div>
      </section>}

      {active==="exams" && <section>
        <div className="panel-head panel-head-v28">
          <div><span>الامتحانات</span><h2>إدخال الدرجة الفعلية</h2></div>
          <button onClick={()=>setExams(v=>[...v,{id:uid(),title:"",date:weekEnd,score:"",maxScore:"",reading:"",readingMax:"",writing:"",writingMax:"",vocabulary:"",vocabularyMax:""}])}>+ إضافة امتحان</button>
        </div>
        <div className="exam-entry-list">
          {exams.map((r,index)=><article className="exam-entry-card exam-entry-card-v28" key={r.id}>
            <div className="exam-card-title-v28"><strong>امتحان {index+1}</strong><button className="danger-link" onClick={()=>setExams(v=>v.filter(x=>x.id!==r.id))}>حذف</button></div>
            <div className="exam-entry-top exam-entry-top-v28">
              <div className="field"><label>اسم الامتحان</label><input value={r.title} onChange={e=>updateExam(r.id,"title",e.target.value)} placeholder="Weekly Exam"/></div>
              <div className="field"><label>التاريخ</label><input type="date" value={r.date} onChange={e=>updateExam(r.id,"date",e.target.value)}/></div>
              <div className="field"><label>الدرجة</label><div className="score-pair score-pair-big-v28"><input type="number" value={r.score} onChange={e=>updateExam(r.id,"score",e.target.value)} placeholder="42"/><span>من</span><input type="number" value={r.maxScore} onChange={e=>updateExam(r.id,"maxScore",e.target.value)} placeholder="50"/></div></div>
            </div>
            <details className="exam-sections-toggle-v28">
              <summary>إضافة درجات Reading / Writing / Vocabulary</summary>
              <div className="exam-sections-entry exam-sections-entry-v28">
                <div><label>Reading</label><div className="score-pair score-pair-big-v28"><input type="number" value={r.reading} onChange={e=>updateExam(r.id,"reading",e.target.value)}/><span>من</span><input type="number" value={r.readingMax} onChange={e=>updateExam(r.id,"readingMax",e.target.value)}/></div></div>
                <div><label>Writing</label><div className="score-pair score-pair-big-v28"><input type="number" value={r.writing} onChange={e=>updateExam(r.id,"writing",e.target.value)}/><span>من</span><input type="number" value={r.writingMax} onChange={e=>updateExam(r.id,"writingMax",e.target.value)}/></div></div>
                <div><label>Vocabulary</label><div className="score-pair score-pair-big-v28"><input type="number" value={r.vocabulary} onChange={e=>updateExam(r.id,"vocabulary",e.target.value)}/><span>من</span><input type="number" value={r.vocabularyMax} onChange={e=>updateExam(r.id,"vocabularyMax",e.target.value)}/></div></div>
              </div>
            </details>
          </article>)}
        </div>
      </section>}

      {active==="finance" && <section>
        <div className="panel-head panel-head-v28"><div><span>المالية</span><h2>تلقائي من الحضور والدفعات</h2></div></div>
        <div className="finance-auto-info-v69">
          <strong>مش محتاج تكتب المدفوع أو المستحق داخل التقرير.</strong>
          <p>سجل دفعات الطالب من ملفه بالأعلى. عند نشر التقرير، كل يوم حضور أو تأخير يُخصم تلقائيًا بسعر الحصة. الغياب لا يُحسب إلا إذا فعلت خيار «احتساب الغياب كحصة».</p>
          <div>
            <span>الرصيد الحالي</span>
            <b className={billing&&Number(billing.balance)<0?"negative":""}>
              {billing?`${Number(billing.balance||0).toLocaleString("ar-EG")} ${billing.profile?.currency}`:"—"}
            </b>
          </div>
        </div>
        <div className="finance-entry-grid finance-entry-grid-v28">
          <div className="field"><label>تاريخ استحقاق اختياري</label><input type="date" value={finance.dueDate} onChange={e=>setFinance({...finance,dueDate:e.target.value})}/></div>
        </div>
      </section>}

      {active==="notes" && <section>
        <div className="panel-head panel-head-v28"><div><span>الملاحظات</span><h2>ملاحظات التقرير</h2></div></div>
        <div className="notes-grid notes-grid-v28">
          <div className="field"><label>ملاحظة المدرس</label><textarea value={notes.teacher} onChange={e=>setNotes({...notes,teacher:e.target.value})}/></div>
          <div className="field"><label>ملاحظة المتابعة</label><textarea value={notes.followup} onChange={e=>setNotes({...notes,followup:e.target.value})}/></div>
          <div className="field"><label>خطة الأسبوع القادم</label><textarea value={notes.nextWeek} onChange={e=>setNotes({...notes,nextWeek:e.target.value})}/></div>
        </div>
      </section>}
    </main>

    <footer className="big-save-footer-v28 big-save-footer-v36">
      <div className="publish-validation-v36">
        <span className={validationErrors.length?"bad":"good"}>{validationErrors.length?`${validationErrors.length} ملاحظات قبل النشر`:"جاهز للنشر ✓"}</span>
        {saveMessage?<small>{saveMessage}</small>:null}
      </div>
      <button onClick={()=>setShowPreview(true)} className="ghost-btn preview-btn-v36">معاينة التقرير</button>
      <button onClick={saveDraft} className="ghost-btn big-draft-v28">حفظ كمسودة</button>
      <button onClick={publish} className="primary-btn big-publish-v28">حفظ ونشر التقرير لولي الأمر</button>
    </footer>

      </div>
    </div>

    {showPreview?<div className="student-modal-backdrop-v28 preview-backdrop-v36">
      <section className="report-preview-v36">
        <div className="student-modal-head-v28">
          <div><span>قبل النشر</span><h2>معاينة تقرير {selectedStudent?.name}</h2></div>
          <button onClick={()=>setShowPreview(false)}>×</button>
        </div>
        <div className="preview-kpis-v36">
          <article><span>الحضور</span><strong>{summary.attendancePercent}%</strong></article>
          <article><span>الواجبات</span><strong>{summary.hwPercent}%</strong></article>
          <article><span>الامتحانات</span><strong>{summary.examPercent}%</strong></article>
        </div>
        <div className="preview-section-v36"><h3>الامتحانات</h3>{exams.map(x=><div key={x.id}><span>{x.title}</span><strong>{x.score} / {x.maxScore}</strong></div>)}</div>
        <div className="preview-section-v36"><h3>الواجبات</h3>{homework.map(x=><div key={x.id}><span>{x.title}</span><strong>{x.score||"—"} / {x.maxScore||"—"}</strong></div>)}</div>
        <div className="preview-section-v36"><h3>ملاحظات المتابعة</h3><p>{notes.followup||"لا توجد ملاحظات"}</p></div>
        {validationErrors.length?<div className="preview-errors-v36">{validationErrors.map((e,i)=><span key={i}>{e}</span>)}</div>:null}
        <div className="student-modal-footer-v28">
          <button className="ghost-btn" onClick={()=>setShowPreview(false)}>رجوع للتعديل</button>
          <button className="primary-btn" disabled={Boolean(validationErrors.length)} onClick={()=>{setShowPreview(false);publish()}}>نشر الآن</button>
        </div>
      </section>
    </div>:null}

    {showAdd?<div className="student-modal-backdrop-v28">
      <section className="student-modal-v28">
        <div className="student-modal-head-v28">
          <div><span>طالب جديد</span><h2>إضافة طالب وولي أمر</h2></div>
          <button onClick={()=>setShowAdd(false)}>×</button>
        </div>
        <div className="student-form-grid-v28">
          <div className="field"><label>اسم الطالب *</label><input value={newStudent.name} onChange={e=>setNewStudent({...newStudent,name:e.target.value})}/></div>
          <div className="field"><label>رقم تليفون الطالب</label><input value={newStudent.phone} onChange={e=>setNewStudent({...newStudent,phone:e.target.value})}/></div>
          <div className="field field-wide">
            <label>الكورس *</label>
            <div className="course-select-row-v32">
              <select value={newStudent.course} onChange={e=>setNewStudent({...newStudent,course:e.target.value})}>
                <option value="">اختر الكورس</option>
                {courses.map(course=><option key={course} value={course}>{course}</option>)}
              </select>
              <button type="button" onClick={()=>setShowAddCourse(true)}>+ إضافة كورس</button>
            </div>
          </div>
          <div className="parent-section-v32 field-wide"><strong>ولي الأمر الأول</strong></div>
          <div className="field"><label>اسم ولي الأمر الأول</label><input value={newStudent.parentName} onChange={e=>setNewStudent({...newStudent,parentName:e.target.value})}/></div>
          <div className="field"><label>رقم تليفون ولي الأمر الأول *</label><input value={newStudent.parentPhone} onChange={e=>setNewStudent({...newStudent,parentPhone:e.target.value})}/></div>
          <div className="field field-wide"><label>باسورد ولي الأمر الأول</label>
            <div className="password-create-row-v28">
              <input value={newStudent.parentPassword} onChange={e=>setNewStudent({...newStudent,parentPassword:e.target.value})} placeholder="سيتم توليده تلقائيًا لو تركته فارغًا"/>
              <button type="button" onClick={()=>setNewStudent({...newStudent,parentPassword:makePassword()})}>توليد باسورد</button>
            </div>
          </div>

          <div className="parent-section-v32 field-wide"><strong>ولي الأمر الثاني — اختياري</strong></div>
          <div className="field"><label>اسم ولي الأمر الثاني</label><input value={newStudent.parent2Name} onChange={e=>setNewStudent({...newStudent,parent2Name:e.target.value})}/></div>
          <div className="field"><label>رقم تليفون ولي الأمر الثاني</label><input value={newStudent.parent2Phone} onChange={e=>setNewStudent({...newStudent,parent2Phone:e.target.value})}/></div>
          <div className="field field-wide"><label>باسورد ولي الأمر الثاني</label>
            <div className="password-create-row-v28">
              <input value={newStudent.parent2Password} onChange={e=>setNewStudent({...newStudent,parent2Password:e.target.value})} placeholder="اختياري — يتولد تلقائيًا عند إضافة رقم التليفون"/>
              <button type="button" onClick={()=>setNewStudent({...newStudent,parent2Password:makePassword()})}>توليد باسورد</button>
            </div>
          </div>
        </div>
        <div className="student-modal-footer-v28">
          <button className="ghost-btn" onClick={()=>setShowAdd(false)}>إلغاء</button>
          <button className="primary-btn" onClick={addStudent}>إضافة الطالب</button>
        </div>
      </section>
    </div>:null}

    {showAddCourse?<div className="student-modal-backdrop-v28 course-modal-backdrop-v32">
      <section className="course-modal-v32">
        <div className="student-modal-head-v28">
          <div><span>إدارة الكورسات</span><h2>إضافة كورس جديد</h2></div>
          <button onClick={()=>setShowAddCourse(false)}>×</button>
        </div>
        <div className="field">
          <label>اسم الكورس</label>
          <input autoFocus value={newCourseName} onChange={e=>setNewCourseName(e.target.value)} placeholder="مثال: ACT أو Math Advanced"/>
        </div>
        <div className="existing-courses-v32">
          {courses.map(c=><span key={c}>{c}</span>)}
        </div>
        <div className="student-modal-footer-v28">
          <button className="ghost-btn" onClick={()=>setShowAddCourse(false)}>إلغاء</button>
          <button className="primary-btn" onClick={addCourse}>إضافة الكورس</button>
        </div>
      </section>
    </div>:null}
  </div>
}
