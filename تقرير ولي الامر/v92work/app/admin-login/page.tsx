import {redirect} from "next/navigation";
import {getAdminSession} from "@/lib/server/admin-auth";

export const dynamic="force-dynamic";
export const revalidate=0;
export const metadata={title:"دخول الإدارة"};

export default async function AdminLoginPage({
  searchParams
}:{
  searchParams:Promise<{error?:string;reason?:string;next?:string}>
}){
  const session=await getAdminSession();
  if(session) redirect("/manual-entry");

  const params=await searchParams;
  const message=
    params.error==="invalid"
      ?"الإيميل أو الباسورد غير صحيح."
      :params.error==="config"
      ?"حماية الإدارة لم يتم إعدادها بعد على الخادم."
      :params.reason==="session"
      ?"انتهت جلسة الإدارة. سجّل الدخول مرة أخرى."
      :"";

  return <main className="admin-login-page-v87" dir="rtl">
    <section className="admin-login-card-v87">
      <div className="admin-login-brand-v87">
        <span>AMERICAN PLATFORM</span>
        <h1>دخول الإدارة</h1>
        <p>هذه المنطقة مخصصة للإدارة فقط.</p>
      </div>

      <form action="/api/auth/admin-login" method="post">
        <input type="hidden" name="next" value={params.next||"/manual-entry"}/>

        <label>
          <span>البريد الإلكتروني</span>
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            placeholder="admin@example.com"
          />
        </label>

        <label>
          <span>كلمة المرور</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••••"
          />
        </label>

        {message?<div className="admin-login-error-v87">{message}</div>:null}

        <button type="submit">دخول آمن</button>
      </form>

      <small>أي محاولة لفتح صفحات أو APIs الإدارة بدون تسجيل دخول يتم رفضها من السيرفر.</small>
    </section>
  </main>;
}
