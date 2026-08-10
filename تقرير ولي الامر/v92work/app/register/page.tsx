"use client";

import {useState} from "react";

const courses=["SAT","EST","Beginners 1","Beginners 2","Math"];

export default function RegistrationPage(){
  const [form,setForm]=useState({
    name:"",phone:"",course:"",
    parentName:"",parentPhone:"",parentPassword:"",
    parent2Name:"",parent2Phone:"",parent2Password:"",
    website:""
  });
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState<any>(null);
  const [error,setError]=useState("");

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();setLoading(true);setError("");setResult(null);
    try{
      const res=await fetch("/api/public/register",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)
      });
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"تعذر إرسال البيانات");
      setResult(data);
    }catch(err:any){setError(err.message||"تعذر إرسال البيانات")}
    finally{setLoading(false)}
  };

  if(result) return <main className="public-register-v47">
    <section className="register-success-v47">
      <div className="register-check-v47">✓</div>
      <span>تم تسجيل البيانات</span>
      <h1>أهلًا بك</h1>
      <p>تم إضافة بيانات الطالب إلى النظام بنجاح.</p>
      <div className="register-code-v47"><small>كود الطالب</small><strong>{result.studentCode}</strong></div>
      {(result.credentials||[]).map((c:any)=><div className="register-credential-v47" key={c.relation}>
        <strong>ولي الأمر {c.relation===1?"الأول":"الثاني"}</strong>
        <span>كود ولي الأمر: <b>{c.parentCode}</b></span>
        <span>رقم الدخول: <b>{c.phone}</b></span>
        {c.password?<span>الباسورد المؤقت: <b>{c.password}</b></span>:<span>الحساب موجود بالفعل بنفس الرقم.</span>}
      </div>)}
      <p className="register-save-note-v47">احتفظ بالكود وبيانات الدخول.</p>
    </section>
  </main>;

  return <main className="public-register-v47">
    <form className="public-register-card-v47" onSubmit={submit}>
      <div className="register-brand-v47"><span>Student Registration</span><h1>بيانات حجز الطالب</h1><p>املأ البيانات مرة واحدة وسيتم تسجيلها مباشرة لدى الإدارة.</p></div>

      <section className="register-section-v47">
        <h2>بيانات الطالب</h2>
        <div className="register-grid-v47">
          <label>اسم الطالب بالكامل *<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
          <label>رقم تليفون الطالب<input inputMode="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
          <label className="wide">الكورس *<select required value={form.course} onChange={e=>setForm({...form,course:e.target.value})}><option value="">اختر الكورس</option>{courses.map(c=><option key={c}>{c}</option>)}</select></label>
        </div>
      </section>

      <section className="register-section-v47">
        <h2>ولي الأمر الأول</h2>
        <div className="register-grid-v47">
          <label>اسم ولي الأمر *<input required value={form.parentName} onChange={e=>setForm({...form,parentName:e.target.value})}/></label>
          <label>رقم تليفون ولي الأمر *<input required inputMode="tel" value={form.parentPhone} onChange={e=>setForm({...form,parentPhone:e.target.value})}/></label>
          <label className="wide">اختيار باسورد لولي الأمر <input type="password" value={form.parentPassword} onChange={e=>setForm({...form,parentPassword:e.target.value})} placeholder="اتركه فارغًا ليتم توليده تلقائيًا"/></label>
        </div>
      </section>

      <details className="register-parent2-v47">
        <summary>+ إضافة ولي أمر ثانٍ (اختياري)</summary>
        <div className="register-grid-v47">
          <label>اسم ولي الأمر الثاني<input value={form.parent2Name} onChange={e=>setForm({...form,parent2Name:e.target.value})}/></label>
          <label>رقم التليفون<input inputMode="tel" value={form.parent2Phone} onChange={e=>setForm({...form,parent2Phone:e.target.value})}/></label>
          <label className="wide">الباسورد<input type="password" value={form.parent2Password} onChange={e=>setForm({...form,parent2Password:e.target.value})} placeholder="اختياري"/></label>
        </div>
      </details>

      <input className="register-honeypot-v47" tabIndex={-1} autoComplete="off" value={form.website} onChange={e=>setForm({...form,website:e.target.value})}/>
      {error?<div className="register-error-v47">{error}</div>:null}
      <button className="register-submit-v47" disabled={loading}>{loading?"جاري التسجيل...":"إرسال وتسجيل البيانات"}</button>
      <small className="register-privacy-v47">تُستخدم البيانات لإنشاء ملف الطالب والتواصل مع ولي الأمر فقط.</small>
    </form>
  </main>;
}
