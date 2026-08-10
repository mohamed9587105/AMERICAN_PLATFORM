import "server-only";
import crypto from "crypto";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {NextResponse} from "next/server";
import {createSession,readSession,verifyPassword} from "@/lib/server/auth";
import {dbConfigured,dbSelect} from "@/lib/server/db";

const ADMIN_COOKIE="admin_session";
const adminEmail=String(process.env.ADMIN_EMAIL||"").trim().toLowerCase();
const adminPassword=String(process.env.ADMIN_PASSWORD||"");
const hasSessionSecret=Boolean(process.env.APP_SESSION_SECRET);

export const adminAuthConfigured=Boolean(hasSessionSecret&&(adminEmail&&adminPassword||dbConfigured));

export const PERMISSIONS=[
  "dashboard.view",
  "students.view","students.create","students.edit","students.import","students.password","students.toggle",
  "reports.view","reports.edit","reports.pdf",
  "data_entry.attendance","data_entry.homework","data_entry.exams","data_entry.finance",
  "finance.view","finance.edit",
  "users.manage","audit.view"
] as const;
export type AdminPermission=typeof PERMISSIONS[number];

function safeEqual(a:string,b:string){
  const aa=Buffer.from(a); const bb=Buffer.from(b);
  if(aa.length!==bb.length) return false;
  try{return crypto.timingSafeEqual(aa,bb)}catch{return false}
}
function permissionMap(value:any):Record<string,boolean>{
  if(!value||typeof value!=="object") return {};
  return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,Boolean(v)]));
}
export function isOwnerSession(session:any){
  return Boolean(session?.isOwner||session?.role==="owner");
}
export function hasPermission(session:any,permission?:AdminPermission){
  if(!permission) return true;
  if(isOwnerSession(session)) return true;
  return Boolean(session?.permissions?.[permission]);
}
export function ownerCredentialsValid(email:string,password:string){
  if(!adminEmail||!adminPassword) return false;
  return safeEqual(String(email||"").trim().toLowerCase(),adminEmail)&&safeEqual(String(password||""),adminPassword);
}
export async function employeeCredentials(email:string,password:string){
  if(!dbConfigured) return null;
  const clean=String(email||"").trim().toLowerCase();
  const rows=await dbSelect("admin_users",`select=id,name,email,password_hash,role,permissions,is_active&email=eq.${encodeURIComponent(clean)}&limit=1`);
  const user=rows[0];
  if(!user||user.is_active===false||!verifyPassword(String(password||""),String(user.password_hash||""))) return null;
  return user;
}
export function createOwnerAdminSession(){
  return createSession({
    type:"admin",email:adminEmail,name:"مدير النظام",role:"owner",isOwner:true,permissions:{}
  },1000*60*60*12);
}
export function createEmployeeAdminSession(user:any){
  return createSession({
    type:"admin",adminUserId:user.id,email:user.email,name:user.name,role:user.role||"staff",
    isOwner:false,permissions:permissionMap(user.permissions)
  },1000*60*60*12);
}
export async function getAdminSession(){
  const jar=await cookies();
  const token=jar.get(ADMIN_COOKIE)?.value||"";
  const session=readSession(token);
  if(!session||session.type!=="admin") return null;

  if(isOwnerSession(session)){
    if(!adminEmail||String(session.email||"").toLowerCase()!==adminEmail) return null;
    return session;
  }

  if(!session.adminUserId||!dbConfigured) return null;
  try{
    const rows=await dbSelect("admin_users",`select=id,name,email,role,permissions,is_active&id=eq.${encodeURIComponent(session.adminUserId)}&limit=1`);
    const user=rows[0];
    if(!user||user.is_active===false) return null;
    return {...session,name:user.name,email:user.email,role:user.role||"staff",permissions:permissionMap(user.permissions),isOwner:false};
  }catch{return null}
}
export async function requireAdminPage(permission?:AdminPermission){
  if(!adminAuthConfigured) redirect("/admin-login?error=config");
  const session=await getAdminSession();
  if(!session) redirect("/admin-login?reason=session");
  if(permission&&!hasPermission(session,permission)) redirect("/admin/forbidden");
  return session;
}
export async function requireAnyAdminPermission(permissions:AdminPermission[]){
  if(!adminAuthConfigured) return NextResponse.json({error:"ADMIN_AUTH_NOT_CONFIGURED"},{status:503,headers:{"Cache-Control":"no-store"}});
  const session=await getAdminSession();
  if(!session) return NextResponse.json({error:"UNAUTHORIZED"},{status:401,headers:{"Cache-Control":"no-store"}});
  if(!isOwnerSession(session)&&!permissions.some(p=>hasPermission(session,p))){
    return NextResponse.json({error:"FORBIDDEN"},{status:403,headers:{"Cache-Control":"no-store"}});
  }
  return null;
}
export async function requireAdminApi(permission?:AdminPermission){
  if(!adminAuthConfigured) return NextResponse.json({error:"ADMIN_AUTH_NOT_CONFIGURED"},{status:503,headers:{"Cache-Control":"no-store"}});
  const session=await getAdminSession();
  if(!session) return NextResponse.json({error:"UNAUTHORIZED"},{status:401,headers:{"Cache-Control":"no-store"}});
  if(permission&&!hasPermission(session,permission)) return NextResponse.json({error:"FORBIDDEN"},{status:403,headers:{"Cache-Control":"no-store"}});
  return null;
}
export function adminCookieOptions(isHttps:boolean){
  return {httpOnly:true,secure:isHttps,sameSite:"lax" as const,path:"/",maxAge:60*60*12};
}
export const ADMIN_COOKIE_NAME=ADMIN_COOKIE;
