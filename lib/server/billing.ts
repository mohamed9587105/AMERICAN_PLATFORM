import "server-only";
import {dbDelete,dbInsert,dbSelect,dbUpdate} from "@/lib/server/db";

export type BillingProfile={
  student_id:string;
  currency:"EGP"|"USD";
  session_price:number;
  auto_charge:boolean;
  charge_absent:boolean;
};

function courseDefaults(student:any){
  const name=String(student?.courses?.name||"").toLowerCase();
  const slug=String(student?.courses?.slug||"").toLowerCase();
  const exam=String(student?.courses?.exam_type||"").toUpperCase();

  if(exam==="SAT"||name.includes("sat")||slug.includes("sat")){
    return {currency:"EGP" as const,session_price:450,allowsUsd:true};
  }
  if(exam==="EST"||name.includes("est")||slug.includes("est")){
    return {currency:"EGP" as const,session_price:350,allowsUsd:false};
  }
  if(name.includes("beginner")||slug.includes("beginner")||exam==="FOUNDATION"){
    return {currency:"EGP" as const,session_price:350,allowsUsd:false};
  }
  return {currency:"EGP" as const,session_price:0,allowsUsd:false};
}

export async function getStudentAndDefaults(studentId:string){
  const rows=await dbSelect(
    "students",
    `select=id,name,course_id,courses(id,slug,name,exam_type)&id=eq.${encodeURIComponent(studentId)}&limit=1`
  );
  const student=rows[0];
  if(!student) throw new Error("STUDENT_NOT_FOUND");
  return {student,defaults:courseDefaults(student)};
}

export async function ensureBillingProfile(studentId:string):Promise<BillingProfile & {allowsUsd:boolean}>{
  const {defaults}=await getStudentAndDefaults(studentId);
  const rows=await dbSelect(
    "student_billing_profiles",
    `select=*&student_id=eq.${encodeURIComponent(studentId)}&limit=1`
  );
  if(rows[0]){
    return {...rows[0],session_price:Number(rows[0].session_price),allowsUsd:defaults.allowsUsd};
  }
  const inserted=await dbInsert("student_billing_profiles",{
    student_id:studentId,
    currency:defaults.currency,
    session_price:defaults.session_price,
    auto_charge:true,
    charge_absent:false
  });
  return {...inserted[0],session_price:Number(inserted[0].session_price),allowsUsd:defaults.allowsUsd};
}

export async function updateBillingProfile(
  studentId:string,
  input:{currency?:"EGP"|"USD";sessionPrice?:number;autoCharge?:boolean;chargeAbsent?:boolean}
){
  const current=await ensureBillingProfile(studentId);
  const {defaults}=await getStudentAndDefaults(studentId);

  let currency=input.currency??current.currency;
  if(currency==="USD"&&!defaults.allowsUsd){
    throw new Error("USD_ONLY_FOR_SAT");
  }

  let price=input.sessionPrice;
  if(price==null){
    if(currency!==current.currency){
      price=currency==="USD"&&defaults.allowsUsd?10:defaults.session_price;
    }else{
      price=current.session_price;
    }
  }
  if(!Number.isFinite(Number(price))||Number(price)<0) throw new Error("INVALID_SESSION_PRICE");

  const transactions=await dbSelect(
    "financial_transactions",
    `select=id,currency&student_id=eq.${encodeURIComponent(studentId)}&limit=1`
  );
  if(transactions.length&&currency!==current.currency){
    throw new Error("CANNOT_CHANGE_CURRENCY_WITH_EXISTING_LEDGER");
  }

  const rows=await dbUpdate(
    "student_billing_profiles",
    `student_id=eq.${encodeURIComponent(studentId)}`,
    {
      currency,
      session_price:Number(price),
      auto_charge:input.autoCharge??current.auto_charge,
      charge_absent:input.chargeAbsent??current.charge_absent,
      updated_at:new Date().toISOString()
    }
  );
  return {...rows[0],session_price:Number(rows[0].session_price),allowsUsd:defaults.allowsUsd};
}

export async function addPayment(input:{
  studentId:string;
  amount:number;
  date?:string;
  note?:string;
}){
  const profile=await ensureBillingProfile(input.studentId);
  const amount=Number(input.amount);
  if(!Number.isFinite(amount)||amount<=0) throw new Error("INVALID_PAYMENT_AMOUNT");

  const rows=await dbInsert("financial_transactions",{
    student_id:input.studentId,
    report_id:null,
    transaction_type:"payment",
    amount,
    currency:profile.currency,
    title:"دفعة من ولي الأمر",
    transaction_date:input.date||new Date().toISOString().slice(0,10),
    external_key:null,
    note:input.note||null
  });
  return rows[0];
}

export async function syncReportSessionCharges(studentId:string,reportId:string){
  const profile=await ensureBillingProfile(studentId);
  if(!profile.auto_charge) return getBillingSummary(studentId);

  await dbDelete(
    "financial_transactions",
    `student_id=eq.${encodeURIComponent(studentId)}&report_id=eq.${encodeURIComponent(reportId)}&transaction_type=eq.session_charge`
  );

  const attendance=await dbSelect(
    "attendance_entries",
    `select=id,date,status,note&report_id=eq.${encodeURIComponent(reportId)}&order=date.asc`
  );

  const billable=attendance.filter((a:any)=>
    a.status==="present"||
    a.status==="late"||
    (a.status==="absent"&&profile.charge_absent)
  );

  if(billable.length&&profile.session_price>0){
    const {student}=await getStudentAndDefaults(studentId);
    const courseName=student?.courses?.name||"الكورس";
    await dbInsert("financial_transactions",billable.map((a:any)=>({
      student_id:studentId,
      report_id:reportId,
      transaction_type:"session_charge",
      amount:-Math.abs(Number(profile.session_price)),
      currency:profile.currency,
      title:`حصة ${courseName}`,
      transaction_date:a.date,
      external_key:`session:${reportId}:${a.id}`,
      note:a.status==="late"?"حضور متأخر":a.status==="absent"?"غياب محسوب":"حضور"
    })));
  }

  return getBillingSummary(studentId);
}

export async function getBillingSummary(studentId:string){
  const profile=await ensureBillingProfile(studentId);
  const transactions=await dbSelect(
    "financial_transactions",
    `select=*&student_id=eq.${encodeURIComponent(studentId)}&currency=eq.${profile.currency}&order=transaction_date.desc,created_at.desc`
  );

  const balance=transactions.reduce((sum:number,t:any)=>sum+Number(t.amount||0),0);
  const totalPayments=transactions
    .filter((t:any)=>t.transaction_type==="payment"||Number(t.amount)>0)
    .reduce((sum:number,t:any)=>sum+Math.max(0,Number(t.amount||0)),0);
  const totalCharges=Math.abs(transactions
    .filter((t:any)=>t.transaction_type==="session_charge")
    .reduce((sum:number,t:any)=>sum+Number(t.amount||0),0));
  const sessionCount=transactions.filter((t:any)=>t.transaction_type==="session_charge").length;

  return {
    profile,
    transactions,
    balance,
    totalPayments,
    totalCharges,
    sessionCount
  };
}
