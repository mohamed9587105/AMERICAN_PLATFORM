"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import * as XLSX from "xlsx";

type Student={id:string;code:string;name:string;phone?:string;parentPhone?:string;course:string;balance?:number;remainingSessions?:number;sessionsBalance?:number};
type Mode="attendance"|"homework"|"exam"|"finance";
type Row=Record<string,string>;
const today=()=>new Date().toISOString().slice(0,10);
const emptyRows=(n=25):Row[]=>Array.from({length:n},()=>({}));

const configs={
  attendance:[
    ["identifier","كود الطالب / الهاتف"],["name","اسم الطالب"],["status","الحالة"],["note","ملاحظة"]
  ],
  homework:[
    ["identifier","كود الطالب / الهاتف"],["name","اسم الطالب"],["status","الحالة"],["score","الدرجة"],["maxScore","من"]
  ],
  exam:[
    ["identifier","كود الطالب / الهاتف"],["name","اسم الطالب"],["status","الحالة"],["reading","Reading"],["writing","Writing"],["total","Total"]
  ],
  finance:[
    ["identifier","كود الطالب / الهاتف"],["name","اسم الطالب"],["balance","رصيد الحصص"],["amount","المبلغ"],["note","ملاحظة"]
  ]
} as const;

const labels={attendance:"الحضور والغياب",homework:"الواجبات",exam:"الامتحانات",finance:"المالية"};

export default function BulkDataEntryCenter({allowedModes={attendance:true,homework:true,exam:true,finance:true}}:{allowedModes?:Record<string,boolean>}){
  const [students,setStudents]=useState<Student[]>([]);
  const firstAllowed=(["attendance","homework","exam","finance"] as Mode[]).find(m=>allowedModes[m]!==false)||"attendance";
  const [mode,setMode]=useState<Mode>(firstAllowed);
  const [courseFilter,setCourseFilter]=useState("all");
  const [sheetDate,setSheetDate]=useState(today());
  const [sheetTitle,setSheetTitle]=useState("");
  const [rows,setRows]=useState<Row[]>(emptyRows());
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [preview,setPreview]=useState<any[]>([]);
  const [activeSuggest,setActiveSuggest]=useState<{row:number;key:"identifier"|"name"}|null>(null);
  const fileInputRef=useRef<HTMLInputElement|null>(null);
  const [importInfo,setImportInfo]=useState("");
  const [financeLoading,setFinanceLoading]=useState(false);

  useEffect(()=>{fetch("/api/admin/all-students",{cache:"no-store"}).then(r=>r.json()).then(d=>setStudents(d.students||[])).catch(()=>setMessage("تعذر تحميل دليل الطلاب"))},[]);

  useEffect(()=>{
    if(mode!=="finance"||!students.length) return;
    let cancelled=false;
    setFinanceLoading(true);
    fetch("/api/admin/billing/bulk",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({studentIds:students.map(s=>s.id)})
    }).then(r=>r.json()).then(data=>{
      if(cancelled)return;
      const byId=new Map((data.rows||[]).map((x:any)=>[x.studentId,x]));
      setStudents(prev=>prev.map(s=>{
        const x:any=byId.get(s.id);
        return x?{...s,balance:Number(x.balance||0),remainingSessions:Number(x.remainingSessions||0)}:s;
      }));
    }).catch(()=>setMessage("تعذر تحميل أرصدة الطلاب")).finally(()=>{if(!cancelled)setFinanceLoading(false)});
    return ()=>{cancelled=true};
  },[mode]);

  const courses=useMemo(()=>Array.from(new Set(students.map(s=>s.course).filter(Boolean))).sort(),[students]);
  const filteredStudents=useMemo(()=>courseFilter==="all"?students:students.filter(s=>s.course===courseFilter),[students,courseFilter]);
  const cols=configs[mode];


  const normalizeHeader=(value:any)=>String(value??"").trim().toLowerCase()
    .replace(/[\s_\-\/\\]+/g,"")
    .replace(/[أإآ]/g,"ا").replace(/ة/g,"ه");

  const headerAliases:Record<string,string[]>={
    identifier:["كودالطالب","الكود","studentid","studentcode","code","رقمالطالب","الهاتف","رقمالهاتف","phone","mobile"],
    name:["اسمالطالب","الطالب","studentname","name"],
    status:["الحاله","الحالة","status"],
    note:["ملاحظه","ملاحظة","notes","note"],
    score:["الدرجه","الدرجة","score"],
    maxScore:["من","الدرجهالنهائيه","الدرجةالنهائية","maxscore","outof"],
    reading:["reading","ريدينج","الريدينج"],
    writing:["writing","رايتينج","الرايتينج"],
    total:["total","التوتال","الاجمالي","الإجمالي"],
    amount:["المبلغ","amount","payment","paid"],
    balance:["رصيدالحصص","الرصيد","عددالحصص","sessionsbalance","remainingsessions","balance"]
  };

  const keyForHeader=(header:any)=>{
    const h=normalizeHeader(header);
    for(const [key,aliases] of Object.entries(headerAliases)){
      if(aliases.map(normalizeHeader).includes(h)) return key;
    }
    return "";
  };

  const friendlyStatus=(value:any)=>{
    const v=normalizeHeader(value);
    if(mode==="attendance"){
      if(["حاضر","present","p","ح"].includes(v)) return "present";
      if(["غائب","absent","a","غ"].includes(v)) return "absent";
      if(["متاخر","متأخر","late","l","م"].map(normalizeHeader).includes(v)) return "late";
    }
    if(mode==="homework"){
      if(["تم","تمالواجب","completed","done"].map(normalizeHeader).includes(v)) return "completed";
      if(["ناقص","partial","incomplete"].map(normalizeHeader).includes(v)) return "partial";
      if(["لميعملالواجب","لميعمل","notdone","missing"].map(normalizeHeader).includes(v)) return "not_done";
    }
    if(mode==="exam"){
      if(["ادىالامتحان","أدىالامتحان","completed","done"].map(normalizeHeader).includes(v)) return "completed";
      if(["لميؤدالامتحان","لميؤدِالامتحان","notdone","absent"].map(normalizeHeader).includes(v)) return "not_done";
    }
    return String(value??"").trim();
  };

  const importExcelFile=async(file:File)=>{
    try{
      setImportInfo("جاري قراءة الشيت...");
      const buffer=await file.arrayBuffer();
      const workbook=XLSX.read(buffer,{type:"array"});
      const sheet=workbook.Sheets[workbook.SheetNames[0]];
      const matrix=XLSX.utils.sheet_to_json<any[]>(sheet,{header:1,defval:"",raw:false});
      if(!matrix.length){setImportInfo("الشيت فارغ.");return;}

      // Find the most likely header row among the first 12 rows.
      let headerIndex=-1;
      let mapped:string[]=[];
      let bestMatches=0;
      const allowedKeys=new Set(cols.map(([key])=>key));
      for(let r=0;r<Math.min(matrix.length,12);r++){
        const candidate=(matrix[r]||[]).map(keyForHeader);
        const score=candidate.filter(k=>k&&allowedKeys.has(k as any)).length;
        if(score>bestMatches){bestMatches=score;headerIndex=r;mapped=candidate;}
      }

      // If we can recognize at least 2 headers, use header mapping.
      // Otherwise fall back to the visible column order of the current sheet.
      const useHeaders=bestMatches>=2;
      const startRow=useHeaders?headerIndex+1:0;
      const positionalKeys=cols.map(([key])=>key);
      const imported:Row[]=[];

      for(const line of matrix.slice(startRow)){
        if(!line.some(v=>String(v??"").trim())) continue;
        const row:Row={};
        line.forEach((value:any,i:number)=>{
          const key=useHeaders?mapped[i]:positionalKeys[i];
          if(key&&allowedKeys.has(key as any)){
            row[key]=key==="status"?friendlyStatus(value):String(value??"").trim();
          }
        });

        // Ignore rows where nothing usable was mapped.
        const hasUsefulData=Object.entries(row).some(([k,v])=>k!=="total"&&String(v??"").trim()!=="");
        if(!hasUsefulData) continue;

        if(mode==="exam"){
          if(row.status==="not_done"){row.reading="";row.writing="";row.total="";}
          else if(String(row.reading??"").trim()!==""&&String(row.writing??"").trim()!==""){
            const rr=Number(row.reading),ww=Number(row.writing);
            if(Number.isFinite(rr)&&Number.isFinite(ww)) row.total=String((rr+ww)*10);
          }
        }
        imported.push(row);
      }

      if(!imported.length){
        setImportInfo("لم أستطع قراءة بيانات مفيدة من الشيت. جرّب قالب الأعمدة الظاهر أو رتّب الأعمدة بنفس ترتيب البرنامج.");
        return;
      }

      setRows([...imported,...emptyRows(Math.max(10,25-imported.length))]);
      setPreview([]);
      setMessage("");
      setImportInfo(`تم تحميل ${imported.length} صف وظهرت داخل الشيت ✓${useHeaders?"":" — تم الاعتماد على ترتيب الأعمدة"}`);
    }catch(e:any){
      setImportInfo(e?.message||"تعذر قراءة ملف Excel.");
    }finally{
      if(fileInputRef.current) fileInputRef.current.value="";
    }
  };

  const expectedHeaders=cols.map(([,label])=>label).join(" • ");

  const update=(i:number,key:string,value:string)=>setRows(prev=>prev.map((r,x)=>{
    if(x!==i)return r;
    const next={...r,[key]:value};
    if(mode==="exam"&&(key==="reading"||key==="writing"||key==="status")){
      const reading=Number(key==="reading"?value:next.reading||0);
      const writing=Number(key==="writing"?value:next.writing||0);
      if(next.status==="not_done"){next.reading="";next.writing="";next.total="";}
      else next.total=(Number.isFinite(reading)&&Number.isFinite(writing)&&String(next.reading||"")!==""&&String(next.writing||"")!=="")?String((reading+writing)*10):"";
    }
    return next;
  }));
  const activeRows=useMemo(()=>rows.filter(r=>Object.values(r).some(v=>String(v||"").trim())),[rows]);

  const suggestionsFor=(r:Row,key:"identifier"|"name")=>{
    const q=String(r[key]||"").trim().toLowerCase();
    if(!q)return [];
    return filteredStudents.filter(s=>{
      const values=key==="identifier"?[s.code,s.phone,s.parentPhone,s.name]:[s.name,s.code,s.phone];
      return values.filter(Boolean).some(v=>String(v).toLowerCase().includes(q));
    }).slice(0,7);
  };

  const chooseStudent=async(rowIndex:number,s:Student)=>{
    setRows(prev=>prev.map((r,i)=>i===rowIndex?{
      ...r,
      identifier:s.code||s.phone||"",
      name:s.name,
      ...(mode==="finance"?{balance:"جاري الحساب..."}:{})
    }:r));
    setActiveSuggest(null);

    if(mode!=="finance") return;

    try{
      const res=await fetch(`/api/admin/billing?studentId=${encodeURIComponent(s.id)}`,{cache:"no-store"});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"تعذر تحميل الرصيد");

      const cashBalance=Number(data.balance||0);
      const sessionPrice=Number(data.profile?.session_price||0);
      const remainingSessions=sessionPrice>0?Math.max(0,Math.floor(cashBalance/sessionPrice)):0;

      setStudents(prev=>prev.map(x=>x.id===s.id?{...x,balance:cashBalance,remainingSessions}:x));
      setRows(prev=>prev.map((r,i)=>i===rowIndex?{
        ...r,
        balance:String(remainingSessions)
      }:r));
    }catch{
      setRows(prev=>prev.map((r,i)=>i===rowIndex?{...r,balance:"0"}:r));
    }
  };

  const resolve=(r:Row)=>{
    const id=(r.identifier||"").trim().toLowerCase();
    const name=(r.name||"").trim().toLowerCase();
    let matches:Student[]=[];
    if(id)matches=filteredStudents.filter(s=>[s.code,s.phone,s.parentPhone].filter(Boolean).some(v=>String(v).trim().toLowerCase()===id));
    if(!matches.length&&name)matches=filteredStudents.filter(s=>s.name.trim().toLowerCase()===name);
    if(matches.length===1)return {status:"ok",student:matches[0]};
    if(matches.length>1)return {status:"ambiguous"};
    return {status:"missing"};
  };

  const validate=()=>{
    if((mode==="homework"||mode==="exam")&&!sheetTitle.trim()){
      setMessage("اكتب اسم الواجب أو الامتحان أعلى الشيت أولًا.");
      return [] as any[];
    }
    const result=activeRows.map((r,i)=>({row:i+1,data:r,...resolve(r)}));
    setPreview(result);
    if(!result.length)setMessage("اكتب بيانات طالب واحد على الأقل.");
    else if(result.some(x=>x.status!=="ok"))setMessage("راجع الصفوف المعلّمة قبل الاعتماد. لن يتم توزيع أي صف غير مؤكد.");
    else setMessage(`تمت مراجعة ${result.length} صف بنجاح. جاهز للاعتماد ✓`);
    return result;
  };

  const save=async()=>{
    const checked=validate();
    if(!checked.length||checked.some(x=>x.status!=="ok"))return;
    setBusy(true);setMessage("جاري توزيع البيانات على ملفات الطلاب...");
    try{
      const payload=checked.map((x:any)=>{
        const base:any={studentId:x.student.id,...x.data,date:sheetDate||today()};
        if(mode==="attendance"&&!base.status)base.status="present";
        if(mode==="homework"){base.title=sheetTitle.trim();if(!base.status)base.status="completed";}
        if(mode==="exam"){
          base.title=sheetTitle.trim();
          if(!base.status)base.status="completed";
          if(base.status==="not_done"){base.reading="";base.writing="";base.total="";}
          else{
            const reading=Number(base.reading||0),writing=Number(base.writing||0);
            base.total=(reading+writing)*10;
          }
        }
        return base;
      });
      const res=await fetch("/api/admin/bulk-entry",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:mode,rows:payload})});
      const data=await res.json(); if(!res.ok)throw new Error(data.error||"تعذر الحفظ");
      setMessage(`تم اعتماد وتوزيع ${data.count||0} صف بنجاح ✓`);
      setRows(emptyRows());setPreview([]);
    }catch(e:any){setMessage(e.message||"تعذر الحفظ")}finally{setBusy(false)}
  };

  const paste=(e:React.ClipboardEvent<HTMLInputElement>,rowIndex:number,colIndex:number)=>{
    const text=e.clipboardData.getData("text");
    if(!text.includes("\t")&&!text.includes("\n"))return;
    e.preventDefault();
    const matrix=text.replace(/\r/g,"").split("\n").filter(Boolean).map(line=>line.split("\t"));
    setRows(prev=>{
      const next=[...prev.map(r=>({...r}))];
      while(next.length<rowIndex+matrix.length)next.push({});
      matrix.forEach((line,ri)=>line.forEach((value,ci)=>{
        const col=cols[colIndex+ci]; if(col){
          next[rowIndex+ri][col[0]]=value.trim();
          if(mode==="exam"&&(col[0]==="reading"||col[0]==="writing")){
            const rr=Number(next[rowIndex+ri].reading||0),ww=Number(next[rowIndex+ri].writing||0);
            next[rowIndex+ri].total=(Number.isFinite(rr)&&Number.isFinite(ww))?String((rr+ww)*10):"";
          }
        }
      }));
      return next;
    });
  };

  const statusFor=(r:Row)=>{
    if(!Object.values(r).some(v=>String(v||"").trim()))return null;
    return resolve(r).status;
  };


  const performanceClass=(r:Row,key:string)=>{
    if(key==="status"){
      if(mode==="attendance"){
        if(r.status==="present")return "cell-success-v109";
        if(r.status==="late")return "cell-warning-v109";
        if(r.status==="absent")return "cell-danger-v109";
      }
      if(mode==="homework"){
        if(r.status==="not_done")return "cell-danger-v109";
        if(r.status==="partial")return "cell-warning-v109";
        if(r.status==="completed")return "cell-success-v109";
      }
      if(mode==="exam"){
        if(r.status==="not_done")return "cell-danger-v109";
        if(r.status==="completed")return "cell-success-v109";
      }
    }
    if(mode==="homework"&&key==="score"){
      const score=Number(r.score),max=Number(r.maxScore);
      if(!Number.isFinite(score)||!Number.isFinite(max)||max<=0)return "";
      const pct=score/max;
      if(pct<.5)return "cell-danger-v109";
      if(pct===.5)return "cell-warning-v109";
      if(pct>=.8)return "cell-success-v109";
      return "cell-mid-v109";
    }
    if(mode==="finance"&&(key==="identifier"||key==="name"||key==="balance"||key==="amount")){
      const direct=String(r.balance??"").trim();
      let sessions=(direct===""||direct==="جاري الحساب...")?NaN:Number(direct);
      if(!Number.isFinite(sessions)){
        const found=resolve(r);
        const s=found.status==="ok"?found.student:undefined;
        sessions=Number(s?.remainingSessions ?? s?.sessionsBalance ?? s?.balance);
      }
      if(Number.isFinite(sessions)){
        if(sessions<=0)return "cell-danger-v109";
        if(sessions===1)return "cell-warning-v109";
        return "cell-success-v109";
      }
    }
    if(mode==="exam"&&(key==="reading"||key==="writing"||key==="total")){
      if(r.status==="not_done")return "cell-danger-v109";
      const reading=Number(r.reading),writing=Number(r.writing);
      if(!Number.isFinite(reading)||!Number.isFinite(writing)||String(r.reading??"")===""||String(r.writing??"")==="")return "";
      const total=(reading+writing)*10;
      // SAT-style 1600 scale: <50% red, exactly 50% orange, >=80% green.
      const pct=total/1600;
      if(pct<.5)return "cell-danger-v109";
      if(pct===.5)return "cell-warning-v109";
      if(pct>=.8)return "cell-success-v109";
      return "cell-mid-v109";
    }
    return "";
  };

  return <main className="excel-entry-v95" dir="rtl">
    <section className="bulk-command-head-v108">
      <div><span>DATA OPERATIONS</span><h1>مركز الإدخال الجماعي</h1><p>إدخال سريع، مراجعة واضحة، واعتماد آمن للبيانات.</p></div>
      <div className="bulk-live-v108"><i/> جاهز للعمل</div>
    </section>

    <section className="excel-tabs-v95">
      {(Object.keys(labels) as Mode[]).filter(m=>allowedModes[m]!==false).map(m=><button key={m} className={mode===m?"active":""} onClick={()=>{setMode(m);setRows(emptyRows());setPreview([]);setMessage("");setSheetTitle("");setSheetDate(today())}}>{labels[m]}</button>)}
    </section>

    <section className="excel-quick-settings-v99">
      <label><span>تاريخ الشيت</span><input type="date" value={sheetDate} onChange={e=>setSheetDate(e.target.value)}/></label>
      {(mode==="homework"||mode==="exam")?<label className="grow"><span>{mode==="homework"?"اسم الواجب":"اسم الامتحان"}</span><input value={sheetTitle} onChange={e=>setSheetTitle(e.target.value)} placeholder={mode==="homework"?"مثال: Homework 3":"مثال: Practice Test 2"}/></label>:null}
      {mode==="attendance"?<button type="button" className="fill-present-v99" onClick={()=>setRows(prev=>prev.map(r=>Object.values(r).some(v=>String(v||"").trim())?{...r,status:"present"}:r))}>تعبئة الموجودين: حاضر</button>:null}
    </section>

    <section className={`excel-import-card-v101 mode-${mode}`}>
      <div className="excel-import-copy-v101">
        <span className="excel-import-icon-v101">↥</span>
        <div><strong>استيراد Excel</strong><p>XLSX / XLS / CSV — تعبئة الشيت بالكامل بضغطة واحدة</p></div>
      </div>
      <div className="excel-import-actions-v101">
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e=>{const f=e.target.files?.[0];if(f)importExcelFile(f)}}/>
        <button type="button" onClick={()=>fileInputRef.current?.click()}>اختيار ملف Excel</button>
        {importInfo?<span>{importInfo}</span>:null}
      </div>
    </section>

    <section className="excel-filterbar-v97">
      <label><span>فلترة حسب الكورس</span><select value={courseFilter} onChange={e=>{setCourseFilter(e.target.value);setPreview([]);setMessage("")}}>
        <option value="all">كل الكورسات</option>{courses.map(c=><option key={c} value={c}>{c}</option>)}
      </select></label>
      <div className="excel-filter-count-v97"><strong>{filteredStudents.length}</strong><span>{mode==="finance"&&financeLoading?"جاري تحميل الأرصدة...":"طالب داخل نطاق البحث"}</span></div>
    </section>

    <section className="excel-help-v95">
      <b>طريقة الاستخدام:</b> التاريخ مرة واحدة أعلى الشيت. الحالة تُختار من قائمة أمام كل طالب. في الامتحانات اختر «أدى الامتحان» أو «لم يؤدِ الامتحان»؛ ولو أدى الامتحان اكتب Reading وWriting فقط، والـ Total يُحسب تلقائيًا = (Reading + Writing) × 10.
    </section>

    {mode==="finance"?<section className="finance-hint-v113">
      <strong>رصيد الحصص تلقائي</strong>
      <span>اختر الطالب، وسيحسب البرنامج الرصيد من الحساب المالي: 0 أحمر · حصة واحدة برتقالي · أكثر من حصة أخضر.</span>
    </section>:null}

    <section className="bulk-summary-v108">
      <div><span>الصفوف المستخدمة</span><strong>{activeRows.length}</strong></div>
      <div className="ok"><span>مطابقة مؤكدة</span><strong>{activeRows.filter(r=>resolve(r).status==="ok").length}</strong></div>
      <div className="bad"><span>تحتاج مراجعة</span><strong>{activeRows.filter(r=>resolve(r).status!=="ok").length}</strong></div>
      <div className="course"><span>نطاق العمل</span><strong>{courseFilter==="all"?"كل الكورسات":courseFilter}</strong></div>
    </section>

    <section className="excel-sheet-shell-v95">
      <div className="excel-sheet-scroll-v95">
        <table className="excel-sheet-v95">
          <thead><tr><th className="row-num">#</th><th className="check-col">فحص</th>{cols.map(([,label],i)=><th key={i}>{label}</th>)}</tr></thead>
          <tbody>{rows.map((r,ri)=>{
            const st=statusFor(r);
            return <tr key={ri} className={st?`row-${st}`:""}>
              <td className="row-num">{ri+1}</td><td className="check-col">{st==="ok"?"✓":st==="ambiguous"?"!":st==="missing"?"×":""}</td>
              {cols.map(([key],ci)=><td key={key} className={performanceClass(r,key)}><div className={(key==="identifier"||key==="name")?"excel-autocomplete-v96":""}>
                {key==="status"?<select
                  value={r[key]||""}
                  onChange={e=>update(ri,key,e.target.value)}
                  className="excel-status-select-v100"
                >
                  <option value="">اختر الحالة</option>
                  {mode==="attendance"?<>
                    <option value="present">حاضر</option>
                    <option value="absent">غائب</option>
                    <option value="late">متأخر</option>
                  </>:null}
                  {mode==="homework"?<>
                    <option value="completed">تم الواجب</option>
                    <option value="partial">ناقص</option>
                    <option value="not_done">لم يعمل الواجب</option>
                  </>:null}
                  {mode==="exam"?<>
                    <option value="completed">أدى الامتحان</option>
                    <option value="not_done">لم يؤدِ الامتحان</option>
                  </>:null}
                </select>:<input
                  value={r[key]||""}
                  type={["amount","balance","score","reading","writing","total","maxScore"].includes(key)?"number":"text"}
                  readOnly={key==="total"||key==="balance"||(mode==="exam"&&r.status==="not_done"&&(key==="reading"||key==="writing"))}
                  placeholder={ri===0?(key==="identifier"?"اكتب الكود أو الهاتف أو الاسم":key==="name"?"ابدأ بكتابة اسم الطالب":""):""}
                  onChange={e=>{
                    update(ri,key,e.target.value);
                    if(key==="identifier"||key==="name")setActiveSuggest({row:ri,key:key as "identifier"|"name"});
                  }}
                  onFocus={()=>{if(key==="identifier"||key==="name")setActiveSuggest({row:ri,key:key as "identifier"|"name"})}}
                  onBlur={()=>{if(key==="identifier"||key==="name")setTimeout(()=>setActiveSuggest(a=>a?.row===ri&&a.key===key?null:a),140)}}
                  onPaste={e=>paste(e,ri,ci)}
                  autoComplete="off"
                />}
                {(key==="identifier"||key==="name")&&activeSuggest?.row===ri&&activeSuggest.key===key&&String(r[key]||"").trim()?<div className="excel-suggestions-v96">
                  {suggestionsFor(r,key as "identifier"|"name").length?suggestionsFor(r,key as "identifier"|"name").map(s=><button type="button" key={s.id} onMouseDown={e=>e.preventDefault()} onClick={()=>chooseStudent(ri,s)}>
                    <span><strong>{s.name}</strong><small>{s.course||"بدون كورس"}</small></span><span className="suggest-code-v96">{s.code||"—"}{s.phone?` · ${s.phone}`:""}</span>
                  </button>):<div className="no-suggestion-v96">لا توجد نتائج مطابقة</div>}
                </div>:null}
              </div></td>)}
            </tr>
          })}</tbody>
        </table>
      </div>
      <div className="excel-actions-v95">
        <button className="secondary" onClick={()=>setRows(p=>[...p,...emptyRows(10)])}>+ 10 صفوف</button>
        <button className="secondary" onClick={validate}>مراجعة البيانات</button>
        <button className="primary" disabled={busy||!activeRows.length} onClick={save}>{busy?"جاري التوزيع...":"اعتماد وتوزيع البيانات"}</button>
      </div>
      {message?<div className="excel-message-v95">{message}</div>:null}
    </section>

    {preview.length?<section className="excel-review-v95"><h3>نتيجة المراجعة</h3><div className="review-grid-v95">{preview.map((x:any,i)=><div key={i} className={`review-${x.status}`}>
      <b>صف {x.row}</b><span>{x.data.name||x.data.identifier||"بدون اسم"}</span><small>{x.status==="ok"?`مطابق: ${x.student.name} (${x.student.code})`:x.status==="ambiguous"?"أكثر من طالب مطابق — استخدم الكود أو الهاتف":"الطالب غير موجود في النظام"}</small>
    </div>)}</div></section>:null}
  </main>
}
