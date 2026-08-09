import {NextResponse} from "next/server";
import {dbConfigured,dbDelete,dbInsert,dbSelect,dbUpdate} from "@/lib/server/db";

function num(v:any){
  if(v===null||v===undefined||v==="") return null;
  const n=Number(v);
  return Number.isFinite(n)?n:null;
}

function validScore(score:any,max:any){
  const s=num(score),m=num(max);
  if(s===null||m===null) return false;
  return m>0&&s>=0&&s<=m;
}

async function ensureReport(studentId:string,weekLabel:string,weekStart:string,weekEnd:string){
  const existing=await dbSelect(
    "weekly_reports",
    `select=*&student_id=eq.${encodeURIComponent(studentId)}&week_start=eq.${encodeURIComponent(weekStart)}&week_end=eq.${encodeURIComponent(weekEnd)}&limit=1`
  );
  if(existing[0]){
    await dbUpdate("weekly_reports",`id=eq.${encodeURIComponent(existing[0].id)}`,{week_label:weekLabel});
    return existing[0];
  }
  const rows=await dbInsert("weekly_reports",{
    student_id:studentId,
    week_label:weekLabel,
    week_start:weekStart,
    week_end:weekEnd,
    status:"draft"
  });
  return rows[0];
}

export async function POST(req:Request){
  const body=await req.json();
  const {weekLabel,weekStart,weekEnd,batch}=body||{};
  if(!weekStart||!weekEnd||!Array.isArray(batch)){
    return NextResponse.json({error:"INVALID_IMPORT_PAYLOAD"},{status:400});
  }
  if(!dbConfigured){
    return NextResponse.json({mode:"demo",saved:false,students:batch.length});
  }

  const results:any[]=[];
  const errors:string[]=[];

  for(const item of batch){
    try{
      if(!item?.studentId) throw new Error("MISSING_STUDENT_ID");
      const studentRows=await dbSelect("students",`select=id& id=eq.${encodeURIComponent(item.studentId)}`.replace("& ","&"));
      if(!studentRows[0]) throw new Error("STUDENT_NOT_FOUND");

      const report=await ensureReport(item.studentId,weekLabel||"الأسبوع الحالي",weekStart,weekEnd);
      const reportId=report.id;
      let counts={attendance:0,homework:0,exams:0,finance:0};

      for(const a of item.attendance||[]){
        if(!a?.date||!["present","absent","late"].includes(a.status)) continue;
        await dbDelete("attendance_entries",`report_id=eq.${encodeURIComponent(reportId)}&date=eq.${encodeURIComponent(a.date)}`);
        await dbInsert("attendance_entries",{
          report_id:reportId,date:a.date,status:a.status,note:a.note||null
        });
        counts.attendance++;
      }

      for(const h of item.homework||[]){
        const title=String(h?.title||"").trim();
        if(!title) continue;
        const score=num(h.score),maxScore=num(h.maxScore);
        if(score!==null||maxScore!==null){
          if(score===null||maxScore===null||!validScore(score,maxScore)){
            errors.push(`${item.studentId}: واجب ${title} درجته غير صحيحة`);
            continue;
          }
        }
        await dbDelete("homework_entries",`report_id=eq.${encodeURIComponent(reportId)}&title=eq.${encodeURIComponent(title)}`);
        await dbInsert("homework_entries",{
          report_id:reportId,
          title,
          due_date:h.dueDate||null,
          status:["completed","missing","late"].includes(h.status)?h.status:"completed",
          score,
          max_score:maxScore
        });
        counts.homework++;
      }

      for(const e of item.exams||[]){
        const title=String(e?.title||"").trim();
        if(!title||!validScore(e.score,e.maxScore)){
          if(title) errors.push(`${item.studentId}: امتحان ${title} درجته غير صحيحة`);
          continue;
        }
        let examQuery=`report_id=eq.${encodeURIComponent(reportId)}&title=eq.${encodeURIComponent(title)}`;
        if(e.date) examQuery+=`&date=eq.${encodeURIComponent(e.date)}`;
        await dbDelete("exam_entries",examQuery);
        const rows=await dbInsert("exam_entries",{
          report_id:reportId,title,date:e.date||null,score:Number(e.score),max_score:Number(e.maxScore)
        });
        const examId=rows[0].id;
        const sections=[
          ["Reading",e.reading,e.readingMax],
          ["Writing",e.writing,e.writingMax],
          ["Vocabulary",e.vocabulary,e.vocabularyMax]
        ].filter(([,s,m])=>s!==""&&s!==null&&s!==undefined&&m!==""&&m!==null&&m!==undefined&&validScore(s,m));
        if(sections.length){
          await dbInsert("exam_sections",sections.map(([name,s,m])=>({
            exam_id:examId,name,score:Number(s),max_score:Number(m)
          })));
        }
        counts.exams++;
      }

      for(const f of item.finance||[]){
        const financeRows=await dbSelect("finance_entries",`select=id&report_id=eq.${encodeURIComponent(reportId)}&limit=1`);
        const payload={
          paid:num(f.paid)||0,
          due:num(f.due)||0,
          due_date:f.dueDate||null,
          note:f.note||null
        };
        if(financeRows[0]) await dbUpdate("finance_entries",`id=eq.${encodeURIComponent(financeRows[0].id)}`,payload);
        else await dbInsert("finance_entries",{report_id:reportId,...payload});
        counts.finance++;
      }

      results.push({studentId:item.studentId,reportId,counts,status:"draft"});
    }catch(err:any){
      errors.push(`${item?.studentId||"unknown"}: ${err?.message||"IMPORT_FAILED"}`);
    }
  }

  return NextResponse.json({mode:"online",saved:true,results,errors});
}
