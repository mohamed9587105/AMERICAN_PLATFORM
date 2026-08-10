import {NextResponse} from "next/server";
import {dbConfigured,dbSelect} from "@/lib/server/db";
import {requireAdminApi} from "@/lib/server/admin-auth";

export const dynamic="force-dynamic";
export const revalidate=0;

function num(v:any){return Number(v||0)}
function summarizeTransactions(transactions:any[]){
  const payments=transactions.filter(t=>num(t.amount)>0).reduce((s,t)=>s+num(t.amount),0);
  const charges=Math.abs(transactions.filter(t=>t.transaction_type==="session_charge").reduce((s,t)=>s+num(t.amount),0));
  const balance=transactions.reduce((s,t)=>s+num(t.amount),0);
  const sessionCount=transactions.filter(t=>t.transaction_type==="session_charge").length;
  return {payments,charges,balance,sessionCount};
}

export async function GET(req:Request){
  const adminDenied=await requireAdminApi();
  if(adminDenied) return adminDenied;
  if(!dbConfigured) return NextResponse.json({mode:"demo",students:[],courses:[]});

  try{
    const students=await dbSelect(
      "students",
      "select=id,code,name,course_id,courses(id,slug,name,exam_type)&order=name.asc"
    );

    const profiles=await dbSelect(
      "student_billing_profiles",
      "select=student_id,currency,session_price,auto_charge,charge_absent"
    );

    const transactions=await dbSelect(
      "financial_transactions",
      "select=id,student_id,transaction_type,amount,currency,title,transaction_date,note,created_at&order=transaction_date.desc,created_at.desc"
    );

    const profileMap=new Map<string,any>(profiles.map((p:any)=>[String(p.student_id),p]));
    const txByStudent=new Map<string,any[]>();
    for(const t of transactions){
      if(!txByStudent.has(t.student_id)) txByStudent.set(t.student_id,[]);
      txByStudent.get(t.student_id)!.push(t);
    }

    const studentRows=students.map((s:any)=>{
      const profile=profileMap.get(s.id);
      const tx=txByStudent.get(s.id)||[];
      const summary=summarizeTransactions(tx);
      return {
        id:s.id,
        code:s.code,
        name:s.name,
        courseId:s.courses?.id||s.course_id||null,
        course:s.courses?.name||"بدون كورس",
        currency:profile?.currency||"EGP",
        sessionPrice:num(profile?.session_price),
        ...summary,
        transactions:tx
      };
    });

    const courseMap=new Map<string,any>();
    for(const row of studentRows){
      const key=`${row.courseId||row.course}:${row.currency}`;
      if(!courseMap.has(key)){
        courseMap.set(key,{
          key,
          courseId:row.courseId,
          course:row.course,
          currency:row.currency,
          studentsCount:0,
          payments:0,
          charges:0,
          balance:0,
          sessionCount:0,
          owed:0,
          credit:0
        });
      }
      const c=courseMap.get(key);
      c.studentsCount++;
      c.payments+=row.payments;
      c.charges+=row.charges;
      c.balance+=row.balance;
      c.sessionCount+=row.sessionCount;
      if(row.balance<0) c.owed+=Math.abs(row.balance);
      else c.credit+=row.balance;
    }

    return NextResponse.json({
      mode:"online",
      students:studentRows,
      courses:Array.from(courseMap.values())
    });
  }catch(error:any){
    return NextResponse.json({error:error.message||"FINANCE_REPORT_FAILED"},{status:500});
  }
}
