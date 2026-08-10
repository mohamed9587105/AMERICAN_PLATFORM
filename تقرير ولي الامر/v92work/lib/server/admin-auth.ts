import "server-only";
import crypto from "crypto";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {NextResponse} from "next/server";
import {createSession,readSession} from "@/lib/server/auth";

const ADMIN_COOKIE="admin_session";
const adminEmail=String(process.env.ADMIN_EMAIL||"").trim().toLowerCase();
const adminPassword=String(process.env.ADMIN_PASSWORD||"");
const hasSessionSecret=Boolean(process.env.APP_SESSION_SECRET);

export const adminAuthConfigured=Boolean(adminEmail&&adminPassword&&hasSessionSecret);

function safeEqual(a:string,b:string){
  const aa=Buffer.from(a);
  const bb=Buffer.from(b);
  if(aa.length!==bb.length) return false;
  try{return crypto.timingSafeEqual(aa,bb)}catch{return false}
}

export function validAdminCredentials(email:string,password:string){
  if(!adminAuthConfigured) return false;
  return safeEqual(String(email||"").trim().toLowerCase(),adminEmail) &&
         safeEqual(String(password||""),adminPassword);
}

export function createAdminSession(){
  // 12-hour admin session.
  return createSession({type:"admin",email:adminEmail},1000*60*60*12);
}

export async function getAdminSession(){
  const jar=await cookies();
  const token=jar.get(ADMIN_COOKIE)?.value||"";
  const session=readSession(token);
  if(!session||session.type!=="admin") return null;
  if(String(session.email||"").toLowerCase()!==adminEmail) return null;
  return session;
}

export async function requireAdminPage(){
  if(!adminAuthConfigured) redirect("/admin-login?error=config");
  const session=await getAdminSession();
  if(!session) redirect("/admin-login?reason=session");
  return session;
}

export async function requireAdminApi(){
  if(!adminAuthConfigured){
    return NextResponse.json(
      {error:"ADMIN_AUTH_NOT_CONFIGURED"},
      {status:503,headers:{"Cache-Control":"no-store"}}
    );
  }
  const session=await getAdminSession();
  if(!session){
    return NextResponse.json(
      {error:"UNAUTHORIZED"},
      {status:401,headers:{"Cache-Control":"no-store"}}
    );
  }
  return null;
}

export function adminCookieOptions(isHttps:boolean){
  return {
    httpOnly:true,
    secure:isHttps,
    sameSite:"lax" as const,
    path:"/",
    maxAge:60*60*12
  };
}

export const ADMIN_COOKIE_NAME=ADMIN_COOKIE;
