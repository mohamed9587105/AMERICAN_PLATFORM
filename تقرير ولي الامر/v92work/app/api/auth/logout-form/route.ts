import {NextResponse} from "next/server";

export async function POST(req:Request){
  const host=req.headers.get("x-forwarded-host")||req.headers.get("host")||new URL(req.url).host;
  const proto=req.headers.get("x-forwarded-proto")||new URL(req.url).protocol.replace(":","");
  const res=NextResponse.redirect(`${proto}://${host}/parent-login`,303);
  res.cookies.set("parent_session","",{httpOnly:true,path:"/",maxAge:0,sameSite:"lax",secure:proto==="https"});
  return res;
}
