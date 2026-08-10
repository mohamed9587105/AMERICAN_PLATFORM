"use client";

import {usePathname} from "next/navigation";
import type {ReactNode} from "react";

type Session={name?:string;email?:string;role?:string;isOwner?:boolean;permissions?:Record<string,boolean>};

export default function AdminWorldShell({children,session}:{children:ReactNode;session?:Session|null}){
  const pathname=usePathname();
  const active=(href:string)=>href==="/manual-entry"?pathname==="/manual-entry":pathname.startsWith(href);
  const can=(p:string)=>Boolean(session?.isOwner||session?.role==="owner"||session?.permissions?.[p]);

  return <div className="admin-world-shell-v90 unified-admin-v114" dir="rtl">
    <aside className="admin-world-sidebar-v90">
      <div className="admin-world-brand-v90">
        <span className="admin-world-brand-mark-v90">P</span>
        <div><strong>Parent OS</strong><small>نظام متابعة أولياء الأمور</small></div>
      </div>

      <nav className="admin-world-nav-v90">
        <small>الإدارة</small>
        {can("dashboard.view")?<a className={active("/manual-entry")?"active":""} href="/manual-entry"><b>⌂</b><span>مركز التشغيل</span></a>:null}
        {can("students.view")?<a className={active("/admin/students")?"active":""} href="/admin/students"><b>◎</b><span>الطلاب</span></a>:null}
        {can("reports.view")?<a className={active("/admin/reports")?"active":""} href="/admin/reports"><b>▤</b><span>التقارير</span></a>:null}
        {(can("data_entry.attendance")||can("data_entry.homework")||can("data_entry.exams")||can("data_entry.finance"))?<a className={active("/admin/data-entry")?"active":""} href="/admin/data-entry"><b>▦</b><span>الإدخال الجماعي</span></a>:null}
        {can("finance.view")?<a className={active("/admin/finance")?"active":""} href="/admin/finance"><b>£</b><span>المالية</span></a>:null}
        {can("dashboard.view")?<a className={active("/admin/parent-app")?"active":""} href="/admin/parent-app"><b>◉</b><span>تحكم تطبيق ولي الأمر</span></a>:null}
        {can("users.manage")?<a className={active("/admin/users")?"active":""} href="/admin/users"><b>♙</b><span>المستخدمون والصلاحيات</span></a>:null}
        {can("audit.view")?<a className={active("/admin/audit")?"active":""} href="/admin/audit"><b>◷</b><span>سجل النشاط</span></a>:null}

        <small>الوصول السريع</small>
        <a href="/parent-login"><b>↗</b><span>تجربة ولي الأمر</span></a>
        <a href="/"><b>◈</b><span>عرض التطبيق</span></a>
      </nav>

      <div className="admin-world-sidebar-foot-v90">
        <span>●</span><div><strong>{session?.name||"الإدارة"}</strong><small>{session?.isOwner?"مالك النظام":session?.role||"موظف"}</small></div>
      </div>
    </aside>

    <section className="admin-world-main-v90">
      <header className="admin-world-top-v90">
        <div><span className="admin-world-eyebrow-v90">مركز التشغيل</span><strong>لوحة الإدارة</strong></div>
        <div className="admin-world-top-actions-v90">
          {can("reports.edit")?<a href="/manual-entry#student-workspace">+ تقرير جديد</a>:null}
          <form action="/api/auth/admin-logout" method="post"><button type="submit">تسجيل الخروج</button></form>
        </div>
      </header>
      {children}
    </section>
  </div>;
}
