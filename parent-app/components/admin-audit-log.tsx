"use client";
import {useEffect,useMemo,useState} from "react";
type Row={id:number;actor_name:string;actor_email:string;action:string;entity_type?:string;entity_id?:string;details?:any;created_at:string};
export default function AdminAuditLog(){
  const [rows,setRows]=useState<Row[]>([]),[q,setQ]=useState(""),[loading,setLoading]=useState(true);
  useEffect(()=>{fetch("/api/admin/audit",{cache:"no-store"}).then(r=>r.json()).then(d=>setRows(d.rows||[])).finally(()=>setLoading(false))},[]);
  const filtered=useMemo(()=>rows.filter(r=>!q||`${r.actor_name} ${r.actor_email} ${r.action} ${r.entity_type||""}`.toLowerCase().includes(q.toLowerCase())),[rows,q]);
  const label=(a:string)=>({
    "user.created":"إنشاء مستخدم","user.updated":"تعديل مستخدم","user.deleted":"حذف مستخدم",
    "student.created":"إضافة طالب","student.updated":"تعديل طالب","student.imported":"استيراد طلاب",
    "report.updated":"تعديل تقرير","bulk.entry":"إدخال جماعي","finance.updated":"تعديل مالي"
  } as any)[a]||a;
  return <main className="admin-audit-v115" dir="rtl">
    <section className="all-students-hero-v76"><div><span>الأمان والرقابة</span><h1>سجل النشاط</h1><p>مرجع واضح لمعرفة من قام بالتغييرات ومتى.</p></div><div className="all-students-count-v76"><strong>{rows.length}</strong><span>عملية مسجلة</span></div></section>
    <section className="all-students-toolbar-v76"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="بحث بالموظف أو نوع العملية"/></section>
    <section className="all-students-table-wrap-v76">
      <table className="all-students-table-v76"><thead><tr><th>التاريخ</th><th>الموظف</th><th>العملية</th><th>النوع</th><th>التفاصيل</th></tr></thead>
      <tbody>{filtered.map(r=><tr key={r.id}><td>{new Intl.DateTimeFormat("ar-EG",{dateStyle:"medium",timeStyle:"short"}).format(new Date(r.created_at))}</td><td><strong>{r.actor_name}</strong><small>{r.actor_email}</small></td><td>{label(r.action)}</td><td>{r.entity_type||"—"}</td><td><code>{r.entity_id||"—"}</code></td></tr>)}</tbody></table>
      {!loading&&!filtered.length?<div className="all-students-empty-v76">لا توجد عمليات مطابقة.</div>:null}
    </section>
  </main>
}
