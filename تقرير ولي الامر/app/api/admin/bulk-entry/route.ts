import {NextResponse} from "next/server";
import {dbConfigured,dbDelete,dbInsert,dbSelect} from "@/lib/server/db";
import {requireAdminApi,getAdminSession,hasPermission} from "@/lib/server/admin-auth";
import {addPayment,syncReportSessionCharges} from "@/lib/server/billing";
import {adminAudit} from "@/lib/server/admin-audit";

function weekBounds(date:string){
  const d=new Date(`${date}T12:00:00Z`);
  if(Number.isNaN(d.getTime())) throw new Error("INVALID_DATE");
  const day=d.getUTCDay();
  const diff=(day+6)%7;
  const start=new Date(d); start.setUTCDate(d.getUTCDate()-diff);
  const end=new Date(start); end.setUTCDate(start.getUTCDate()+6);
  return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}

async function ensureReport(studentId:string,date:string){
  const {start,end}=weekBounds(date);
  const rows=await dbSelect("weekly_reports",`select=id,status&student_id=eq.${encodeURIComponent(studentId)}&week_start=eq.${start}&week_end=eq.${end}&limit=1`);
  if(rows[0]) return rows[0].id as string;
  const inserted=await dbInsert("weekly_reports",{
    student_id:studentId,
    week_label:`أسبوع ${start}`,
    week_start:start,
    week_end:end,
    status:"draft"
  });
  return inserted[0].id as string;
}

export async function POST(req:Request){
  const denied=await requireAdminApi();
  if(denied) return denied;
  if(!dbConfigured) return NextResponse.json({mode:"demo",saved:true,count:0});
  try{
    const body=await req.json();
    const type=String(body.type||"");
    const rows=Array.isArray(body.rows)?body.rows:[];
    const session=await getAdminSession();
    const needed:any=type==="attendance"?"data_entry.attendance":type==="homework"?"data_entry.homework":type==="exam"?"data_entry.exams":type==="finance"?"data_entry.finance":null;
    if(!needed||!session||!hasPermission(session,needed)) return NextResponse.json({error:"FORBIDDEN"},{status:403});
    if(!["attendance","homework","exam","finance"].includes(type)) return NextResponse.json({error:"INVALID_TYPE"},{status:400});

    let saved=0;
    for(const row of rows){
      const studentId=String(row.studentId||"");
      const date=String(row.date||new Date().toISOString().slice(0,10));
      if(!studentId||!date) continue;

      if(type==="finance"){
        const amount=Number(row.amount||0);
        if(amount>0){
          await addPayment({studentId,amount,date,note:String(row.note||"")||"إدخال جماعي"});
          saved++;
        }
        continue;
      }

      const reportId=await ensureReport(studentId,date);
      if(type==="attendance"){
        const status=String(row.status||"");
        if(!["present","absent","late"].includes(status)) continue;
        await dbDelete("attendance_entries",`report_id=eq.${encodeURIComponent(reportId)}&date=eq.${date}`);
        await dbInsert("attendance_entries",{report_id:reportId,date,status,note:String(row.note||"")||null});
        await syncReportSessionCharges(studentId,reportId);
        saved++;
      }else if(type==="homework"){
        const title=String(row.title||"").trim();
        if(!title) continue;
        const status=String(row.status||"completed");
        const score=status==="not_done"?null:(row.score===""||row.score==null?null:Number(row.score));
        const maxScore=status==="not_done"?null:(row.maxScore===""||row.maxScore==null?null:Number(row.maxScore));
        await dbDelete("homework_entries",`report_id=eq.${encodeURIComponent(reportId)}&title=eq.${encodeURIComponent(title)}&due_date=eq.${date}`);
        await dbInsert("homework_entries",{report_id:reportId,title,due_date:date,status,score,max_score:maxScore});
        saved++;
      }else if(type==="exam"){
        const title=String(row.title||"").trim();
        const status=String(row.status||"completed");
        if(!title) continue;
        const old=await dbSelect("exam_entries",`select=id&report_id=eq.${encodeURIComponent(reportId)}&title=eq.${encodeURIComponent(title)}&date=eq.${date}`);
        for(const e of old) await dbDelete("exam_entries",`id=eq.${encodeURIComponent(e.id)}`);
        if(status==="not_done"){
          await dbInsert("exam_entries",{report_id:reportId,title,date,score:0,max_score:1600,status:"not_done"});
          saved++;
          continue;
        }
        const reading=Number(row.reading),writing=Number(row.writing);
        if(!Number.isFinite(reading)||!Number.isFinite(writing)||reading<0||writing<0) continue;
        const score=(reading+writing)*10;
        const maxScore=1600;
        const inserted=await dbInsert("exam_entries",{report_id:reportId,title,date,score,max_score:maxScore,status:"completed"});
        const examId=inserted[0].id;
        await dbInsert("exam_sections",[
          {exam_id:examId,name:"Reading",score:reading,max_score:80},
          {exam_id:examId,name:"Writing",score:writing,max_score:80}
        ]);
        saved++;
      }
    }
    await adminAudit("bulk.entry",type,undefined,{count:saved});
    return NextResponse.json({saved:true,count:saved});
  }catch(error:any){
    return NextResponse.json({error:error.message||"BULK_ENTRY_FAILED"},{status:500});
  }
}
