import {NextResponse} from "next/server";
import {dbConfigured,dbSelect} from "@/lib/server/db";
import {requireAdminApi} from "@/lib/server/admin-auth";
export async function GET(){
  const denied=await requireAdminApi("audit.view");if(denied)return denied;
  if(!dbConfigured)return NextResponse.json({rows:[]});
  const rows=await dbSelect("admin_audit_log","select=id,actor_name,actor_email,action,entity_type,entity_id,details,created_at&order=created_at.desc&limit=300");
  return NextResponse.json({rows});
}
