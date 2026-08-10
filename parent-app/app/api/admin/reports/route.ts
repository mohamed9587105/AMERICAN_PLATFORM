import {NextResponse} from "next/server";
import {dbConfigured,dbDelete,dbInsert,dbSelect,dbUpdate} from "@/lib/server/db";
import {syncReportSessionCharges} from "@/lib/server/billing";
import {requireAdminApi} from "@/lib/server/admin-auth";

function invalidScore(score:any,max:any){
  const s=Number(score),m=Number(max);
  return !Number.isFinite(s)||!Number.isFinite(m)||m<=0||s<0||s>m;
}

export async function POST(req:Request){
  const adminDenied=await requireAdminApi("reports.edit");
  if(adminDenied) return adminDenied;
  const body=await req.json();

  for(const h of body.homework||[]){
    if(h.score!==""&&h.maxScore!==""&&invalidScore(h.score,h.maxScore)){
      return NextResponse.json({error:`INVALID_HOMEWORK_SCORE:${h.title}`},{status:400});
    }
  }
  for(const e of body.exams||[]){
    if(invalidScore(e.score,e.maxScore)){
      return NextResponse.json({error:`INVALID_EXAM_SCORE:${e.title}`},{status:400});
    }
  }

  if(!dbConfigured) return NextResponse.json({mode:"demo",published:false,validated:true});

  const existing=await dbSelect(
    "weekly_reports",
    `select=*&student_id=eq.${encodeURIComponent(body.studentId)}&week_start=eq.${encodeURIComponent(body.weekStart)}&week_end=eq.${encodeURIComponent(body.weekEnd)}&limit=1`
  );

  let reportId:string;
  if(existing[0]){
    reportId=existing[0].id;
    await dbUpdate("weekly_reports",`id=eq.${encodeURIComponent(reportId)}`,{
      week_label:body.weekLabel,
      teacher_note:body.notes?.teacher||null,
      followup_note:body.notes?.followup||null,
      next_week_plan:body.notes?.nextWeek||null,
      published_at:new Date().toISOString(),
      status:"published"
    });
    await dbDelete("attendance_entries",`report_id=eq.${encodeURIComponent(reportId)}`);
    await dbDelete("homework_entries",`report_id=eq.${encodeURIComponent(reportId)}`);
    await dbDelete("exam_entries",`report_id=eq.${encodeURIComponent(reportId)}`);
    await dbDelete("finance_entries",`report_id=eq.${encodeURIComponent(reportId)}`);
  }else{
    const reports=await dbInsert("weekly_reports",{
      student_id:body.studentId,
      week_label:body.weekLabel,
      week_start:body.weekStart,
      week_end:body.weekEnd,
      teacher_note:body.notes?.teacher||null,
      followup_note:body.notes?.followup||null,
      next_week_plan:body.notes?.nextWeek||null,
      published_at:new Date().toISOString(),
      status:"published"
    });
    reportId=reports[0].id;
  }

  if(body.attendance?.length){
    await dbInsert("attendance_entries",body.attendance.map((x:any)=>({
      report_id:reportId,date:x.date,status:x.status,note:x.note||null
    })));
  }
  if(body.homework?.length){
    await dbInsert("homework_entries",body.homework.map((x:any)=>({
      report_id:reportId,title:x.title,due_date:x.dueDate||null,status:x.status,
      score:x.score===""?null:Number(x.score),max_score:x.maxScore===""?null:Number(x.maxScore)
    })));
  }
  for(const e of body.exams||[]){
    const rows=await dbInsert("exam_entries",{
      report_id:reportId,title:e.title,date:e.date||null,score:Number(e.score),max_score:Number(e.maxScore)
    });
    const examId=rows[0].id;
    const sections=[
      ["Reading",e.reading,e.readingMax],
      ["Writing",e.writing,e.writingMax],
      ["Vocabulary",e.vocabulary,e.vocabularyMax]
    ].filter(([,s,m])=>s!==""&&m!==""&&!invalidScore(s,m));
    if(sections.length){
      await dbInsert("exam_sections",sections.map(([name,s,m])=>({
        exam_id:examId,name,score:Number(s),max_score:Number(m)
      })));
    }
  }
  // Attendance is now the source of truth for automatic session charges.
  // Present + late are charged. Absent is free unless charge_absent is enabled
  // in the student's billing profile.
  const billing=await syncReportSessionCharges(body.studentId,reportId);

  await dbInsert("finance_entries",{
    report_id:reportId,
    paid:Number(billing.totalPayments||0),
    due:billing.balance<0?Math.abs(Number(billing.balance)):0,
    due_date:body.finance?.dueDate||null,
    note:`الرصيد الحالي: ${billing.balance} ${billing.profile.currency}`
  });

  return NextResponse.json({
    published:true,
    reportId,
    billing:{
      balance:billing.balance,
      currency:billing.profile.currency,
      sessionCount:billing.sessionCount
    }
  });
}
