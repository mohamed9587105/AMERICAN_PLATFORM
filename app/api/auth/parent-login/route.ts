export const dynamic="force-dynamic";
export const revalidate=0;
import {NextResponse} from "next/server";
import {dbConfigured,dbSelect} from "@/lib/server/db";
import {createSession,verifyPassword} from "@/lib/server/auth";

export async function POST(req:Request){
  const requestUrl=new URL(req.url);
  const isHttps=requestUrl.protocol==="https:";
  const {phone,password}=await req.json();
  const cleanPhone=String(phone||"").replace(/\D/g,"");
  const cleanPassword=String(password||"");

  if(!dbConfigured){
    if(cleanPhone==="01098765432"&&cleanPassword==="PARENT1"){
      const token=createSession({type:"parent",parentId:"demo-parent"});
      const res=NextResponse.json({ok:true,mode:"demo",sessionToken:token});
      res.cookies.set("parent_session",token,{
        httpOnly:true,
        secure:isHttps,
        sameSite:"lax",
        path:"/",
        maxAge:60*60*24*30
      });
      return res;
    }
    return NextResponse.json({error:"بيانات الدخول غير صحيحة"},{status:401});
  }

  const rows=await dbSelect("parent_accounts",`select=*&phone=eq.${encodeURIComponent(cleanPhone)}&is_active=eq.true&limit=1`);
  const parent=rows[0];
  if(!parent||!verifyPassword(cleanPassword,parent.password_hash)){
    return NextResponse.json({error:"بيانات الدخول غير صحيحة"},{status:401});
  }
  const token=createSession({type:"parent",parentId:parent.id});
  const res=NextResponse.json({ok:true,sessionToken:token});
  res.cookies.set("parent_session",token,{
    httpOnly:true,
    secure:isHttps,
    sameSite:"lax",
    path:"/",
    maxAge:60*60*24*30
  });
  return res;
}
