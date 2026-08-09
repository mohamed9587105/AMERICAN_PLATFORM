import {NextResponse} from "next/server";
import {dbConfigured,dbDelete,dbInsert,dbSelect,dbUpdate} from "@/lib/server/db";
import {createStudentWithParents,resolveCourse,makeParentCode} from "@/lib/server/student-service";
import {hashPassword} from "@/lib/server/auth";

export async function GET(){
  if(!dbConfigured) return NextResponse.json({mode:"demo",students:[]});
  const raw=await dbSelect("students","select=*,courses(id,name,slug,exam_type),student_parents(relation_order,parent_accounts(id,parent_code,name,phone,is_active))&order=name.asc");
  const students=raw.map((s:any)=>({...s,course_name:s.courses?.name||""}));
  return NextResponse.json({mode:"online",students});
}

export async function POST(req:Request){
  if(!dbConfigured) return NextResponse.json({mode:"demo",saved:false});
  const body=await req.json();
  try{
    const created=await createStudentWithParents(body);
    return NextResponse.json({saved:true,student:created.student,credentials:created.credentials});
  }catch(err:any){
    return NextResponse.json({error:err?.message||"CREATE_STUDENT_FAILED"},{status:400});
  }
}

export async function PATCH(req:Request){
  if(!dbConfigured) return NextResponse.json({mode:"demo",saved:false});
  const body=await req.json();
  if(!body.id) return NextResponse.json({error:"MISSING_ID"},{status:400});

  const patch:any={};
  for(const [src,dst] of [
    ["name","name"],["phone","phone"],["reportVisible","report_visible"]
  ] as const){
    if(body[src]!==undefined) patch[dst]=body[src];
  }
  if(body.course!==undefined){
    const course=await resolveCourse(String(body.course));
    patch.course_id=course.id;
  }
  if(Object.keys(patch).length){
    await dbUpdate("students",`id=eq.${encodeURIComponent(body.id)}`,patch);
  }

  async function upsertParent(order:1|2,payload:any){
    if(!payload) return;

    const links=await dbSelect(
      "student_parents",
      `select=parent_id,relation_order&student_id=eq.${encodeURIComponent(body.id)}&relation_order=eq.${order}&limit=1`
    );
    const link=links[0];

    if(link){
      const parentPatch:any={};
      if(payload.name!==undefined && String(payload.name).trim()) parentPatch.name=String(payload.name).trim();
      if(payload.phone!==undefined && String(payload.phone).trim()) parentPatch.phone=String(payload.phone).replace(/\D/g,"");
      if(payload.password!==undefined && String(payload.password).trim()){
        parentPatch.password_hash=hashPassword(String(payload.password).trim());
      }
      if(Object.keys(parentPatch).length){
        await dbUpdate("parent_accounts",`id=eq.${encodeURIComponent(link.parent_id)}`,parentPatch);
      }
      return;
    }

    const phone=String(payload.phone||"").replace(/\D/g,"");
    if(!phone) return;

    const existing=await dbSelect(
      "parent_accounts",
      `select=id,parent_code&phone=eq.${encodeURIComponent(phone)}&limit=1`
    );

    let parentId=existing[0]?.id;
    if(!parentId){
      const password=String(payload.password||"").trim();
      if(!password) throw new Error("PARENT_PASSWORD_REQUIRED");

      let parentCode="";
      for(let i=0;i<8;i++){
        const candidate=makeParentCode();
        const exists=await dbSelect(
          "parent_accounts",
          `select=id&parent_code=eq.${encodeURIComponent(candidate)}&limit=1`
        );
        if(!exists.length){parentCode=candidate;break}
      }
      if(!parentCode) throw new Error("PARENT_CODE_GENERATION_FAILED");

      const rows=await dbInsert("parent_accounts",{
        parent_code:parentCode,
        name:String(payload.name||"ولي الأمر").trim()||"ولي الأمر",
        phone,
        password_hash:hashPassword(password),
        is_active:true
      });
      parentId=rows[0].id;
    }else if(payload.password && String(payload.password).trim()){
      await dbUpdate(
        "parent_accounts",
        `id=eq.${encodeURIComponent(parentId)}`,
        {password_hash:hashPassword(String(payload.password).trim())}
      );
    }

    await dbInsert("student_parents",{
      student_id:body.id,
      parent_id:parentId,
      relation_order:order
    });
  }

  await upsertParent(1,body.parent1);
  await upsertParent(2,body.parent2);

  return NextResponse.json({saved:true});
}

export async function DELETE(req:Request){
  if(!dbConfigured) return NextResponse.json({mode:"demo",deleted:false});
  const {searchParams}=new URL(req.url);
  const id=searchParams.get("id");
  if(!id) return NextResponse.json({error:"MISSING_ID"},{status:400});
  await dbDelete("students",`id=eq.${encodeURIComponent(id)}`);
  return NextResponse.json({deleted:true});
}
