import {NextResponse} from "next/server";
import {
  ADMIN_COOKIE_NAME,
  adminAuthConfigured,
  adminCookieOptions,
  createAdminSession,
  validAdminCredentials
} from "@/lib/server/admin-auth";

export const dynamic="force-dynamic";
export const revalidate=0;

function originFrom(req:Request){
  const u=new URL(req.url);
  const host=req.headers.get("x-forwarded-host")||req.headers.get("host")||u.host;
  const proto=req.headers.get("x-forwarded-proto")||u.protocol.replace(":","");
  return `${proto}://${host}`;
}

export async function POST(req:Request){
  if(!adminAuthConfigured){
    return NextResponse.redirect(`${originFrom(req)}/admin-login?error=config`,303);
  }

  const contentType=req.headers.get("content-type")||"";
  let email="",password="",next="/manual-entry";

  if(contentType.includes("application/json")){
    const body=await req.json();
    email=String(body.email||"");
    password=String(body.password||"");
    next=String(body.next||"/manual-entry");
  }else{
    const form=await req.formData();
    email=String(form.get("email")||"");
    password=String(form.get("password")||"");
    next=String(form.get("next")||"/manual-entry");
  }

  if(!validAdminCredentials(email,password)){
    if(contentType.includes("application/json")){
      return NextResponse.json({error:"INVALID_CREDENTIALS"},{status:401,headers:{"Cache-Control":"no-store"}});
    }
    return NextResponse.redirect(`${originFrom(req)}/admin-login?error=invalid`,303);
  }

  // Only allow internal admin destinations.
  if(!next.startsWith("/")||next.startsWith("//")) next="/manual-entry";

  const token=createAdminSession();
  const proto=req.headers.get("x-forwarded-proto")||new URL(req.url).protocol.replace(":","");
  const isHttps=proto==="https";

  if(contentType.includes("application/json")){
    const res=NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
    res.cookies.set(ADMIN_COOKIE_NAME,token,adminCookieOptions(isHttps));
    return res;
  }

  const res=NextResponse.redirect(`${originFrom(req)}${next}`,303);
  res.cookies.set(ADMIN_COOKIE_NAME,token,adminCookieOptions(isHttps));
  return res;
}
