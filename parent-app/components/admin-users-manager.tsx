"use client";
import {useEffect,useMemo,useState} from "react";

const groups=[
  {title:"مركز الإدارة",items:[["dashboard.view","فتح مركز التشغيل"]]},
  {title:"الطلاب",items:[["students.view","مشاهدة الطلاب"],["students.create","إضافة طالب"],["students.edit","تعديل بيانات الطالب"],["students.import","استيراد الطلاب"],["students.password","إظهار/تغيير باسورد ولي الأمر"],["students.toggle","تفعيل وإيقاف المتابعة"]]},
  {title:"التقارير",items:[["reports.view","مشاهدة التقارير"],["reports.edit","تعديل التقارير"],["reports.pdf","تصدير PDF"]]},
  {title:"الإدخال الجماعي",items:[["data_entry.attendance","الحضور والغياب"],["data_entry.homework","الواجبات"],["data_entry.exams","الامتحانات"],["data_entry.finance","المالية داخل الإدخال الجماعي"]]},
  {title:"المالية",items:[["finance.view","مشاهدة المالية"],["finance.edit","إضافة وتعديل العمليات المالية"]]},
  {title:"الإدارة العليا",items:[["users.manage","إدارة المستخدمين والصلاحيات"],["audit.view","سجل النشاط"]]},
] as const;
type User={id:string;name:string;email:string;role:string;permissions:Record<string,boolean>;is_active:boolean;created_at?:string};

const blank=()=>({name:"",email:"",password:"",role:"staff",isActive:true,permissions:{} as Record<string,boolean>});

export default function AdminUsersManager(){
  const [users,setUsers]=useState<User[]>([]),[form,setForm]=useState(blank()),[selected,setSelected]=useState<string>("");
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const load=async()=>{const r=await fetch("/api/admin/users",{cache:"no-store"});const d=await r.json();if(r.ok)setUsers(d.users||[]);else setMessage(d.error||"تعذر تحميل المستخدمين")};
  useEffect(()=>{load()},[]);
  const current=useMemo(()=>users.find(x=>x.id===selected)||null,[users,selected]);

  const edit=(u:User)=>{setSelected(u.id);setForm({name:u.name,email:u.email,password:"",role:u.role||"staff",isActive:u.is_active!==false,permissions:{...(u.permissions||{})}});setMessage("")};
  const fresh=()=>{setSelected("");setForm(blank());setMessage("")};
  const toggle=(key:string)=>setForm(f=>({...f,permissions:{...f.permissions,[key]:!f.permissions[key]}}));
  const selectPreset=(preset:"data"|"reports"|"finance"|"manager")=>{
    const p:Record<string,boolean>={};
    const enable=(...keys:string[])=>keys.forEach(k=>p[k]=true);
    if(preset==="data")enable("dashboard.view","students.view","data_entry.attendance","data_entry.homework","data_entry.exams");
    if(preset==="reports")enable("dashboard.view","students.view","reports.view","reports.edit","reports.pdf");
    if(preset==="finance")enable("dashboard.view","students.view","finance.view","finance.edit","data_entry.finance");
    if(preset==="manager"){
      for(const group of groups){
        for(const [k] of group.items){
          p[k]=k!=="users.manage";
        }
      }
    }
    setForm(f=>({...f,permissions:p}));
  };
  const save=async()=>{
    setBusy(true);setMessage("");
    const method=selected?"PATCH":"POST";
    const body:any={...form};if(selected)body.id=selected;
    if(selected&&!form.password)delete body.password;
    const r=await fetch("/api/admin/users",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const d=await r.json();setBusy(false);
    if(!r.ok){setMessage(d.error||"تعذر الحفظ");return}
    setMessage(selected?"تم تحديث صلاحيات الموظف ✓":"تم إنشاء حساب الموظف ✓");await load();if(!selected)fresh();
  };
  const remove=async()=>{
    if(!current||!confirm(`حذف حساب ${current.name}؟`))return;
    const r=await fetch(`/api/admin/users?id=${encodeURIComponent(current.id)}`,{method:"DELETE"});
    if(r.ok){fresh();await load()}
  };
  return <main className="admin-users-v115" dir="rtl">
    <section className="all-students-hero-v76"><div><span>إدارة الفريق</span><h1>المستخدمون والصلاحيات</h1><p>كل موظف يرى ويستخدم فقط ما تسمح له به.</p></div><div className="all-students-count-v76"><strong>{users.filter(x=>x.is_active).length}</strong><span>حساب مفعّل</span></div></section>
    <div className="admin-users-layout-v115">
      <aside className="admin-users-list-v115">
        <button className="new-user-v115" onClick={fresh}>+ موظف جديد</button>
        {users.map(u=><button key={u.id} className={selected===u.id?"active":""} onClick={()=>edit(u)}>
          <i className={u.is_active?"on":"off"}/><div><strong>{u.name}</strong><span>{u.email}</span></div><small>{u.is_active?"مفعّل":"موقوف"}</small>
        </button>)}
      </aside>
      <section className="admin-user-editor-v115">
        <div className="admin-user-basic-v115">
          <label><span>اسم الموظف</span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
          <label><span>البريد الإلكتروني</span><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
          <label><span>{selected?"باسورد جديد (اختياري)":"كلمة المرور"}</span><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>
          <label><span>الوظيفة</span><input value={form.role} onChange={e=>setForm({...form,role:e.target.value})} placeholder="مثال: مسؤول حضور"/></label>
          <label className="account-switch-v115"><input type="checkbox" checked={form.isActive} onChange={e=>setForm({...form,isActive:e.target.checked})}/><span>الحساب مفعّل</span></label>
        </div>
        <div className="permission-presets-v115"><span>قوالب سريعة:</span><button onClick={()=>selectPreset("data")}>مدخل بيانات</button><button onClick={()=>selectPreset("reports")}>متابعة وتقارير</button><button onClick={()=>selectPreset("finance")}>حسابات</button><button onClick={()=>selectPreset("manager")}>مدير تشغيل</button></div>
        <div className="permissions-grid-v115">{groups.map(g=><section key={g.title}><h3>{g.title}</h3>{g.items.map(([key,label])=><label key={key}><input type="checkbox" checked={Boolean(form.permissions[key])} onChange={()=>toggle(key)}/><span>{label}</span></label>)}</section>)}</div>
        {message?<div className="admin-user-message-v115">{message}</div>:null}
        <div className="admin-user-actions-v115">{selected?<button className="danger" onClick={remove}>حذف الحساب</button>:null}<button className="primary" disabled={busy} onClick={save}>{busy?"جاري الحفظ...":selected?"حفظ التعديلات":"إنشاء الحساب"}</button></div>
      </section>
    </div>
  </main>
}
