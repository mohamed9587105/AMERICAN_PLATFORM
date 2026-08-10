import {NextResponse} from "next/server";
import {dbConfigured,dbDelete,dbInsert,dbSelect,dbUpdate} from "@/lib/server/db";
import {hashPassword} from "@/lib/server/auth";
import {requireAdminApi,getAdminSession} from "@/lib/server/admin-auth";

async function audit(action:string,entityId:string,details:any={}){
  try{
    const session=await getAdminSession();
    await dbInsert("admin_audit_log",{
      admin_user_id:session?.adminUserId||null,
      actor_name:session?.name||"مدير النظام",
      actor_email:session?.email||"",
      action,entity_type:"admin_user",entity_id:entityId,details
    });
  }catch{}
}
export async function GET(){
  const denied=await requireAdminApi("users.manage"); if(denied)return denied;
  if(!dbConfigured)return NextResponse.json({users:[]});
  const users=await dbSelect("admin_users","select=id,name,email,role,permissions,is_active,created_at,updated_at&order=created_at.desc");
  return NextResponse.json({users});
}
export async function POST(req:Request){
  const denied=await requireAdminApi("users.manage"); if(denied)return denied;
  if(!dbConfigured)return NextResponse.json({error:"DB_NOT_CONFIGURED"},{status:503});
  try{
    const b=await req.json();
    const name=String(b.name||"").trim(),email=String(b.email||"").trim().toLowerCase(),password=String(b.password||"");
    if(!name||!email||password.length<6)return NextResponse.json({error:"اكتب الاسم والبريد وباسورد 6 أحرف على الأقل"},{status:400});
    const rows=await dbInsert("admin_users",{
      name,email,password_hash:hashPassword(password),role:String(b.role||"staff"),
      permissions:b.permissions&&typeof b.permissions==="object"?b.permissions:{},is_active:b.isActive!==false
    });
    await audit("user.created",rows[0]?.id||"",{name,email});
    return NextResponse.json({user:rows[0]});
  }catch(e:any){return NextResponse.json({error:e?.message||"CREATE_USER_FAILED"},{status:400})}
}
export async function PATCH(req:Request){
  const denied=await requireAdminApi("users.manage"); if(denied)return denied;
  try{
    const b=await req.json(); const id=String(b.id||"");
    if(!id)return NextResponse.json({error:"MISSING_ID"},{status:400});
    const patch:any={updated_at:new Date().toISOString()};
    if(b.name!==undefined)patch.name=String(b.name).trim();
    if(b.email!==undefined)patch.email=String(b.email).trim().toLowerCase();
    if(b.role!==undefined)patch.role=String(b.role);
    if(b.permissions!==undefined)patch.permissions=b.permissions||{};
    if(b.isActive!==undefined)patch.is_active=Boolean(b.isActive);
    if(String(b.password||"").trim())patch.password_hash=hashPassword(String(b.password).trim());
    await dbUpdate("admin_users",`id=eq.${encodeURIComponent(id)}`,patch);
    await audit("user.updated",id,{fields:Object.keys(patch).filter(x=>x!=="password_hash")});
    return NextResponse.json({saved:true});
  }catch(e:any){return NextResponse.json({error:e?.message||"UPDATE_USER_FAILED"},{status:400})}
}
export async function DELETE(req:Request){
  const denied=await requireAdminApi("users.manage"); if(denied)return denied;
  const id=new URL(req.url).searchParams.get("id")||"";
  if(!id)return NextResponse.json({error:"MISSING_ID"},{status:400});
  await audit("user.deleted",id,{});
  await dbDelete("admin_users",`id=eq.${encodeURIComponent(id)}`);
  return NextResponse.json({deleted:true});
}
