"use client";

import {useMemo,useState} from "react";

type Student={
  id:string;
  code:string;
  name:string;
  phone:string;
  parentPhone?:string;
};

export type ImportedStudentData={
  studentId:string;
  attendance:{date:string;status:"present"|"absent"|"late";note:string}[];
  homework:{title:string;dueDate:string;score:string;maxScore:string;status:"completed"|"late"|"missing"}[];
  exams:{
    title:string;date:string;score:string;maxScore:string;
    reading:string;readingMax:string;writing:string;writingMax:string;vocabulary:string;vocabularyMax:string;
  }[];
  finance:{paid:string;due:string;dueDate:string;note:string}[];
};

type ParsedRow={
  index:number;
  raw:any;
  studentId:string;
  studentName:string;
  confidence:"code"|"phone"|"exact"|"likely"|"manual"|"none";
  detected:string[];
  attendance?:ImportedStudentData["attendance"][number];
  homework?:ImportedStudentData["homework"][number];
  exam?:ImportedStudentData["exams"][number];
  finance?:ImportedStudentData["finance"][number];
};

declare global{
  interface Window{ XLSX?:any }
}

const SHEETJS_SRC="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";

const normalize=(v:any)=>
  String(v??"")
    .toLowerCase()
    .replace(/[أإآ]/g,"ا")
    .replace(/ة/g,"ه")
    .replace(/ى/g,"ي")
    .replace(/[^\p{L}\p{N}]+/gu," ")
    .trim();

const normKey=(v:any)=>normalize(v).replace(/\s+/g," ");

function pick(row:any, aliases:string[]){
  const entries=Object.entries(row);
  for(const alias of aliases){
    const target=normKey(alias);
    const exact=entries.find(([k])=>normKey(k)===target);
    if(exact) return exact[1];
  }
  for(const alias of aliases){
    const target=normKey(alias);
    const partial=entries.find(([k])=>{
      const nk=normKey(k);
      return nk.includes(target)||target.includes(nk);
    });
    if(partial) return partial[1];
  }
  return "";
}

function nonEmpty(v:any){return String(v??"").trim()!==""}

function normalizeStatus(v:any):"present"|"absent"|"late"|""{
  const s=normalize(v);
  if(!s) return "";
  if(["present","attended","حاضر","حضور","تم الحضور"].some(x=>s.includes(normalize(x)))) return "present";
  if(["absent","غياب","غائب","لم يحضر"].some(x=>s.includes(normalize(x)))) return "absent";
  if(["late","متاخر","تأخير","تاخير"].some(x=>s.includes(normalize(x)))) return "late";
  return "";
}

function normalizeHomeworkStatus(v:any):"completed"|"late"|"missing"|""{
  const s=normalize(v);
  if(!s) return "";
  if(["completed","submitted","done","تم","مكتمل","تم التسليم"].some(x=>s.includes(normalize(x)))) return "completed";
  if(["late","متاخر","متأخر"].some(x=>s.includes(normalize(x)))) return "late";
  if(["missing","not submitted","لم يسلم","غير مسلم"].some(x=>s.includes(normalize(x)))) return "missing";
  return "";
}

function parseDelimited(text:string, delimiter?:string){
  const first=text.split(/\r?\n/)[0]||"";
  const d=delimiter || (first.includes("\t")?"\t":first.includes(";")?";":",");
  const rows:string[][]=[];
  let row:string[]=[], cell="", quoted=false;

  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){
      if(quoted && text[i+1]==='"'){cell+='"';i++}
      else quoted=!quoted;
    }else if(ch===d && !quoted){
      row.push(cell);cell="";
    }else if((ch==="\n"||ch==="\r")&&!quoted){
      if(ch==="\r"&&text[i+1]==="\n") i++;
      row.push(cell);cell="";
      if(row.some(x=>x.trim()!=="")) rows.push(row);
      row=[];
    }else cell+=ch;
  }
  if(cell||row.length){row.push(cell);if(row.some(x=>x.trim()!=="")) rows.push(row)}
  if(!rows.length) return [];
  const headers=rows[0].map((x,i)=>x.trim()||`Column ${i+1}`);
  return rows.slice(1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??""])));
}

async function loadSheetJS(){
  if(window.XLSX) return window.XLSX;
  await new Promise<void>((resolve,reject)=>{
    const existing=document.querySelector(`script[src="${SHEETJS_SRC}"]`) as HTMLScriptElement|null;
    if(existing){
      existing.addEventListener("load",()=>resolve(),{once:true});
      existing.addEventListener("error",()=>reject(new Error("تعذر تحميل قارئ Excel")),{once:true});
      return;
    }
    const s=document.createElement("script");
    s.src=SHEETJS_SRC;
    s.async=true;
    s.onload=()=>resolve();
    s.onerror=()=>reject(new Error("تعذر تحميل قارئ Excel. استخدم CSV مؤقتًا."));
    document.head.appendChild(s);
  });
  if(!window.XLSX) throw new Error("قارئ Excel غير متاح");
  return window.XLSX;
}

export default function UniversalDataImporter({
  students,onApply
}:{
  students:Student[];
  onApply:(batch:ImportedStudentData[])=>void|Promise<void>;
}){
  const [open,setOpen]=useState(false);
  const [rows,setRows]=useState<ParsedRow[]>([]);
  const [fileName,setFileName]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const matchStudent=(row:any)=>{
    const code=String(pick(row,["student code","code","student id","كود الطالب","الكود"])).trim();
    const phone=String(pick(row,["student phone","phone","mobile","رقم الطالب","التليفون","الهاتف"])).replace(/\D/g,"");
    const name=String(pick(row,["student name","name","participant","اسم الطالب","الاسم"])).trim();

    if(code){
      const s=students.find(x=>normalize(x.code)===normalize(code));
      if(s) return {id:s.id,name:s.name,confidence:"code" as const};
    }
    if(phone){
      const s=students.find(x=>String(x.phone||"").replace(/\D/g,"")===phone || String(x.parentPhone||"").replace(/\D/g,"")===phone);
      if(s) return {id:s.id,name:s.name,confidence:"phone" as const};
    }
    if(name){
      const n=normalize(name);
      const exact=students.find(x=>normalize(x.name)===n);
      if(exact) return {id:exact.id,name:exact.name,confidence:"exact" as const};
      const likely=students.find(x=>{
        const sn=normalize(x.name);
        return sn.length>3 && n.length>3 && (sn.includes(n)||n.includes(sn));
      });
      if(likely) return {id:likely.id,name:likely.name,confidence:"likely" as const};
    }
    return {id:"",name:"غير مطابق",confidence:"none" as const};
  };

  const detectRow=(raw:any,index:number):ParsedRow=>{
    const match=matchStudent(raw);
    const detected:string[]=[];

    const date=String(pick(raw,["date","session date","exam date","homework date","التاريخ","تاريخ الحصة","تاريخ الامتحان"])).trim();

    // Attendance
    let attendance:ParsedRow["attendance"];
    const attRaw=pick(raw,["attendance","attendance status","status attendance","الحضور","حالة الحضور","غياب"]);
    const duration=pick(raw,["duration","duration minutes","minutes","مدة الحضور","المدة"]);
    let attStatus=normalizeStatus(attRaw);
    if(!attStatus && nonEmpty(duration)){
      const mins=Number(String(duration).replace(/[^\d.]/g,""))||0;
      attStatus=mins>=70?"present":mins>0?"late":"absent";
    }
    if(attStatus){
      attendance={
        date:date||new Date().toISOString().slice(0,10),
        status:attStatus,
        note:nonEmpty(duration)?`مدة الحضور: ${duration} دقيقة`:""
      };
      detected.push("حضور");
    }

    // Exam
    let exam:ParsedRow["exam"];
    const examTitle=String(pick(raw,["exam","exam name","test","quiz","اسم الامتحان","الاختبار"])).trim();
    const examScore=pick(raw,["exam score","score","grade","درجة الامتحان","الدرجة"]);
    const examMax=pick(raw,["exam max","max score","out of","total","الدرجة النهائية","من"]);
    const reading=pick(raw,["reading score","reading","ريدينج"]);
    const readingMax=pick(raw,["reading max","reading out of","ريدينج من"]);
    const writing=pick(raw,["writing score","writing","رايتنج","writing"]);
    const writingMax=pick(raw,["writing max","writing out of","رايتنج من"]);
    const vocabulary=pick(raw,["vocabulary score","vocabulary","vocab","فوكاب","مفردات"]);
    const vocabularyMax=pick(raw,["vocabulary max","vocab max","vocabulary out of","فوكاب من"]);
    if(examTitle || (nonEmpty(examScore)&&nonEmpty(examMax))){
      exam={
        title:examTitle||"Exam",
        date:date||new Date().toISOString().slice(0,10),
        score:String(examScore??"").trim(),
        maxScore:String(examMax??"").trim(),
        reading:String(reading??"").trim(),
        readingMax:String(readingMax??"").trim(),
        writing:String(writing??"").trim(),
        writingMax:String(writingMax??"").trim(),
        vocabulary:String(vocabulary??"").trim(),
        vocabularyMax:String(vocabularyMax??"").trim(),
      };
      detected.push("امتحان");
    }

    // Homework
    let homework:ParsedRow["homework"];
    const hwTitle=String(pick(raw,["homework","homework name","assignment","اسم الواجب","الواجب"])).trim();
    const hwScore=pick(raw,["homework score","assignment score","درجة الواجب"]);
    const hwMax=pick(raw,["homework max","assignment max","واجب من","الواجب من"]);
    const hwStatusRaw=pick(raw,["homework status","assignment status","حالة الواجب"]);
    let hwStatus=normalizeHomeworkStatus(hwStatusRaw);
    if(!hwStatus && hwTitle) hwStatus=nonEmpty(hwScore)?"completed":"missing";
    if(hwTitle){
      homework={
        title:hwTitle,
        dueDate:String(pick(raw,["due date","homework due","موعد التسليم","تاريخ التسليم"])||date||"").trim(),
        score:String(hwScore??"").trim(),
        maxScore:String(hwMax??"").trim(),
        status:hwStatus||"completed"
      };
      detected.push("واجب");
    }

    // Finance
    let finance:ParsedRow["finance"];
    const paid=pick(raw,["paid","payment","amount paid","المدفوع","تحصيل"]);
    const due=pick(raw,["due","amount due","balance","المستحق","المتبقي"]);
    if(nonEmpty(paid)||nonEmpty(due)){
      finance={
        paid:String(paid??"0").trim()||"0",
        due:String(due??"0").trim()||"0",
        dueDate:String(pick(raw,["due date","payment due","تاريخ الاستحقاق"])||"").trim(),
        note:String(pick(raw,["finance note","payment note","ملاحظة مالية","ملاحظات مالية"])||"").trim()
      };
      detected.push("مالية");
    }

    return {
      index,raw,
      studentId:match.id,
      studentName:match.name,
      confidence:match.confidence,
      detected,attendance,exam,homework,finance
    };
  };

  const readFile=async(file:File)=>{
    setLoading(true);setError("");setFileName(file.name);
    try{
      const ext=file.name.split(".").pop()?.toLowerCase();
      let data:any[]=[];
      if(["csv","tsv","txt"].includes(ext||"")){
        const text=await file.text();
        data=parseDelimited(text,ext==="tsv"?"\t":undefined);
      }else if(["xlsx","xls","xlsm","xlsb","ods"].includes(ext||"")){
        const XLSX=await loadSheetJS();
        const buf=await file.arrayBuffer();
        const wb=XLSX.read(buf,{type:"array"});
        for(const sheetName of wb.SheetNames){
          const ws=wb.Sheets[sheetName];
          const sheetRows=XLSX.utils.sheet_to_json(ws,{defval:""});
          data.push(...sheetRows);
        }
      }else{
        // Try as delimited text first
        const text=await file.text();
        data=parseDelimited(text);
        if(!data.length) throw new Error("صيغة الملف غير مدعومة. استخدم Excel أو CSV أو TSV.");
      }
      if(!data.length) throw new Error("الملف لا يحتوي على صفوف بيانات.");
      setRows(data.map((r,i)=>detectRow(r,i)));
      setOpen(true);
    }catch(err:any){
      setError(err.message||"تعذر قراءة الملف.");
      setRows([]);
    }finally{setLoading(false)}
  };

  const updateMatch=(i:number,studentId:string)=>{
    const s=students.find(x=>x.id===studentId);
    setRows(v=>v.map((r,index)=>index===i?{
      ...r,studentId,studentName:s?.name||"غير مطابق",confidence:studentId?"manual":"none"
    }:r));
  };

  const summary=useMemo(()=>({
    total:rows.length,
    matched:rows.filter(r=>r.studentId).length,
    unmatched:rows.filter(r=>!r.studentId).length,
    attendance:rows.filter(r=>r.attendance).length,
    exams:rows.filter(r=>r.exam).length,
    homework:rows.filter(r=>r.homework).length,
    finance:rows.filter(r=>r.finance).length,
  }),[rows]);

  const applyAll=async()=>{
    const map=new Map<string,ImportedStudentData>();
    for(const r of rows){
      if(!r.studentId) continue;
      if(!map.has(r.studentId)){
        map.set(r.studentId,{studentId:r.studentId,attendance:[],homework:[],exams:[],finance:[]});
      }
      const item=map.get(r.studentId)!;
      if(r.attendance) item.attendance.push(r.attendance);
      if(r.homework) item.homework.push(r.homework);
      if(r.exam) item.exams.push(r.exam);
      if(r.finance) item.finance.push(r.finance);
    }
    const batch=[...map.values()];
    try{
      await onApply(batch);
      alert(`تم اعتماد البيانات لـ ${batch.length} طالب.`);
      setOpen(false);
    }catch(err:any){
      alert(err?.message||"تعذر اعتماد البيانات");
    }
  };

  return <section className="universal-import-v45">
    <div className="universal-import-head-v45">
      <div>
        <span>Smart Import Center</span>
        <h3>استيراد بيانات الطلاب دفعة واحدة</h3>
        <p>حضور وغياب + امتحانات + واجبات + مالية من ملف واحد أو أكثر.</p>
      </div>
      <label className="universal-upload-v45">
        {loading?"جاري القراءة...":"رفع Excel / CSV"}
        <input disabled={loading} type="file" accept=".xlsx,.xls,.xlsm,.xlsb,.ods,.csv,.tsv,.txt"
          onChange={async e=>{
            const file=e.target.files?.[0];
            if(file) await readFile(file);
            e.currentTarget.value="";
          }}/>
      </label>
    </div>

    <div className="universal-import-hints-v45">
      <span>المطابقة: الكود ← التليفون ← الاسم</span>
      <span>يدعم العربي والإنجليزي</span>
      <span>معاينة قبل الاعتماد</span>
    </div>

    {error?<div className="universal-error-v45">{error}</div>:null}

    {open?<div className="universal-preview-v45">
      <div className="universal-summary-v45">
        <span>الصفوف <b>{summary.total}</b></span>
        <span>مطابق <b>{summary.matched}</b></span>
        <span>غير مطابق <b>{summary.unmatched}</b></span>
        <span>حضور <b>{summary.attendance}</b></span>
        <span>امتحانات <b>{summary.exams}</b></span>
        <span>واجبات <b>{summary.homework}</b></span>
        <span>مالية <b>{summary.finance}</b></span>
      </div>

      <div className="universal-file-v45">الملف: <strong>{fileName}</strong></div>

      <div className="universal-table-v45">
        <div className="universal-table-head-v45">
          <span>الطالب من الملف</span><span>المطابقة</span><span>البيانات المكتشفة</span><span>ملاحظات</span>
        </div>
        {rows.map((r,i)=><article key={i} className={!r.studentId?"unmatched":""}>
          <div>
            <strong>{String(pick(r.raw,["student name","name","اسم الطالب","الاسم"])||"بدون اسم")}</strong>
            <small>{String(pick(r.raw,["student code","code","كود الطالب","الكود"])||"")}</small>
          </div>
          <select value={r.studentId} onChange={e=>updateMatch(i,e.target.value)}>
            <option value="">غير مطابق</option>
            {students.map(s=><option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </select>
          <div className="detected-badges-v45">
            {r.detected.length?r.detected.map(x=><span key={x}>{x}</span>):<span className="none">لا بيانات معروفة</span>}
          </div>
          <small>{r.confidence==="likely"?"مطابقة اسم تقريبية — راجعها":r.confidence==="none"?"يحتاج اختيار يدوي":""}</small>
        </article>)}
      </div>

      <div className="universal-actions-v45">
        <button onClick={()=>setOpen(false)}>إلغاء</button>
        <button className="primary" disabled={!summary.matched} onClick={applyAll}>اعتماد الكل وتوزيع البيانات</button>
      </div>
    </div>:null}
  </section>
}
