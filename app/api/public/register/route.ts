import {NextResponse} from "next/server";
import {dbConfigured} from "@/lib/server/db";
import {createStudentWithParents} from "@/lib/server/student-service";

export async function POST(req:Request){
  const body=await req.json();
  if(body.website) return NextResponse.json({ok:true}); // honeypot
  const required=[body.name,body.course,body.parentName,body.parentPhone];
  if(required.some(x=>!String(x||"").trim())) return NextResponse.json({error:"اكتب البيانات المطلوبة"},{status:400});
  if(!dbConfigured) return NextResponse.json({error:"الحجز Online غير مفعل بعد. اربط قاعدة البيانات أولًا.",mode:"demo"},{status:503});

  try{
    const created=await createStudentWithParents({
      name:body.name,
      phone:body.phone||"",
      course:body.course,
      parentName:body.parentName,
      parentPhone:body.parentPhone,
      parentPassword:body.parentPassword||"",
      parent2Name:body.parent2Name||"",
      parent2Phone:body.parent2Phone||"",
      parent2Password:body.parent2Password||"",
      reportVisible:true
    });
    return NextResponse.json({ok:true,studentCode:created.student.code,credentials:created.credentials});
  }catch(err:any){
    return NextResponse.json({error:err?.message||"تعذر تسجيل البيانات"},{status:500});
  }
}
