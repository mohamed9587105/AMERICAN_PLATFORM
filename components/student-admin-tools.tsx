"use client";

import {useState} from "react";

type StudentLite={
  id:string;code:string;name:string;phone:string;course:string;
  parentName:string;parentPhone:string;parent2Name:string;parent2Phone:string;
};

type ImportRow={
  code?:string;name:string;phone?:string;course:string;
  parentName:string;parentPhone:string;parentPassword?:string;
  parent2Name?:string;parent2Phone?:string;parent2Password?:string;
};

declare global{interface Window{XLSX?:any}}
const SHEETJS="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";

const norm=(v:any)=>String(v??"").toLowerCase().replace(/[أإآ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").replace(/[^\p{L}\p{N}]+/gu," ").trim();
function pick(row:any,aliases:string[]){
  const entries=Object.entries(row);
  for(const a of aliases){const x=entries.find(([k])=>norm(k)===norm(a));if(x)return x[1]}
  for(const a of aliases){const x=entries.find(([k])=>norm(k).includes(norm(a)));if(x)return x[1]}
  return "";
}
function csvEscape(v:any){const s=String(v??"");return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
function downloadCsv(name:string,headers:string[],rows:any[][]){
  const text="\ufeff"+[headers,...rows].map(r=>r.map(csvEscape).join(",")).join("\r\n");
  const blob=new Blob([text],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
function parseCsv(text:string){
  const rows:string[][]=[];let row:string[]=[],cell="",q=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){cell+='"';i++}else q=!q}else if(c===","&&!q){row.push(cell);cell=""}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);cell="";if(row.some(x=>x.trim()))rows.push(row);row=[]}else cell+=c}
  if(cell||row.length){row.push(cell);if(row.some(x=>x.trim()))rows.push(row)}
  const h=rows.shift()||[];return rows.map(r=>Object.fromEntries(h.map((x,i)=>[x,r[i]||""])));
}
async function loadXlsx(){
  if(window.XLSX)return window.XLSX;
  await new Promise<void>((resolve,reject)=>{const s=document.createElement("script");s.src=SHEETJS;s.onload=()=>resolve();s.onerror=()=>reject(new Error("تعذر تحميل قارئ Excel. احفظ الملف CSV وجرب مرة أخرى."));document.head.appendChild(s)});
  return window.XLSX;
}

export default function StudentAdminTools({students,backendMode,onLocalImported}:{students:StudentLite[];backendMode:"checking"|"demo"|"online";onLocalImported:(rows:ImportRow[])=>void}){
  const [open,setOpen]=useState(false);const [rows,setRows]=useState<ImportRow[]>([]);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");

  const mapRows=(raw:any[]):ImportRow[]=>raw.map(r=>({
    code:String(pick(r,["كود الطالب","الكود","student code","code"])).trim(),
    name:String(pick(r,["اسم الطالب","الطالب","student name","name"])).trim(),
    phone:String(pick(r,["رقم الطالب","تليفون الطالب","student phone","phone"])).trim(),
    course:String(pick(r,["الكورس","course"])).trim(),
    parentName:String(pick(r,["اسم ولي الامر الاول","ولي الامر الاول","اسم ولي الأمر الأول","parent 1 name","parent name"])).trim(),
    parentPhone:String(pick(r,["رقم ولي الامر الاول","تليفون ولي الامر الاول","رقم ولي الأمر الأول","parent 1 phone","parent phone"])).trim(),
    parentPassword:String(pick(r,["باسورد ولي الامر الاول","parent 1 password","password"])).trim(),
    parent2Name:String(pick(r,["اسم ولي الامر الثاني","اسم ولي الأمر الثاني","parent 2 name"])).trim(),
    parent2Phone:String(pick(r,["رقم ولي الامر الثاني","رقم ولي الأمر الثاني","parent 2 phone"])).trim(),
    parent2Password:String(pick(r,["باسورد ولي الامر الثاني","parent 2 password"])).trim(),
  })).filter(r=>r.name&&r.course&&r.parentPhone);

  const read=async(file:File)=>{
    setBusy(true);setMessage("");try{
      const ext=file.name.split(".").pop()?.toLowerCase();let raw:any[]=[];
      if(ext==="csv"||ext==="txt")raw=parseCsv(await file.text());
      else{const XLSX=await loadXlsx();const wb=XLSX.read(await file.arrayBuffer(),{type:"array"});for(const n of wb.SheetNames)raw.push(...XLSX.utils.sheet_to_json(wb.Sheets[n],{defval:""}))}
      const mapped=mapRows(raw);if(!mapped.length)throw new Error("لم أجد صفوف مطابقة. استخدم قالب الطلبة من الزر الموجود هنا.");setRows(mapped);setOpen(true);
    }catch(e:any){setMessage(e.message||"تعذر قراءة الملف")}finally{setBusy(false)}
  };

  const importAll=async()=>{
    setBusy(true);setMessage("");try{
      if(backendMode==="online"){
        const res=await fetch("/api/admin/students/bulk",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({rows})});
        const data=await res.json();if(!res.ok)throw new Error(data.error||"تعذر الاستيراد");
        const credRows=(data.results||[]).flatMap((x:any)=>x.credentials.map((c:any)=>[c.parentCode,c.name,c.phone,x.student.code,x.student.name,x.student.course_name||x.student.course?.name||"",c.password||"حساب موجود مسبقًا"]));
        if(credRows.length)downloadCsv("parent-access-new-import.csv",["كود ولي الأمر","اسم ولي الأمر","رقم ولي الأمر","كود الطالب","اسم الطالب","الكورس","الباسورد المؤقت"],credRows);
        setMessage(`تمت إضافة ${data.results?.length||0} طالب${data.errors?.length?` · ${data.errors.length} صفوف بها مشكلة`:""}. وتم تنزيل شيت بيانات الدخول الجديدة.`);
      }else{
        onLocalImported(rows);setMessage(`تمت إضافة ${rows.length} طالب في وضع Demo. الحفظ المشترك بين الأجهزة يحتاج قاعدة البيانات.`);
      }
      setOpen(false);
    }catch(e:any){setMessage(e.message||"تعذر الاستيراد")}finally{setBusy(false)}
  };

  const exportParents=async()=>{
    let data:any[][]=[];
    if(backendMode==="online"){
      const res=await fetch("/api/admin/parents/export");const j=await res.json();
      data=(j.rows||[]).map((r:any)=>[r.parentCode,r.parentName,r.parentPhone,r.studentCode,r.studentName,r.course,r.relation===1?"الأول":"الثاني"]);
    }else{
      data=students.flatMap(s=>[
        [`PR-${s.parentPhone.slice(-6)}`,s.parentName,s.parentPhone,s.code,s.name,s.course,"الأول"],
        ...(s.parent2Phone?[[`PR-${s.parent2Phone.slice(-6)}`,s.parent2Name,s.parent2Phone,s.code,s.name,s.course,"الثاني"]]:[])
      ]);
    }
    downloadCsv("parents-codes.csv",["كود ولي الأمر","اسم ولي الأمر","رقم ولي الأمر","كود الطالب","اسم الطالب","الكورس","الصفة"],data);
  };

  const template=()=>downloadCsv("student-import-template.csv",
    ["كود الطالب","اسم الطالب","رقم الطالب","الكورس","اسم ولي الأمر الأول","رقم ولي الأمر الأول","باسورد ولي الأمر الأول","اسم ولي الأمر الثاني","رقم ولي الأمر الثاني","باسورد ولي الأمر الثاني"],
    [["","مثال: محمد أحمد","01000000000","EST","أحمد محمد","01100000000","","منى أحمد","01200000000",""]]
  );

  const copyRegistration=async()=>{const url=`${location.origin}/register`;await navigator.clipboard.writeText(url);setMessage(`تم نسخ رابط استمارة الحجز: ${url}`)};

  return <section className="student-tools-v47">
    <div className="student-tools-title-v47"><div><span>إدارة جماعية</span><h3>الطلبة وأولياء الأمور</h3></div><b>{backendMode==="online"?"Online":"Demo"}</b></div>
    <div className="student-tools-buttons-v47 student-tools-buttons-v74">
      <label className="student-tool-primary-v47 student-tool-3d-v74">{busy?"جاري القراءة...":"استيراد الطلبة Excel / CSV"}<input disabled={busy} type="file" accept=".xlsx,.xls,.csv,.txt" onChange={e=>{const f=e.target.files?.[0];if(f)read(f)}}/></label>
      <button className="student-tool-3d-v74" onClick={template}>تحميل قالب الطلبة</button>
      <button className="student-tool-3d-v74" onClick={exportParents}>تحميل شيت أولياء الأمور</button>
      <button className="student-tool-3d-v74" onClick={copyRegistration}>نسخ رابط استمارة الحجز</button>
      <a className="student-tool-3d-v74" href="/register" target="_blank">فتح الاستمارة</a>
      <a className="student-tool-3d-v74" href="/admin/students">كل الطلاب</a>
      <a className="student-tool-3d-v74" href="/admin/finance">التقارير المالية</a>
    </div>
    {message?<div className="student-tools-message-v47">{message}</div>:null}
    {open?<div className="student-import-preview-v47">
      <div className="student-import-preview-head-v47"><strong>معاينة الاستيراد</strong><span>{rows.length} طالب</span></div>
      <div className="student-import-list-v47">{rows.slice(0,30).map((r,i)=><article key={i}><b>{r.name}</b><span>{r.course}</span><span>{r.parentName} · {r.parentPhone}</span></article>)}</div>
      <div className="student-import-actions-v47"><button onClick={()=>setOpen(false)}>إلغاء</button><button className="primary" disabled={busy} onClick={importAll}>إضافة الكل</button></div>
    </div>:null}
  </section>;
}
