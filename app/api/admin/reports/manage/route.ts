import {NextResponse} from "next/server";
import {dbConfigured,dbDelete,dbSelect,dbUpdate} from "@/lib/server/db";

export async function GET(req:Request){
  const {searchParams}=new URL(req.url);
  const studentId=searchParams.get("studentId");
  if(!dbConfigured) return NextResponse.json({mode:"demo",reports:[]});

  let query="select=*,students(id,name,code,report_visible,courses(name)),attendance_entries(*),homework_entries(*),exam_entries(*,exam_sections(*)),finance_entries(*)&order=week_start.desc";
  if(studentId) query+=`&student_id=eq.${encodeURIComponent(studentId)}`;
  const raw=await dbSelect("weekly_reports",query);
  const reports=raw.map((r:any)=>({
    ...r,
    students:r.students?{...r.students,course_name:r.students.courses?.name||""}:r.students
  }));
  return NextResponse.json({mode:"online",reports});
}

export async function PATCH(req:Request){
  const body=await req.json();
  if(!body.id) return NextResponse.json({error:"MISSING_ID"},{status:400});
  if(!dbConfigured) return NextResponse.json({mode:"demo",saved:false});

  const patch:any={};
  if(body.weekLabel!==undefined) patch.week_label=body.weekLabel;
  if(body.weekStart!==undefined) patch.week_start=body.weekStart;
  if(body.weekEnd!==undefined) patch.week_end=body.weekEnd;
  if(body.teacherNote!==undefined) patch.teacher_note=body.teacherNote;
  if(body.followupNote!==undefined) patch.followup_note=body.followupNote;
  if(body.nextWeekPlan!==undefined) patch.next_week_plan=body.nextWeekPlan;
  if(body.status!==undefined){
    patch.status=body.status;
    patch.published_at=body.status==="published"?new Date().toISOString():null;
  }
  if(Object.keys(patch).length){
    await dbUpdate("weekly_reports",`id=eq.${encodeURIComponent(body.id)}`,patch);
  }
  if(body.studentReportVisible!==undefined && body.studentId){
    await dbUpdate("students",`id=eq.${encodeURIComponent(body.studentId)}`,{
      report_visible:Boolean(body.studentReportVisible)
    });
  }
  return NextResponse.json({saved:true});
}

export async function DELETE(req:Request){
  const {searchParams}=new URL(req.url);
  const id=searchParams.get("id");
  if(!id) return NextResponse.json({error:"MISSING_ID"},{status:400});
  if(!dbConfigured) return NextResponse.json({mode:"demo",deleted:false});
  await dbDelete("weekly_reports",`id=eq.${encodeURIComponent(id)}`);
  return NextResponse.json({deleted:true});
}
