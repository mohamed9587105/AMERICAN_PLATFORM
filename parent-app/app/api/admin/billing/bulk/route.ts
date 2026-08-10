import {NextResponse} from "next/server";
import {dbConfigured} from "@/lib/server/db";
import {getBillingSummary} from "@/lib/server/billing";
import {requireAnyAdminPermission} from "@/lib/server/admin-auth";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function POST(req:Request){
  const denied=await requireAnyAdminPermission(["finance.view","data_entry.finance"]);
  if(denied) return denied;
  if(!dbConfigured) return NextResponse.json({mode:"demo",rows:[]});
  try{
    const body=await req.json();
    const ids=Array.isArray(body.studentIds)?body.studentIds.map((x:any)=>String(x)).filter(Boolean):[];
    if(!ids.length) return NextResponse.json({rows:[]});

    const rows:any[]=[];
    const concurrency=8;
    for(let start=0;start<ids.length;start+=concurrency){
      const batch=ids.slice(start,start+concurrency);
      const data=await Promise.all(batch.map(async(studentId:string)=>{
        try{
          const summary=await getBillingSummary(studentId);
          const price=Number(summary.profile?.session_price||0);
          const balance=Number(summary.balance||0);
          const remainingSessions=price>0?Math.max(0,Math.floor(balance/price)):0;
          return {
            studentId,
            balance,
            sessionPrice:price,
            remainingSessions,
            currency:summary.profile?.currency||"EGP"
          };
        }catch{
          return {studentId,balance:0,sessionPrice:0,remainingSessions:0,currency:"EGP"};
        }
      }));
      rows.push(...data);
    }
    return NextResponse.json({rows});
  }catch(error:any){
    return NextResponse.json({error:error?.message||"BULK_BILLING_FAILED"},{status:500});
  }
}
