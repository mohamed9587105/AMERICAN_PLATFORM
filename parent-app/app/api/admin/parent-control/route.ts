import {NextResponse} from "next/server";
import {dbConfigured,dbDelete,dbInsert,dbSelect,dbUpdate} from "@/lib/server/db";
import {requireAdminApi} from "@/lib/server/admin-auth";
import {syncReportSessionCharges} from "@/lib/server/billing";

function weekBounds(date:string){
  const d=new Date(`${date}T12:00:00Z`);
  if(Number.isNaN(d.getTime())) throw new Error("INVALID_DATE");
  const day=d.getUTCDay(),diff=(day+6)%7;
  const start=new Date(d);start.setUTCDate(d.getUTCDate()-diff);
  const end=new Date(start);end.setUTCDate(start.getUTCDate()+6);
  return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}
async function ensureReport(studentId:string,date:string){
  const {start,end}=weekBounds(date);
  const rows=await dbSelect("weekly_reports",`select=*&student_id=eq.${encodeURIComponent(studentId)}&week_start=eq.${start}&week_end=eq.${end}&limit=1`);
  if(rows[0])return rows[0];
  const inserted=await dbInsert("weekly_reports",{student_id:studentId,week_label:`أسبوع ${start}`,week_start:start,week_end:end,status:"draft"});
  return inserted[0];
}
async function loadStudent(studentId:string){
  const students=await dbSelect("students",`select=id,code,name,phone,report_visible,created_at,course_id,courses(id,name,slug,exam_type),student_parents(relation_order,parent_accounts(id,parent_code,name,phone,is_active))&id=eq.${encodeURIComponent(studentId)}&limit=1`);
  const student=students[0]||null;
  const reports=await dbSelect("weekly_reports",`select=*,attendance_entries(*),homework_entries(*),exam_entries(*,exam_sections(*)),finance_entries(*)&student_id=eq.${encodeURIComponent(studentId)}&order=week_start.desc`);
  const events=await dbSelect("student_schedule_events",`select=*&student_id=eq.${encodeURIComponent(studentId)}&order=event_at.desc`);
  return {student,reports,events};
}

export async function GET(req:Request){
  const denied=await requireAdminApi("dashboard.view");if(denied)return denied;
  if(!dbConfigured)return NextResponse.json({student:null,reports:[],events:[]});
  const studentId=new URL(req.url).searchParams.get("studentId")||"";
  if(!studentId)return NextResponse.json({error:"MISSING_STUDENT_ID"},{status:400});
  return NextResponse.json(await loadStudent(studentId));
}

export async function POST(req:Request){
  const denied=await requireAdminApi("dashboard.view");if(denied)return denied;
  try{
    const b=await req.json();const action=String(b.action||"");const studentId=String(b.studentId||"");
    if(!studentId)return NextResponse.json({error:"MISSING_STUDENT_ID"},{status:400});

    if(action==="attendance"){
      const date=String(b.date||"");if(!date)return NextResponse.json({error:"MISSING_DATE"},{status:400});
      const report=await ensureReport(studentId,date);
      const rows=await dbInsert("attendance_entries",{report_id:report.id,date,status:b.status||"present",note:b.note||null});
      await syncReportSessionCharges(studentId,report.id);
      return NextResponse.json({saved:true,row:rows[0]});
    }
    if(action==="homework"){
      const date=String(b.dueDate||new Date().toISOString().slice(0,10));
      const report=await ensureReport(studentId,date);
      const rows=await dbInsert("homework_entries",{report_id:report.id,title:b.title,due_date:date,status:b.status||"completed",score:b.score===""?null:Number(b.score),max_score:b.maxScore===""?null:Number(b.maxScore)});
      return NextResponse.json({saved:true,row:rows[0]});
    }
    if(action==="exam"){
      const date=String(b.date||new Date().toISOString().slice(0,10));
      const report=await ensureReport(studentId,date);
      const status=String(b.status||"completed");
      let exam:any;
      if(status==="not_done"){
        exam=(await dbInsert("exam_entries",{report_id:report.id,title:b.title,date,score:0,max_score:1600,status:"not_done"}))[0];
      }else{
        const reading=Number(b.reading||0),writing=Number(b.writing||0),total=(reading+writing)*10;
        exam=(await dbInsert("exam_entries",{report_id:report.id,title:b.title,date,score:total,max_score:1600,status:"completed"}))[0];
        await dbInsert("exam_sections",[
          {exam_id:exam.id,name:"Reading",score:reading,max_score:80},
          {exam_id:exam.id,name:"Writing",score:writing,max_score:80}
        ]);
      }
      return NextResponse.json({saved:true,row:exam});
    }
    if(action==="report"){
      const date=String(b.weekStart||new Date().toISOString().slice(0,10));
      const report=await ensureReport(studentId,date);
      await dbUpdate("weekly_reports",`id=eq.${encodeURIComponent(report.id)}`,{
        week_label:b.weekLabel||report.week_label,
        teacher_note:b.teacherNote||null,
        followup_note:b.followupNote||null,
        next_week_plan:b.nextWeekPlan||null,
        status:b.status||report.status||"draft",
        published_at:(b.status==="published")?new Date().toISOString():report.published_at||null
      });
      return NextResponse.json({saved:true,reportId:report.id});
    }
    if(action==="event"){
      const rows=await dbInsert("student_schedule_events",{student_id:studentId,event_type:b.eventType||"class",title:b.title,event_at:b.eventAt,note:b.note||null,is_active:true});
      return NextResponse.json({saved:true,row:rows[0]});
    }
    return NextResponse.json({error:"INVALID_ACTION"},{status:400});
  }catch(e:any){return NextResponse.json({error:String(e?.message||"").includes("PGRST205")?"قاعدة البيانات غير مجهزة لمواعيد تطبيق ولي الأمر. شغّل ملف V121_PARENT_CONTROL_DATABASE_SETUP.sql في Supabase SQL Editor.":e?.message||"PARENT_CONTROL_POST_FAILED"},{status:500})}
}

export async function PATCH(req:Request){
  const denied=await requireAdminApi("dashboard.view");if(denied)return denied;
  try{
    const b=await req.json();const kind=String(b.kind||"");const id=String(b.id||"");
    if(!id)return NextResponse.json({error:"MISSING_ID"},{status:400});
    if(kind==="attendance"){
      await dbUpdate("attendance_entries",`id=eq.${encodeURIComponent(id)}`,{date:b.date,status:b.status,note:b.note||null});
      if(b.studentId&&b.reportId)await syncReportSessionCharges(String(b.studentId),String(b.reportId));
    }else if(kind==="homework"){
      await dbUpdate("homework_entries",`id=eq.${encodeURIComponent(id)}`,{title:b.title,due_date:b.dueDate||null,status:b.status,score:b.score===""?null:Number(b.score),max_score:b.maxScore===""?null:Number(b.maxScore)});
    }else if(kind==="exam"){
      const status=String(b.status||"completed");
      if(status==="not_done"){
        await dbUpdate("exam_entries",`id=eq.${encodeURIComponent(id)}`,{title:b.title,date:b.date,score:0,max_score:1600,status:"not_done"});
        await dbDelete("exam_sections",`exam_id=eq.${encodeURIComponent(id)}`);
      }else{
        const reading=Number(b.reading||0),writing=Number(b.writing||0),total=(reading+writing)*10;
        await dbUpdate("exam_entries",`id=eq.${encodeURIComponent(id)}`,{title:b.title,date:b.date,score:total,max_score:1600,status:"completed"});
        await dbDelete("exam_sections",`exam_id=eq.${encodeURIComponent(id)}`);
        await dbInsert("exam_sections",[
          {exam_id:id,name:"Reading",score:reading,max_score:80},
          {exam_id:id,name:"Writing",score:writing,max_score:80}
        ]);
      }
    }else if(kind==="event"){
      await dbUpdate("student_schedule_events",`id=eq.${encodeURIComponent(id)}`,{event_type:b.eventType,title:b.title,event_at:b.eventAt,note:b.note||null,is_active:b.isActive!==false});
    }else if(kind==="report"){
      await dbUpdate("weekly_reports",`id=eq.${encodeURIComponent(id)}`,{
        week_label:b.weekLabel,teacher_note:b.teacherNote||null,followup_note:b.followupNote||null,next_week_plan:b.nextWeekPlan||null,
        status:b.status||"draft",published_at:b.status==="published"?new Date().toISOString():null
      });
    }else return NextResponse.json({error:"INVALID_KIND"},{status:400});
    return NextResponse.json({saved:true});
  }catch(e:any){return NextResponse.json({error:String(e?.message||"").includes("PGRST205")?"قاعدة البيانات غير مجهزة لمواعيد تطبيق ولي الأمر. شغّل ملف V121_PARENT_CONTROL_DATABASE_SETUP.sql في Supabase SQL Editor.":e?.message||"PARENT_CONTROL_PATCH_FAILED"},{status:500})}
}

export async function DELETE(req:Request){
  const denied=await requireAdminApi("dashboard.view");if(denied)return denied;
  try{
    const u=new URL(req.url),kind=u.searchParams.get("kind")||"",id=u.searchParams.get("id")||"";
    if(!id)return NextResponse.json({error:"MISSING_ID"},{status:400});
    if(kind==="attendance"){
      const rows=await dbSelect("attendance_entries",`select=id,report_id,weekly_reports(student_id)&id=eq.${encodeURIComponent(id)}&limit=1`);
      const row=rows[0];
      await dbDelete("attendance_entries",`id=eq.${encodeURIComponent(id)}`);
      const studentId=row?.weekly_reports?.student_id;
      if(studentId&&row?.report_id)await syncReportSessionCharges(String(studentId),String(row.report_id));
    }
    else if(kind==="homework")await dbDelete("homework_entries",`id=eq.${encodeURIComponent(id)}`);
    else if(kind==="exam")await dbDelete("exam_entries",`id=eq.${encodeURIComponent(id)}`);
    else if(kind==="event")await dbDelete("student_schedule_events",`id=eq.${encodeURIComponent(id)}`);
    else if(kind==="report")await dbDelete("weekly_reports",`id=eq.${encodeURIComponent(id)}`);
    else return NextResponse.json({error:"INVALID_KIND"},{status:400});
    return NextResponse.json({deleted:true});
  }catch(e:any){return NextResponse.json({error:String(e?.message||"").includes("PGRST205")?"قاعدة البيانات غير مجهزة لمواعيد تطبيق ولي الأمر. شغّل ملف V121_PARENT_CONTROL_DATABASE_SETUP.sql في Supabase SQL Editor.":e?.message||"PARENT_CONTROL_DELETE_FAILED"},{status:500})}
}
