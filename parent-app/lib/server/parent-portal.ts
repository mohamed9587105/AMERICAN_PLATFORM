import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {dbSelect} from "@/lib/server/db";
import {readSession} from "@/lib/server/auth";

export async function getParentContext(sessionParam?:string){
  const jar=await cookies();
  const cookieToken=jar.get("parent_session")?.value||"";
  const queryToken=String(sessionParam||"");
  const token=cookieToken||queryToken;
  const session=readSession(token);

  if(!session||session.type!=="parent"){
    redirect("/parent-login?reason=session");
  }

  const parents=await dbSelect(
    "parent_accounts",
    `select=id,parent_code,name,phone,is_active& id=eq.${encodeURIComponent(session.parentId)}&limit=1`.replace("& ","&")
  );
  const parent=parents[0]||null;

  const links=await dbSelect(
    "student_parents",
    `select=student_id,relation_order,students(id,name,code,report_visible,courses(name))&parent_id=eq.${encodeURIComponent(session.parentId)}&order=relation_order.asc`
  );

  const children=links.map((x:any)=>({
    id:x.students?.id||x.student_id,
    name:x.students?.name||"",
    code:x.students?.code||"",
    course:x.students?.courses?.name||"",
    reportVisible:x.students?.report_visible!==false,
    relationOrder:x.relation_order
  })).filter((x:any)=>x.id&&x.reportVisible);

  return {
    parent,
    children,
    cookieToken,
    queryToken,
    linkToken:cookieToken?"":queryToken
  };
}

export function withSession(path:string,token:string){
  if(!token) return path;
  const sep=path.includes("?")?"&":"?";
  return `${path}${sep}session=${encodeURIComponent(token)}`;
}

export function asArray<T=any>(value:T|T[]|null|undefined):T[]{
  if(Array.isArray(value)) return value;
  if(value==null) return [];
  return [value];
}

export function percent(score:number,max:number){
  return max>0?Math.round(score/max*100):0;
}
