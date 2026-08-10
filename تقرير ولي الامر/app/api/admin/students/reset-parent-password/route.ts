import {NextResponse} from "next/server";
import {dbConfigured,dbSelect,dbUpdate} from "@/lib/server/db";
import {requireAdminApi} from "@/lib/server/admin-auth";
import {hashPassword} from "@/lib/server/auth";
import {makeTempPassword} from "@/lib/server/student-service";

export async function POST(req:Request){
  const denied=await requireAdminApi("students.password");
  if(denied) return denied;
  if(!dbConfigured) return NextResponse.json({mode:"demo",password:"PARENT-DEMO"});
  try{
    const body=await req.json();
    const studentId=String(body.studentId||"");
    if(!studentId) return NextResponse.json({error:"MISSING_STUDENT_ID"},{status:400});

    const links=await dbSelect(
      "student_parents",
      `select=parent_id,relation_order,parent_accounts(id,parent_code,name,phone)&student_id=eq.${encodeURIComponent(studentId)}&relation_order=eq.1&limit=1`
    );
    const link=links[0];
    const parentId=link?.parent_accounts?.id||link?.parent_id;
    if(!parentId) return NextResponse.json({error:"PARENT_NOT_FOUND"},{status:404});

    const password=makeTempPassword();
    await dbUpdate(
      "parent_accounts",
      `id=eq.${encodeURIComponent(parentId)}`,
      {password_hash:hashPassword(password),is_active:true}
    );

    return NextResponse.json({
      saved:true,
      password,
      parentCode:link?.parent_accounts?.parent_code||"",
      parentName:link?.parent_accounts?.name||"",
      parentPhone:link?.parent_accounts?.phone||""
    });
  }catch(error:any){
    return NextResponse.json({error:error?.message||"RESET_PASSWORD_FAILED"},{status:500});
  }
}
