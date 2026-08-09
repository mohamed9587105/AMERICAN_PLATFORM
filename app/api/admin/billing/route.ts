import {NextResponse} from "next/server";
import {dbConfigured,dbDelete,dbSelect,dbUpdate} from "@/lib/server/db";
import {addPayment,ensureBillingProfile,getBillingSummary,updateBillingProfile} from "@/lib/server/billing";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(req:Request){
  if(!dbConfigured) return NextResponse.json({mode:"demo"});
  try{
    const {searchParams}=new URL(req.url);
    const studentId=searchParams.get("studentId");
    if(!studentId) return NextResponse.json({error:"MISSING_STUDENT_ID"},{status:400});
    const summary=await getBillingSummary(studentId);
    return NextResponse.json({mode:"online",...summary});
  }catch(error:any){
    return NextResponse.json({error:error.message||"BILLING_GET_FAILED"},{status:500});
  }
}

export async function POST(req:Request){
  if(!dbConfigured) return NextResponse.json({mode:"demo",saved:false});
  try{
    const body=await req.json();
    if(!body.studentId) return NextResponse.json({error:"MISSING_STUDENT_ID"},{status:400});

    if(body.action==="profile"){
      await updateBillingProfile(body.studentId,{
        currency:body.currency,
        sessionPrice:Number(body.sessionPrice),
        autoCharge:body.autoCharge!==false,
        chargeAbsent:Boolean(body.chargeAbsent)
      });
    }else if(body.action==="payment"){
      await addPayment({
        studentId:body.studentId,
        amount:Number(body.amount),
        date:body.date,
        note:body.note
      });
    }else if(body.action==="editPayment"){
      if(!body.transactionId) return NextResponse.json({error:"MISSING_TRANSACTION_ID"},{status:400});
      const amount=Number(body.amount);
      if(!Number.isFinite(amount)||amount<=0) return NextResponse.json({error:"INVALID_PAYMENT_AMOUNT"},{status:400});

      const current=await dbSelect(
        "financial_transactions",
        `select=id,student_id,transaction_type& id=eq.${encodeURIComponent(body.transactionId)}&student_id=eq.${encodeURIComponent(body.studentId)}&limit=1`.replace("& ","&")
      );
      const tx=current[0];
      if(!tx||tx.transaction_type!=="payment") return NextResponse.json({error:"PAYMENT_NOT_FOUND"},{status:404});

      await dbUpdate(
        "financial_transactions",
        `id=eq.${encodeURIComponent(body.transactionId)}&student_id=eq.${encodeURIComponent(body.studentId)}`,
        {
          amount,
          transaction_date:body.date||new Date().toISOString().slice(0,10),
          note:body.note||null
        }
      );
    }else if(body.action==="deletePayment"){
      if(!body.transactionId) return NextResponse.json({error:"MISSING_TRANSACTION_ID"},{status:400});

      const current=await dbSelect(
        "financial_transactions",
        `select=id,student_id,transaction_type& id=eq.${encodeURIComponent(body.transactionId)}&student_id=eq.${encodeURIComponent(body.studentId)}&limit=1`.replace("& ","&")
      );
      const tx=current[0];
      if(!tx||tx.transaction_type!=="payment") return NextResponse.json({error:"PAYMENT_NOT_FOUND"},{status:404});

      await dbDelete(
        "financial_transactions",
        `id=eq.${encodeURIComponent(body.transactionId)}&student_id=eq.${encodeURIComponent(body.studentId)}`
      );
    }else{
      return NextResponse.json({error:"INVALID_ACTION"},{status:400});
    }

    return NextResponse.json({saved:true,...await getBillingSummary(body.studentId)});
  }catch(error:any){
    const message=error.message||"BILLING_POST_FAILED";
    const status=[
      "USD_ONLY_FOR_SAT",
      "INVALID_SESSION_PRICE",
      "INVALID_PAYMENT_AMOUNT",
      "CANNOT_CHANGE_CURRENCY_WITH_EXISTING_LEDGER"
    ].includes(message)?400:500;
    return NextResponse.json({error:message},{status});
  }
}
