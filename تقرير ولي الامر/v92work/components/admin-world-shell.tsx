"use client";

import {usePathname} from "next/navigation";
import type {ReactNode} from "react";

export default function AdminWorldShell({children}:{children:ReactNode}){
  const pathname=usePathname();
  const active=(href:string)=>href==="/manual-entry"?pathname==="/manual-entry":pathname.startsWith(href);
  return <div className="admin-world-shell-v90" dir="rtl">
    <aside className="admin-world-sidebar-v90">
      <div className="admin-world-brand-v90">
        <span className="admin-world-brand-mark-v90">P</span>
        <div><strong>Parent OS</strong><small>Education Operations</small></div>
      </div>

      <nav className="admin-world-nav-v90">
        <small>الإدارة</small>
        <a className={active("/manual-entry")?"active":""} href="/manual-entry"><b>⌂</b><span>مركز التشغيل</span></a>
        <a className={active("/admin/students")?"active":""} href="/admin/students"><b>◎</b><span>الطلاب</span></a>
        <a className={active("/admin/reports")?"active":""} href="/admin/reports"><b>▤</b><span>التقارير</span></a>
        <a className={active("/admin/finance")?"active":""} href="/admin/finance"><b>£</b><span>المالية</span></a>
        <small>الوصول السريع</small>
        <a href="/parent-login"><b>↗</b><span>تجربة ولي الأمر</span></a>
        <a href="/"><b>◈</b><span>عرض التطبيق</span></a>
      </nav>

      <div className="admin-world-sidebar-foot-v90">
        <span>●</span><div><strong>النظام متصل</strong><small>لوحة الإدارة الآمنة</small></div>
      </div>
    </aside>

    <section className="admin-world-main-v90">
      <header className="admin-world-top-v90">
        <div><span className="admin-world-eyebrow-v90">OPERATIONS CENTER</span><strong>لوحة الإدارة</strong></div>
        <div className="admin-world-top-actions-v90">
          <a href="/manual-entry#student-workspace">+ تقرير جديد</a>
          <form action="/api/auth/admin-logout" method="post"><button type="submit">تسجيل الخروج</button></form>
        </div>
      </header>
      {children}
    </section>
  </div>;
}
