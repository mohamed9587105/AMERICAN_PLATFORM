import {NextResponse} from "next/server";
import {dbConfigured,dbSelect} from "@/lib/server/db";
import {requireAdminApi} from "@/lib/server/admin-auth";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(){
  const adminDenied=await requireAdminApi("students.view");
  if(adminDenied) return adminDenied;
  if(!dbConfigured){
    return NextResponse.json({
      mode:"demo",
      students:[
        {id:"std_001",code:"ST-0001",name:"محمود أحمد",phone:"01012345678",course:"EST",parentName:"أحمد محمد",parentPhone:"01098765432",reportVisible:true,createdAt:"2026-08-10T08:30:00.000Z"},
        {id:"std_002",code:"ST-0002",name:"سارة أحمد",phone:"01122334455",course:"Beginners 1",parentName:"أحمد محمد",parentPhone:"01098765432",reportVisible:true,createdAt:"2026-08-09T09:15:00.000Z"},
        {id:"std_003",code:"ST-0003",name:"يوسف علي",phone:"01233445566",course:"SAT",parentName:"علي محمود",parentPhone:"01299887766",reportVisible:false,createdAt:"2026-08-08T10:00:00.000Z"}
      ]
    });
  }

  try{
    const students=await dbSelect(
      "students",
      "select=id,code,name,phone,report_visible,created_at,course_id,courses(id,name,slug,exam_type),student_parents(relation_order,parent_accounts(id,name,phone))&order=name.asc"
    );

    const rows=students.map((s:any)=>{
      const links=Array.isArray(s.student_parents)?s.student_parents:[];
      const first=[...links].sort((a:any,b:any)=>Number(a.relation_order||0)-Number(b.relation_order||0))[0];
      return {
        id:s.id,
        code:s.code||"",
        name:s.name||"",
        phone:s.phone||"",
        course:s.courses?.name||"",
        courseId:s.courses?.id||s.course_id||null,
        parentName:first?.parent_accounts?.name||"",
        parentPhone:first?.parent_accounts?.phone||"",
        reportVisible:s.report_visible!==false,
        createdAt:s.created_at||null
      };
    });

    return NextResponse.json({mode:"online",students:rows});
  }catch(error:any){
    return NextResponse.json({error:error.message||"ALL_STUDENTS_FAILED"},{status:500});
  }
}
