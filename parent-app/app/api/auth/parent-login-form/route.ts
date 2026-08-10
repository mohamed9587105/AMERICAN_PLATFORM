import {NextResponse} from "next/server";
import {dbConfigured,dbSelect} from "@/lib/server/db";
import {createSession,verifyPassword} from "@/lib/server/auth";

export const dynamic="force-dynamic";
export const revalidate=0;

function redirect(req:Request,path:string){
  const requestUrl=new URL(req.url);

  // When Next.js is bound to 0.0.0.0, req.url may contain 0.0.0.0 even
  // though the phone reached the app through 192.168.x.x.
  // Prefer the actual Host header sent by the browser.
  const forwardedHost=req.headers.get("x-forwarded-host");
  const host=forwardedHost||req.headers.get("host")||requestUrl.host;

  const forwardedProto=req.headers.get("x-forwarded-proto");
  const proto=forwardedProto||requestUrl.protocol.replace(":","");

  return NextResponse.redirect(`${proto}://${host}${path}`,303);
}

export async function POST(req:Request){
  try{
    const form=await req.formData();
    const cleanPhone=String(form.get("phone")||"").replace(/\D/g,"");
    const cleanPassword=String(form.get("password")||"");

    if(!cleanPhone||!cleanPassword){
      return redirect(req,"/parent-login?error=invalid");
    }

    let parentId="";

    if(!dbConfigured){
      if(cleanPhone!=="01098765432"||cleanPassword!=="PARENT1"){
        return redirect(req,"/parent-login?error=invalid");
      }
      parentId="demo-parent";
    }else{
      const rows=await dbSelect(
        "parent_accounts",
        `select=*&phone=eq.${encodeURIComponent(cleanPhone)}&is_active=eq.true&limit=1`
      );
      const parent=rows[0];

      if(!parent||!verifyPassword(cleanPassword,parent.password_hash)){
        return redirect(req,"/parent-login?error=invalid");
      }
      parentId=parent.id;
    }

    const token=createSession({type:"parent",parentId});
    const requestUrl=new URL(req.url);
    const forwardedProto=req.headers.get("x-forwarded-proto");
    const isHttps=(forwardedProto||requestUrl.protocol.replace(":",""))==="https";

    // We still set the normal cookie.
    const res=redirect(
      req,
      `/parent?session=${encodeURIComponent(token)}`
    );
    res.cookies.set("parent_session",token,{
      httpOnly:true,
      secure:isHttps,
      sameSite:"lax",
      path:"/",
      maxAge:60*60*24*30
    });

    return res;
  }catch{
    return redirect(req,"/parent-login?error=server");
  }
}
