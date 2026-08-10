"use client";

import {useMemo,useState} from "react";
import * as XLSX from "xlsx";

type Student={
  id:string;
  code:string;
  name:string;
  phone:string;
  parentPhone?:string;
};

type ZoomRow={
  rawName:string;
  email:string;
  joinTime:string;
  leaveTime:string;
  duration:number;
  matchedStudentId:string;
  matchedName:string;
  confidence:"exact"|"likely"|"manual"|"none";
  status:"present"|"late"|"absent";
};

type Props={
  students:Student[];
  onApply:(rows:{studentId:string;date:string;status:"present"|"late"|"absent";note:string}[])=>void;
  weekStart:string;
};

const normalize=(s:string)=>
  s.toLowerCase()
   .replace(/[أإآ]/g,"ا")
   .replace(/ة/g,"ه")
   .replace(/ى/g,"ي")
   .replace(/[^\p{L}\p{N}]+/gu," ")
   .trim();

function parseDuration(v:any){
  if(v==null||v==="") return 0;
  if(typeof v==="number") return Math.round(v);
  const s=String(v).trim();
  if(/^\d+$/.test(s)) return Number(s);
  const parts=s.split(":").map(Number);
  if(parts.length===3) return parts[0]*60+parts[1]+Math.round(parts[2]/60);
  if(parts.length===2) return parts[0]*60+parts[1];
  const m=s.match(/(\d+)\s*(min|minute|دقيق)/i);
  return m?Number(m[1]):0;
}

function pick(row:any,keys:string[]){
  const entries=Object.entries(row);
  for(const key of keys){
    const found=entries.find(([k])=>normalize(k).includes(normalize(key)));
    if(found) return found[1];
  }
  return "";
}

export default function ZoomAttendanceImporter({students,onApply,weekStart}:Props){
  const [rows,setRows]=useState<ZoomRow[]>([]);
  const [fileName,setFileName]=useState("");
  const [sessionDate,setSessionDate]=useState(weekStart);
  const [lateAfter,setLateAfter]=useState(15);
  const [minPresence,setMinPresence]=useState(70);
  const [sessionMinutes,setSessionMinutes]=useState(120);
  const [open,setOpen]=useState(false);

  const matchStudent=(name:string,email:string)=>{
    const n=normalize(name);
    const exact=students.find(s=>normalize(s.name)===n||normalize(s.code)===n);
    if(exact) return {id:exact.id,name:exact.name,confidence:"exact" as const};

    const likely=students.find(s=>{
      const sn=normalize(s.name);
      return sn && n && (sn.includes(n)||n.includes(sn));
    });
    if(likely) return {id:likely.id,name:likely.name,confidence:"likely" as const};

    return {id:"",name:"غير مطابق",confidence:"none" as const};
  };

  const deriveStatus=(duration:number,join:string)=>{
    const ratio=sessionMinutes>0?duration/sessionMinutes*100:0;
    if(ratio<minPresence) return "absent" as const;
    if(join){
      const m=String(join).match(/(\d{1,2}):(\d{2})/);
      if(m){
        // Without session start in Zoom export, duration is more reliable.
        // Mark "late" only when presence is acceptable and relatively short.
        if(ratio<90) return "late" as const;
      }
    }
    return "present" as const;
  };

  const parseFile=async(file:File)=>{
    setFileName(file.name);
    const buf=await file.arrayBuffer();
    const wb=XLSX.read(buf,{type:"array"});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const data=XLSX.utils.sheet_to_json<any>(ws,{defval:""});

    const parsed=data.map((r:any)=>{
      const rawName=String(pick(r,["name","participant","display name","اسم"]));
      const email=String(pick(r,["email","mail","البريد"]));
      const joinTime=String(pick(r,["join time","join","وقت الدخول"]));
      const leaveTime=String(pick(r,["leave time","leave","وقت الخروج"]));
      const duration=parseDuration(pick(r,["duration","minutes","duration (minutes)","المدة"]));
      const match=matchStudent(rawName,email);
      return {
        rawName,email,joinTime,leaveTime,duration,
        matchedStudentId:match.id,
        matchedName:match.name,
        confidence:match.confidence,
        status:deriveStatus(duration,joinTime)
      } satisfies ZoomRow;
    });

    setRows(parsed);
    setOpen(true);
  };

  const updateMatch=(index:number,studentId:string)=>{
    const s=students.find(x=>x.id===studentId);
    setRows(v=>v.map((r,i)=>i===index?{
      ...r,
      matchedStudentId:studentId,
      matchedName:s?.name||"غير مطابق",
      confidence:studentId?"manual":"none"
    }:r));
  };

  const summary=useMemo(()=>({
    total:rows.length,
    matched:rows.filter(r=>r.matchedStudentId).length,
    unmatched:rows.filter(r=>!r.matchedStudentId).length,
    present:rows.filter(r=>r.status==="present").length,
    late:rows.filter(r=>r.status==="late").length,
    absent:rows.filter(r=>r.status==="absent").length
  }),[rows]);

  const apply=()=>{
    const mapped=rows
      .filter(r=>r.matchedStudentId)
      .map(r=>({
        studentId:r.matchedStudentId,
        date:sessionDate,
        status:r.status,
        note:`Zoom: ${r.duration} دقيقة${r.rawName?` · ${r.rawName}`:""}`
      }));
    onApply(mapped);
    alert(`تم اعتماد ${mapped.length} سجل حضور من Zoom.`);
    setOpen(false);
  };

  return <section className="zoom-import-card-v43">
    <div className="zoom-import-head-v43">
      <div>
        <span>Zoom Attendance</span>
        <h3>استيراد الحضور من Zoom</h3>
        <p>ارفع CSV أو Excel، راجع المطابقة، ثم اعتمد الحضور.</p>
      </div>
      <label className="zoom-upload-btn-v43">
        رفع ملف Zoom
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={e=>{const f=e.target.files?.[0];if(f)parseFile(f)}}
        />
      </label>
    </div>

    <div className="zoom-rules-v43">
      <div><label>تاريخ الحصة</label><input type="date" value={sessionDate} onChange={e=>setSessionDate(e.target.value)}/></div>
      <div><label>مدة الحصة بالدقائق</label><input type="number" value={sessionMinutes} onChange={e=>setSessionMinutes(Number(e.target.value)||0)}/></div>
      <div><label>الحد الأدنى للحضور %</label><input type="number" value={minPresence} onChange={e=>setMinPresence(Number(e.target.value)||0)}/></div>
      <div><label>التأخير بعد (دقيقة)</label><input type="number" value={lateAfter} onChange={e=>setLateAfter(Number(e.target.value)||0)}/></div>
    </div>

    {fileName?<div className="zoom-file-name-v43">الملف: <strong>{fileName}</strong></div>:null}

    {open?<div className="zoom-preview-v43">
      <div className="zoom-summary-v43">
        <span>الإجمالي <b>{summary.total}</b></span>
        <span>مطابق <b>{summary.matched}</b></span>
        <span>غير مطابق <b>{summary.unmatched}</b></span>
        <span>حاضر <b>{summary.present}</b></span>
        <span>متأخر <b>{summary.late}</b></span>
        <span>غائب <b>{summary.absent}</b></span>
      </div>

      <div className="zoom-table-v43">
        <div className="zoom-table-head-v43">
          <span>اسم Zoom</span><span>المدة</span><span>الطالب</span><span>الحالة</span>
        </div>
        {rows.map((r,i)=><article key={i}>
          <div>
            <strong>{r.rawName||"بدون اسم"}</strong>
            <small>{r.email}</small>
          </div>
          <span>{r.duration} دقيقة</span>
          <select value={r.matchedStudentId} onChange={e=>updateMatch(i,e.target.value)}>
            <option value="">غير مطابق</option>
            {students.map(s=><option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </select>
          <select value={r.status} onChange={e=>setRows(v=>v.map((x,j)=>j===i?{...x,status:e.target.value as any}:x))}>
            <option value="present">حاضر</option>
            <option value="late">متأخر</option>
            <option value="absent">غائب</option>
          </select>
        </article>)}
      </div>

      <div className="zoom-actions-v43">
        <button onClick={()=>setOpen(false)}>إلغاء</button>
        <button className="primary" disabled={!summary.matched} onClick={apply}>اعتماد الحضور</button>
      </div>
    </div>:null}
  </section>
}
