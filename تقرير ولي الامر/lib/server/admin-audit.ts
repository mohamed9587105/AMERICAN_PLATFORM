import "server-only";
import {dbConfigured,dbInsert} from "@/lib/server/db";
import {getAdminSession} from "@/lib/server/admin-auth";
export async function adminAudit(action:string,entityType?:string,entityId?:string,details:any={}){
  if(!dbConfigured)return;
  try{
    const s=await getAdminSession();
    if(!s)return;
    await dbInsert("admin_audit_log",{
      admin_user_id:s.adminUserId||null,actor_name:s.name||"مدير النظام",actor_email:s.email||"",
      action,entity_type:entityType||null,entity_id:entityId||null,details:details||{}
    });
  }catch{}
}
