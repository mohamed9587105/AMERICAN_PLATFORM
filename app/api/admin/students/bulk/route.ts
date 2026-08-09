import {NextResponse} from "next/server";
import {dbConfigured} from "@/lib/server/db";
import {createStudentWithParents} from "@/lib/server/student-service";

export async function POST(req:Request){
  const body=await req.json();
  const rows=Array.isArray(body.rows)?body.rows:[];
  if(!rows.length) return NextResponse.json({error:"NO_ROWS"},{status:400});
  if(!dbConfigured) return NextResponse.json({mode:"demo",saved:false,rows});

  const results:any[]=[];
  const errors:any[]=[];
  for(let i=0;i<rows.length;i++){
    try{
      const created=await createStudentWithParents(rows[i]);
      results.push({index:i,...created});
    }catch(err:any){
      errors.push({index:i,error:err?.message||String(err),name:rows[i]?.name||""});
    }
  }
  return NextResponse.json({mode:"online",saved:true,results,errors});
}
