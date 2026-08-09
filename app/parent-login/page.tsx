export default async function ParentLogin({
  searchParams
}:{
  searchParams:Promise<{error?:string;reason?:string}>
}){
  const params=await searchParams;
  const message=
    params.error==="invalid"
      ?"رقم التليفون أو الباسورد غير صحيح."
      :params.error==="server"
      ?"حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى."
      :params.reason==="session"
      ?"انتهت جلسة الدخول. سجّل الدخول مرة أخرى."
      :"";

  return <main className="parent-login-page-v36">
    <form
      action="/api/auth/parent-login-form"
      method="post"
      className="parent-login-card-v36"
    >
      <span>تطبيق ولي الأمر</span>
      <h1>تسجيل الدخول</h1>
      <p>ادخل رقم التليفون والباسورد المسجلين لدى الإدارة.</p>

      <label>
        رقم التليفون
        <input
          name="phone"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder="01xxxxxxxxx"
        />
      </label>

      <label>
        الباسورد
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••"
        />
      </label>

      {message?<div className="login-error-v36">{message}</div>:null}

      <button type="submit">دخول</button>

      <small>
        يمكنك فتح التطبيق من Android أو iPhone بعد تسجيل الدخول.
      </small>
    </form>
  </main>
}
