import {NextResponse} from "next/server";
import {dbConfigured,dbSelect} from "@/lib/server/db";
import {requireAdminApi} from "@/lib/server/admin-auth";

export async function GET(){
  const adminDenied=await requireAdminApi("students.view");
  if(adminDenied) return adminDenied;
  if(!dbConfigured) return NextResponse.json({mode:"demo",rows:[]});
  const students=await dbSelect("students","select=id,code,name,courses(name),student_parents(relation_order,parent_accounts(id,parent_code,name,phone))&order=name.asc");
  const rows:any[]=[];
  for(const s of students){
    for(const link of s.student_parents||[]){
      const p=link.parent_accounts;
      if(!p) continue;
      rows.push({
        parentCode:p.parent_code||`PR-${String(p.id).slice(0,8).toUpperCase()}`,
        parentName:p.name,
        parentPhone:p.phone,
        studentCode:s.code,
        studentName:s.name,
        course:s.courses?.name||"",
        relation:link.relation_order
      });
    }
  }
  return NextResponse.json({mode:"online",rows});
}
