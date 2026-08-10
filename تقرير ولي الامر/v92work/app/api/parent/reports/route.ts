export const dynamic="force-dynamic";
export const revalidate=0;
import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {dbConfigured,dbSelect} from "@/lib/server/db";
import {readSession} from "@/lib/server/auth";

export async function GET(req:Request){
  const jar=await cookies();
  const cookieToken=jar.get("parent_session")?.value;
  const authHeader=req.headers.get("authorization")||"";
  const bearerToken=authHeader.toLowerCase().startsWith("bearer ")?authHeader.slice(7).trim():"";
  const session=readSession(cookieToken||bearerToken);
  if(!session||session.type!=="parent") return NextResponse.json({error:"UNAUTHORIZED"},{status:401});

  if(!dbConfigured){
    return NextResponse.json({mode:"demo",reports:[]});
  }

  const links=await dbSelect("student_parents",`select=student_id&parent_id=eq.${encodeURIComponent(session.parentId)}`);
  const ids=links.map((x:any)=>x.student_id);
  if(!ids.length) return NextResponse.json({reports:[]});

  const reports=await dbSelect("weekly_reports",
    `select=*,students!inner(id,name,code,report_visible,courses(name)),attendance_entries(*),homework_entries(*),exam_entries(*,exam_sections(*)),finance_entries(*)&student_id=in.(${ids.join(",")})&status=eq.published&order=week_start.desc`
  );
  const normalized=reports.map((r:any)=>({
    ...r,
    students:r.students?{...r.students,course_name:r.students.courses?.name||""}:r.students
  }));
  const visible=normalized.filter((r:any)=>r.students?.report_visible!==false);
  return NextResponse.json({reports:visible});
}
