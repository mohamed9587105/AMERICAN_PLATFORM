import {NextResponse} from "next/server";
import {dbConfigured,dbDelete,dbInsert,dbSelect,dbUpdate} from "@/lib/server/db";
import {requireAdminApi} from "@/lib/server/admin-auth";

export async function GET(){
  const denied=await requireAdminApi("dashboard.view"); if(denied)return denied;
  if(!dbConfigured)return NextResponse.json({settings:null,events:[]});
  const settings=(await dbSelect("parent_app_settings","select=*&id=eq.main&limit=1"))[0]||null;
  const events=await dbSelect("student_schedule_events","select=*,students(id,name,code)&order=event_at.asc");
  return NextResponse.json({settings,events});
}
export async function POST(req:Request){
  const denied=await requireAdminApi("dashboard.view"); if(denied)return denied;
  const b=await req.json();
  if(b.action==="settings"){
    const patch={
      contact_title:String(b.contactTitle||"Contact Us"),
      contact_subtitle:String(b.contactSubtitle||""),
      phone:String(b.phone||""),
      whatsapp:String(b.whatsapp||""),
      email:String(b.email||""),
      address:String(b.address||""),
      reminder_minutes:Number(b.reminderMinutes||30),
      updated_at:new Date().toISOString()
    };
    const old=await dbSelect("parent_app_settings","select=id&id=eq.main&limit=1");
    if(old.length)await dbUpdate("parent_app_settings","id=eq.main",patch);
    else await dbInsert("parent_app_settings",{id:"main",...patch});
    return NextResponse.json({saved:true});
  }
  if(b.action==="event"){
    if(!b.studentId||!b.title||!b.eventAt)return NextResponse.json({error:"MISSING_EVENT_DATA"},{status:400});
    try{
      const rows=await dbInsert("student_schedule_events",{
        student_id:b.studentId,event_type:b.eventType||"class",title:b.title,event_at:b.eventAt,note:b.note||null,is_active:true
      });
      return NextResponse.json({saved:true,event:rows[0]});
    }catch(e:any){
      const message=String(e?.message||"");
      if(message.includes("PGRST205")){
        return NextResponse.json({error:"قاعدة البيانات غير مجهزة لمواعيد تطبيق ولي الأمر. شغّل ملف V121_PARENT_CONTROL_DATABASE_SETUP.sql في Supabase SQL Editor."},{status:500});
      }
      return NextResponse.json({error:message||"تعذر إضافة الموعد"},{status:500});
    }
  }
  return NextResponse.json({error:"INVALID_ACTION"},{status:400});
}
export async function DELETE(req:Request){
  const denied=await requireAdminApi("dashboard.view"); if(denied)return denied;
  const id=new URL(req.url).searchParams.get("id");
  if(!id)return NextResponse.json({error:"MISSING_ID"},{status:400});
  await dbDelete("student_schedule_events",`id=eq.${encodeURIComponent(id)}`);
  return NextResponse.json({deleted:true});
}
