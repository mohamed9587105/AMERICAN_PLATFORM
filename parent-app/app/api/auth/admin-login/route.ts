import {NextResponse} from "next/server";
import {
  ADMIN_COOKIE_NAME,adminAuthConfigured,adminCookieOptions,
  createEmployeeAdminSession,createOwnerAdminSession,employeeCredentials,ownerCredentialsValid
} from "@/lib/server/admin-auth";

export const dynamic="force-dynamic"; export const revalidate=0;
function originFrom(req:Request){
  const u=new URL(req.url); const host=req.headers.get("x-forwarded-host")||req.headers.get("host")||u.host;
  const proto=req.headers.get("x-forwarded-proto")||u.protocol.replace(":",""); return `${proto}://${host}`;
}
export async function POST(req:Request){
  if(!adminAuthConfigured) return NextResponse.redirect(`${originFrom(req)}/admin-login?error=config`,303);
  const contentType=req.headers.get("content-type")||"";
  let email="",password="",next="/manual-entry";
  if(contentType.includes("application/json")){
    const body=await req.json(); email=String(body.email||""); password=String(body.password||""); next=String(body.next||"/manual-entry");
  }else{
    const form=await req.formData(); email=String(form.get("email")||""); password=String(form.get("password")||""); next=String(form.get("next")||"/manual-entry");
  }

  let token="";
  if(ownerCredentialsValid(email,password)) token=createOwnerAdminSession();
  else{
    try{
      const user=await employeeCredentials(email,password);
      if(user){
        token=createEmployeeAdminSession(user);
        const perms=user.permissions||{};
        const allowed=(key:string)=>Boolean(perms?.[key]);
        if(next==="/manual-entry"&&!allowed("dashboard.view")){
          next=allowed("students.view")?"/admin/students":
               allowed("reports.view")?"/admin/reports":
               (allowed("data_entry.attendance")||allowed("data_entry.homework")||allowed("data_entry.exams")||allowed("data_entry.finance"))?"/admin/data-entry":
               allowed("finance.view")?"/admin/finance":
               allowed("users.manage")?"/admin/users":
               allowed("audit.view")?"/admin/audit":"/admin/forbidden";
        }
      }
    }catch{}
  }

  if(!token){
    if(contentType.includes("application/json")) return NextResponse.json({error:"INVALID_CREDENTIALS"},{status:401});
    return NextResponse.redirect(`${originFrom(req)}/admin-login?error=invalid`,303);
  }
  if(!next.startsWith("/")||next.startsWith("//")) next="/manual-entry";
  const proto=req.headers.get("x-forwarded-proto")||new URL(req.url).protocol.replace(":","");
  const res=contentType.includes("application/json")?NextResponse.json({ok:true}):NextResponse.redirect(`${originFrom(req)}${next}`,303);
  res.cookies.set(ADMIN_COOKIE_NAME,token,adminCookieOptions(proto==="https")); return res;
}
