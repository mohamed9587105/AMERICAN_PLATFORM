"use client";
import {useEffect,useMemo,useState} from "react";

type StudentRow={
  id:string;code:string;name:string;course:string;currency:string;
  sessionPrice:number;payments:number;charges:number;balance:number;sessionCount:number;
  transactions:any[];
};
type CourseRow={
  key:string;course:string;currency:string;studentsCount:number;payments:number;
  charges:number;balance:number;sessionCount:number;owed:number;credit:number;
};

function money(v:number,currency:string){
  return `${Number(v||0).toLocaleString("ar-EG")} ${currency}`;
}

export default function AdminFinanceReports(){
  const [students,setStudents]=useState<StudentRow[]>([]);
  const [courses,setCourses]=useState<CourseRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [view,setView]=useState<"students"|"courses">("students");
  const [search,setSearch]=useState("");
  const [courseFilter,setCourseFilter]=useState("all");
  const [currencyFilter,setCurrencyFilter]=useState("all");
  const [selectedStudent,setSelectedStudent]=useState<StudentRow|null>(null);
  const [drawerMode,setDrawerMode]=useState<"account"|"payments">("account");
  const [billingDetail,setBillingDetail]=useState<any>(null);
  const [billingBusy,setBillingBusy]=useState(false);
  const [billingMessage,setBillingMessage]=useState("");
  const [profileForm,setProfileForm]=useState({currency:"EGP",sessionPrice:"0",autoCharge:true,chargeAbsent:false});
  const [paymentForm,setPaymentForm]=useState({amount:"",date:new Date().toISOString().slice(0,10),note:""});
  const [editingPayment,setEditingPayment]=useState<any>(null);

  const load=async()=>{
    setLoading(true);setError("");
    try{
      const res=await fetch("/api/admin/finance-reports",{cache:"no-store"});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"تعذر تحميل التقرير المالي");
      setStudents(data.students||[]);
      setCourses(data.courses||[]);
    }catch(err:any){
      setError(err.message||"تعذر تحميل التقرير المالي");
    }finally{
      setLoading(false);
    }
  };


  const loadStudentBilling=async(student:StudentRow,mode:"account"|"payments"="account")=>{
    setSelectedStudent(student);
    setDrawerMode(mode);
    setBillingBusy(true);
    setBillingMessage("");
    try{
      const res=await fetch(`/api/admin/billing?studentId=${encodeURIComponent(student.id)}`,{cache:"no-store"});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"تعذر تحميل الحساب المالي");
      setBillingDetail(data);
      setProfileForm({
        currency:data.profile?.currency||student.currency||"EGP",
        sessionPrice:String(data.profile?.session_price??student.sessionPrice??0),
        autoCharge:data.profile?.auto_charge!==false,
        chargeAbsent:Boolean(data.profile?.charge_absent)
      });
    }catch(err:any){
      setBillingMessage(err.message||"تعذر تحميل الحساب المالي");
    }finally{
      setBillingBusy(false);
    }
  };

  const refreshAll=async(studentId?:string)=>{
    await load();
    if(studentId){
      try{
        const res=await fetch(`/api/admin/billing?studentId=${encodeURIComponent(studentId)}`,{cache:"no-store"});
        const data=await res.json();
        if(res.ok) setBillingDetail(data);
      }catch{}
    }
  };

  const saveProfile=async()=>{
    if(!selectedStudent) return;
    setBillingBusy(true);setBillingMessage("جاري حفظ التسعير...");
    try{
      const res=await fetch("/api/admin/billing",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          action:"profile",
          studentId:selectedStudent.id,
          currency:profileForm.currency,
          sessionPrice:Number(profileForm.sessionPrice),
          autoCharge:profileForm.autoCharge,
          chargeAbsent:profileForm.chargeAbsent
        })
      });
      const data=await res.json();
      if(!res.ok) throw new Error(
        data.error==="CANNOT_CHANGE_CURRENCY_WITH_EXISTING_LEDGER"
          ?"لا يمكن تغيير العملة بعد بدء الحركات المالية لهذا الطالب."
          :data.error==="USD_ONLY_FOR_SAT"
          ?"الدولار متاح لطلاب SAT فقط."
          :data.error||"تعذر حفظ التسعير"
      );
      setBillingDetail(data);
      setBillingMessage("تم حفظ سعر الحصة والعملة ✓");
      await load();
    }catch(err:any){setBillingMessage(err.message||"تعذر حفظ التسعير")}
    finally{setBillingBusy(false)}
  };

  const savePayment=async()=>{
    if(!selectedStudent) return;
    if(!paymentForm.amount||Number(paymentForm.amount)<=0){
      setBillingMessage("اكتب مبلغ دفعة صحيح.");
      return;
    }
    setBillingBusy(true);
    setBillingMessage(editingPayment?"جاري تعديل الدفعة...":"جاري إضافة الدفعة...");
    try{
      const res=await fetch("/api/admin/billing",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          action:editingPayment?"editPayment":"payment",
          studentId:selectedStudent.id,
          transactionId:editingPayment?.id,
          amount:Number(paymentForm.amount),
          date:paymentForm.date,
          note:paymentForm.note
        })
      });
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"تعذر حفظ الدفعة");
      setBillingDetail(data);
      setPaymentForm({amount:"",date:new Date().toISOString().slice(0,10),note:""});
      setEditingPayment(null);
      setBillingMessage(editingPayment?"تم تعديل الدفعة ✓":"تمت إضافة الدفعة ✓");
      await load();
    }catch(err:any){setBillingMessage(err.message||"تعذر حفظ الدفعة")}
    finally{setBillingBusy(false)}
  };

  const startEditPayment=(t:any)=>{
    setEditingPayment(t);
    setPaymentForm({
      amount:String(Math.abs(Number(t.amount||0))),
      date:t.transaction_date||new Date().toISOString().slice(0,10),
      note:t.note||""
    });
    setDrawerMode("payments");
  };

  const deletePayment=async(t:any)=>{
    if(!selectedStudent) return;
    if(!confirm("حذف هذه الدفعة من حساب الطالب؟")) return;
    setBillingBusy(true);setBillingMessage("جاري حذف الدفعة...");
    try{
      const res=await fetch("/api/admin/billing",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          action:"deletePayment",
          studentId:selectedStudent.id,
          transactionId:t.id
        })
      });
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"تعذر حذف الدفعة");
      setBillingDetail(data);
      setEditingPayment(null);
      setPaymentForm({amount:"",date:new Date().toISOString().slice(0,10),note:""});
      setBillingMessage("تم حذف الدفعة ✓");
      await load();
    }catch(err:any){setBillingMessage(err.message||"تعذر حذف الدفعة")}
    finally{setBillingBusy(false)}
  };

  useEffect(()=>{load()},[]);

  useEffect(()=>{
    if(!students.length) return;
    try{
      const id=new URLSearchParams(window.location.search).get("student");
      if(id){
        const found=students.find(s=>s.id===id);
        if(found){
          setView("students");
          loadStudentBilling(found,"account");
        }
      }
    }catch{}
  },[students]);

  const courseOptions=useMemo(
    ()=>Array.from(new Set(students.map(s=>s.course))).sort(),
    [students]
  );

  const filteredStudents=useMemo(()=>students.filter(s=>{
    const q=search.trim().toLowerCase();
    const matchSearch=!q||s.name.toLowerCase().includes(q)||s.code.toLowerCase().includes(q);
    const matchCourse=courseFilter==="all"||s.course===courseFilter;
    const matchCurrency=currencyFilter==="all"||s.currency===currencyFilter;
    return matchSearch&&matchCourse&&matchCurrency;
  }),[students,search,courseFilter,currencyFilter]);

  const filteredCourses=useMemo(()=>courses.filter(c=>{
    const q=search.trim().toLowerCase();
    const matchSearch=!q||c.course.toLowerCase().includes(q);
    const matchCurrency=currencyFilter==="all"||c.currency===currencyFilter;
    return matchSearch&&matchCurrency;
  }),[courses,search,currencyFilter]);

  const totals=useMemo(()=>{
    const source=filteredStudents;
    return source.reduce((a,s)=>{
      a.payments+=s.payments;
      a.charges+=s.charges;
      a.balance+=s.balance;
      a.owed+=s.balance<0?Math.abs(s.balance):0;
      a.credit+=s.balance>0?s.balance:0;
      a.sessions+=s.sessionCount;
      return a;
    },{payments:0,charges:0,balance:0,owed:0,credit:0,sessions:0});
  },[filteredStudents]);

  return <main className="admin-finance-page-v70" dir="rtl">
    <section className="admin-finance-hero-v70">
      <div>
        <span>الإدارة المالية</span>
        <h1>التقارير المالية</h1>
        <p>متابعة كل طالب وكل كورس من نفس الحركات المالية الفعلية.</p>
      </div>
      <button onClick={load} disabled={loading}>{loading?"جاري التحديث...":"تحديث البيانات"}</button>
    </section>

    <section className="admin-finance-summary-v70">
      <article><span>إجمالي الدفعات</span><strong>{money(totals.payments,currencyFilter==="USD"?"USD":"EGP")}</strong></article>
      <article><span>تكلفة الحصص</span><strong>{money(totals.charges,currencyFilter==="USD"?"USD":"EGP")}</strong></article>
      <article className="danger"><span>إجمالي المطلوب</span><strong>{money(totals.owed,currencyFilter==="USD"?"USD":"EGP")}</strong></article>
      <article className="success"><span>أرصدة الطلاب</span><strong>{money(totals.credit,currencyFilter==="USD"?"USD":"EGP")}</strong></article>
    </section>

    <section className="admin-finance-toolbar-v70">
      <div className="admin-finance-tabs-v70">
        <button className={view==="students"?"active":""} onClick={()=>setView("students")}>تقرير الطلاب</button>
        <button className={view==="courses"?"active":""} onClick={()=>setView("courses")}>تقرير الكورسات</button>
      </div>

      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={view==="students"?"بحث بالاسم أو الكود":"بحث باسم الكورس"}/>

      {view==="students"?<select value={courseFilter} onChange={e=>setCourseFilter(e.target.value)}>
        <option value="all">كل الكورسات</option>
        {courseOptions.map(c=><option key={c} value={c}>{c}</option>)}
      </select>:null}

      <select value={currencyFilter} onChange={e=>setCurrencyFilter(e.target.value)}>
        <option value="all">كل العملات</option>
        <option value="EGP">EGP</option>
        <option value="USD">USD</option>
      </select>
    </section>

    {error?<div className="admin-finance-error-v70">{error}</div>:null}

    {view==="students"?<section className="admin-finance-table-wrap-v70">
      <table className="admin-finance-table-v70">
        <thead><tr>
          <th>الطالب</th><th>الكود</th><th>الكورس</th><th>سعر الحصة</th>
          <th>الدفعات</th><th>تكلفة الحصص</th><th>عدد الحصص</th><th>الرصيد</th><th></th>
        </tr></thead>
        <tbody>
          {filteredStudents.map(s=><tr key={s.id}>
            <td><strong>{s.name}</strong></td>
            <td>{s.code}</td>
            <td>{s.course}</td>
            <td>{money(s.sessionPrice,s.currency)}</td>
            <td className="positive">{money(s.payments,s.currency)}</td>
            <td>{money(s.charges,s.currency)}</td>
            <td>{s.sessionCount}</td>
            <td className={s.balance<0?"negative":"positive"}>{s.balance<0?"مطلوب ":""}{money(Math.abs(s.balance),s.currency)}</td>
            <td>
              <div className="student-finance-actions-v75">
                <button onClick={()=>loadStudentBilling(s,"account")}>الحساب المالي</button>
                <button className="payments" onClick={()=>loadStudentBilling(s,"payments")}>الدفعات</button>
              </div>
            </td>
          </tr>)}
        </tbody>
      </table>
    </section>:<section className="course-finance-grid-v70">
      {filteredCourses.map(c=><article key={c.key}>
        <div className="course-finance-head-v70">
          <div><span>الكورس</span><h2>{c.course}</h2><small>{c.studentsCount} طالب · {c.currency}</small></div>
          <b>{c.sessionCount} حصة</b>
        </div>
        <div className="course-finance-stats-v70">
          <div><span>الدفعات</span><strong>{money(c.payments,c.currency)}</strong></div>
          <div><span>تكلفة الحصص</span><strong>{money(c.charges,c.currency)}</strong></div>
          <div className="danger"><span>مطلوب من الطلاب</span><strong>{money(c.owed,c.currency)}</strong></div>
          <div className="success"><span>أرصدة متاحة</span><strong>{money(c.credit,c.currency)}</strong></div>
        </div>
        <div className={`course-net-v70 ${c.balance<0?"negative":"positive"}`}>
          <span>صافي أرصدة الكورس</span>
          <strong>{c.balance<0?"-":"+"}{money(Math.abs(c.balance),c.currency)}</strong>
        </div>
      </article>)}
    </section>}

    {selectedStudent?<div className="finance-drawer-backdrop-v70" onClick={()=>setSelectedStudent(null)}>
      <aside className="finance-drawer-v70 finance-drawer-v75" onClick={e=>e.stopPropagation()}>
        <header>
          <div>
            <span>الحساب المالي للطالب</span>
            <h2>{selectedStudent.name}</h2>
            <p>{selectedStudent.code} · {selectedStudent.course}</p>
          </div>
          <button onClick={()=>setSelectedStudent(null)}>×</button>
        </header>

        <div className="finance-drawer-tabs-v75">
          <button className={drawerMode==="account"?"active":""} onClick={()=>setDrawerMode("account")}>الحساب المالي</button>
          <button className={drawerMode==="payments"?"active":""} onClick={()=>setDrawerMode("payments")}>الدفعات</button>
        </div>

        {billingBusy&&!billingDetail?<div className="finance-loading-v75">جاري تحميل الحساب...</div>:null}

        {drawerMode==="account"?<>
          <section className="finance-pricing-card-v75">
            <div className="finance-card-title-v75">
              <div><span>إعداد الحساب</span><h3>العملة وسعر الحصة</h3></div>
              <b>{billingDetail?.profile?.currency||selectedStudent.currency}</b>
            </div>

            <div className="finance-pricing-fields-v75">
              <label>
                <span>عملة الحساب</span>
                <select value={profileForm.currency} onChange={e=>{
                  const currency=e.target.value;
                  const sat=selectedStudent.course.toLowerCase().includes("sat");
                  setProfileForm({
                    ...profileForm,
                    currency,
                    sessionPrice:currency==="USD"&&sat?"10":currency==="EGP"?(sat?"450":"350"):profileForm.sessionPrice
                  });
                }}>
                  <option value="EGP">جنيه مصري EGP</option>
                  {selectedStudent.course.toLowerCase().includes("sat")?<option value="USD">دولار USD</option>:null}
                </select>
              </label>

              <label>
                <span>سعر الحصة</span>
                <input type="number" min="0" value={profileForm.sessionPrice} onChange={e=>setProfileForm({...profileForm,sessionPrice:e.target.value})}/>
              </label>
            </div>

            <div className="finance-options-v75">
              <label><input type="checkbox" checked={profileForm.autoCharge} onChange={e=>setProfileForm({...profileForm,autoCharge:e.target.checked})}/><span>خصم الحصة تلقائيًا</span></label>
              <label><input type="checkbox" checked={profileForm.chargeAbsent} onChange={e=>setProfileForm({...profileForm,chargeAbsent:e.target.checked})}/><span>احتساب الغياب كحصة</span></label>
            </div>

            <button className="finance-save-3d-v75" disabled={billingBusy} onClick={saveProfile}>حفظ سعر الحصة والعملة</button>
          </section>

          <section className="finance-drawer-summary-v70 finance-summary-v75">
            <div><span>إجمالي الدفعات</span><strong>{money(Number(billingDetail?.totalPayments??selectedStudent.payments),billingDetail?.profile?.currency||selectedStudent.currency)}</strong></div>
            <div><span>تكلفة الحصص</span><strong>{money(Number(billingDetail?.totalCharges??selectedStudent.charges),billingDetail?.profile?.currency||selectedStudent.currency)}</strong></div>
            <div><span>الرصيد</span><strong className={Number(billingDetail?.balance??selectedStudent.balance)<0?"negative":"positive"}>{money(Number(billingDetail?.balance??selectedStudent.balance),billingDetail?.profile?.currency||selectedStudent.currency)}</strong></div>
          </section>

          <section className="finance-quick-payment-v75">
            <div className="finance-card-title-v75"><div><span>إضافة سريعة</span><h3>تسجيل دفعة جديدة</h3></div></div>
            <div className="payment-form-grid-v75">
              <label><span>دفع كام؟</span><input type="number" min="0" placeholder="المبلغ" value={paymentForm.amount} onChange={e=>setPaymentForm({...paymentForm,amount:e.target.value})}/></label>
              <label><span>التاريخ</span><input type="date" value={paymentForm.date} onChange={e=>setPaymentForm({...paymentForm,date:e.target.value})}/></label>
              <label className="wide"><span>ملاحظة</span><input placeholder="مثال: كاش / تحويل / إنستاباي" value={paymentForm.note} onChange={e=>setPaymentForm({...paymentForm,note:e.target.value})}/></label>
            </div>
            <button className="finance-payment-3d-v75" disabled={billingBusy} onClick={savePayment}>+ تسجيل الدفعة</button>
          </section>
        </>:<>
          <section className="finance-payment-manager-v75">
            <div className="finance-card-title-v75">
              <div><span>إدارة الدفعات</span><h3>{editingPayment?"تعديل الدفعة":"إضافة دفعة"}</h3></div>
              {editingPayment?<button className="cancel-edit-v75" onClick={()=>{
                setEditingPayment(null);
                setPaymentForm({amount:"",date:new Date().toISOString().slice(0,10),note:""});
              }}>إلغاء التعديل</button>:null}
            </div>

            <div className="payment-form-grid-v75">
              <label><span>المبلغ</span><input type="number" min="0" value={paymentForm.amount} onChange={e=>setPaymentForm({...paymentForm,amount:e.target.value})}/></label>
              <label><span>تاريخ الدفعة</span><input type="date" value={paymentForm.date} onChange={e=>setPaymentForm({...paymentForm,date:e.target.value})}/></label>
              <label className="wide"><span>ملاحظة</span><input value={paymentForm.note} onChange={e=>setPaymentForm({...paymentForm,note:e.target.value})} placeholder="طريقة الدفع أو أي ملاحظة"/></label>
            </div>

            <button className="finance-payment-3d-v75" disabled={billingBusy} onClick={savePayment}>
              {editingPayment?"حفظ تعديل الدفعة":"+ إضافة دفعة جديدة"}
            </button>
          </section>

          <section className="payments-history-v75">
            <h3>سجل الدفعات</h3>
            {(billingDetail?.transactions||selectedStudent.transactions)
              .filter((t:any)=>t.transaction_type==="payment")
              .map((t:any)=><article key={t.id}>
                <div>
                  <strong>{money(Number(t.amount),t.currency)}</strong>
                  <small>{t.transaction_date}{t.note?` · ${t.note}`:""}</small>
                </div>
                <div className="payment-row-actions-v75">
                  <button onClick={()=>startEditPayment(t)}>تعديل</button>
                  <button className="delete" onClick={()=>deletePayment(t)}>حذف</button>
                </div>
              </article>)}
            {!(billingDetail?.transactions||selectedStudent.transactions).some((t:any)=>t.transaction_type==="payment")
              ?<p className="empty-payments-v75">لا توجد دفعات مسجلة حتى الآن.</p>:null}
          </section>
        </>}

        {billingMessage?<div className="finance-message-v75">{billingMessage}</div>:null}

        {drawerMode==="account"?<div className="finance-drawer-list-v70">
          <h3 className="ledger-heading-v75">كل حركات الحساب</h3>
          {(billingDetail?.transactions||selectedStudent.transactions).map((t:any)=><article key={t.id} className={Number(t.amount)>=0?"credit":"debit"}>
            <div><strong>{t.title}</strong><small>{t.transaction_date}{t.note?` · ${t.note}`:""}</small></div>
            <b>{Number(t.amount)>0?"+":""}{money(Number(t.amount),t.currency)}</b>
          </article>)}
        </div>:null}
      </aside>
    </div>:null}
  </main>;
}
