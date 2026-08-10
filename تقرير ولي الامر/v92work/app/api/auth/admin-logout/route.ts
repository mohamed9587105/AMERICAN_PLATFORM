import {NextResponse} from "next/server";
import {ADMIN_COOKIE_NAME} from "@/lib/server/admin-auth";

function originFrom(req:Request){
  const u=new URL(req.url);
  const host=req.headers.get("x-forwarded-host")||req.headers.get("host")||u.host;
  const proto=req.headers.get("x-forwarded-proto")||u.protocol.replace(":","");
  return `${proto}://${host}`;
}

export async function POST(req:Request){
  const res=NextResponse.redirect(`${originFrom(req)}/admin-login`,303);
  res.cookies.set(ADMIN_COOKIE_NAME,"",{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:0});
  return res;
}

export async function GET(req:Request){
  return POST(req);
}
