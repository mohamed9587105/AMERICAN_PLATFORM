import "server-only";
import crypto from "crypto";
import {dbInsert,dbSelect,dbUpdate} from "@/lib/server/db";
import {hashPassword} from "@/lib/server/auth";

export type NewStudentInput={
  code?:string;
  name:string;
  phone?:string;
  course:string;
  parentName:string;
  parentPhone:string;
  parentPassword?:string;
  parent2Name?:string;
  parent2Phone?:string;
  parent2Password?:string;
  reportVisible?:boolean;
};

const digits=(n=4)=>String(crypto.randomInt(0,10**n)).padStart(n,"0");
export const makeStudentCode=()=>`ST-${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth()+1).padStart(2,"0")}-${digits(4)}`;
export const makeParentCode=()=>`PR-${digits(6)}`;
export const makeTempPassword=()=>crypto.randomBytes(4).toString("hex").toUpperCase();

async function uniqueCode(table:"students"|"parent_accounts",field:"code"|"parent_code",maker:()=>string){
  for(let i=0;i<8;i++){
    const code=maker();
    const rows=await dbSelect(table,`select=id&${field}=eq.${encodeURIComponent(code)}&limit=1`);
    if(!rows.length) return code;
  }
  throw new Error("CODE_GENERATION_FAILED");
}

async function ensureParent(name:string,phone:string,password?:string){
  const cleanPhone=phone.replace(/\D/g,"");
  const existing=await dbSelect("parent_accounts",`select=id,name,phone,parent_code&phone=eq.${encodeURIComponent(cleanPhone)}&limit=1`);
  if(existing[0]){
    let code=existing[0].parent_code as string|undefined;
    if(!code){
      code=await uniqueCode("parent_accounts","parent_code",makeParentCode);
      await dbUpdate("parent_accounts",`id=eq.${encodeURIComponent(existing[0].id)}`,{parent_code:code});
    }
    return {parent:existing[0],parentCode:code,password:"",isNew:false};
  }
  const parentCode=await uniqueCode("parent_accounts","parent_code",makeParentCode);
  const plain=password?.trim()||makeTempPassword();
  const rows=await dbInsert("parent_accounts",{
    parent_code:parentCode,
    name:name.trim()||"ولي الأمر",
    phone:cleanPhone,
    password_hash:hashPassword(plain),
    is_active:true
  });
  return {parent:rows[0],parentCode,password:plain,isNew:true};
}

export async function resolveCourse(input:string){
  const raw=input.trim();
  if(!raw) throw new Error("COURSE_REQUIRED");

  const byName=await dbSelect("courses",`select=id,name,slug,exam_type&name=ilike.${encodeURIComponent(raw)}&is_active=eq.true&limit=1`);
  if(byName[0]) return byName[0];

  const normalized=raw.toLowerCase().replace(/\s+/g,"-");
  const bySlug=await dbSelect("courses",`select=id,name,slug,exam_type&slug=eq.${encodeURIComponent(normalized)}&is_active=eq.true&limit=1`);
  if(bySlug[0]) return bySlug[0];

  const examAlias:Record<string,string>={
    "sat":"SAT",
    "sat advanced":"SAT",
    "est":"EST",
    "est advanced":"EST",
  };
  const examType=examAlias[raw.toLowerCase()];
  if(examType){
    const rows=await dbSelect("courses",`select=id,name,slug,exam_type&exam_type=eq.${encodeURIComponent(examType)}&is_active=eq.true&order=sort_order.asc&limit=1`);
    if(rows[0]) return rows[0];
  }

  throw new Error(`COURSE_NOT_FOUND:${raw}`);
}

export async function createStudentWithParents(input:NewStudentInput){
  const requested=input.code?.trim();
  let studentCode=requested||await uniqueCode("students","code",makeStudentCode);
  if(requested){
    const exists=await dbSelect("students",`select=id,code,name&code=eq.${encodeURIComponent(requested)}&limit=1`);
    if(exists[0]) throw new Error(`DUPLICATE_STUDENT_CODE:${requested}`);
  }

  const course=await resolveCourse(input.course);
  const studentRows=await dbInsert("students",{
    code:studentCode,
    name:input.name.trim(),
    phone:input.phone?.trim()||null,
    course_id:course.id,
    report_visible:input.reportVisible!==false
  });
  const student={...studentRows[0],course_name:course.name,course};

  const p1=await ensureParent(input.parentName,input.parentPhone,input.parentPassword);
  await dbInsert("student_parents",{student_id:student.id,parent_id:p1.parent.id,relation_order:1});

  let p2:any=null;
  if(input.parent2Phone?.trim()){
    p2=await ensureParent(input.parent2Name||"ولي الأمر الثاني",input.parent2Phone,input.parent2Password);
    await dbInsert("student_parents",{student_id:student.id,parent_id:p2.parent.id,relation_order:2});
  }

  return {
    student,
    credentials:[
      {relation:1,name:input.parentName,phone:input.parentPhone,parentCode:p1.parentCode,password:p1.password,isNew:p1.isNew},
      ...(p2?[{relation:2,name:input.parent2Name||"ولي الأمر الثاني",phone:input.parent2Phone,parentCode:p2.parentCode,password:p2.password,isNew:p2.isNew}]:[])
    ]
  };
}
