import {NextResponse} from "next/server";
import {dbConfigured} from "@/lib/server/db";
import {createStudentWithParents} from "@/lib/server/student-service";
import {requireAdminApi} from "@/lib/server/admin-auth";
import {adminAudit} from "@/lib/server/admin-audit";

export async function POST(req:Request){
  const adminDenied=await requireAdminApi("students.import");
  if(adminDenied) return adminDenied;
  const body=await req.json();
  const rows=Array.isArray(body.rows)?body.rows:[];
  if(!rows.length) return NextResponse.json({error:"NO_ROWS"},{status:400});
  if(!dbConfigured) return NextResponse.json({mode:"demo",saved:false,rows});

  const results:any[]=[];
  const errors:any[]=[];

  // Process imports concurrently in small batches.
  // This keeps Supabase/database pressure controlled while avoiding the old
  // one-student-at-a-time bottleneck.
  const concurrency=8;
  for(let start=0;start<rows.length;start+=concurrency){
    const batch=rows.slice(start,start+concurrency);
    const settled=await Promise.all(batch.map(async(row:any,offset:number)=>{
      const index=start+offset;
      try{
        const created=await createStudentWithParents(row);
        return {ok:true,index,created};
      }catch(err:any){
        return {ok:false,index,error:err?.message||String(err),name:row?.name||""};
      }
    }));
    for(const item of settled){
      if(item.ok) results.push({index:item.index,...item.created});
      else errors.push({index:item.index,error:item.error,name:item.name});
    }
  }

  results.sort((a,b)=>a.index-b.index);
  errors.sort((a,b)=>a.index-b.index);
  await adminAudit("student.imported","students",undefined,{saved:results.length,errors:errors.length});
  return NextResponse.json({mode:"online",saved:true,results,errors});
}
