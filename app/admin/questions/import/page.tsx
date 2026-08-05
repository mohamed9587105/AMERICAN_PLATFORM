'use client';

import {ChangeEvent, useMemo, useState} from 'react';
import Link from 'next/link';
import {satReadingWritingModule1} from '@/data/sat/reading-writing/module-1';
import type {Difficulty, Question, SectionCode} from '@/types/question';

const STORAGE_KEY='american-platform-question-bank-v2';
const choiceIds=['A','B','C','D'];
type ImportRow={index:number;question:Question|null;errors:string[];duplicate:boolean};
type SourceMode='FILE'|'PASTE';
type MergeMode='MERGE'|'REPLACE'|'UPDATE';

function currentBank():Question[]{
  try{const x=localStorage.getItem(STORAGE_KEY);return x?JSON.parse(x):satReadingWritingModule1}catch{return satReadingWritingModule1}
}
function splitCsvLine(line:string){
  const out:string[]=[];let cur='';let quoted=false;
  for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){cur+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){out.push(cur.trim());cur=''}else cur+=c}out.push(cur.trim());return out;
}
function normalizeQuestion(raw:any,index:number):ImportRow{
  const errors:string[]=[];
  const choices=Array.isArray(raw.choices)?raw.choices:
    choiceIds.map(id=>({id,text:String(raw[`choice${id}`]??raw[`choice_${id.toLowerCase()}`]??'')}));
  const q:Question={
    id:String(raw.id||`SAT-RW-M1-IMPORT-${Date.now()}-${index+1}`).trim(),
    exam:(String(raw.exam||'SAT').toUpperCase()==='EST'?'EST':String(raw.exam||'SAT').toUpperCase()==='ACT'?'ACT':'SAT'),
    section:(String(raw.section||'READING_WRITING').toUpperCase().includes('MATH')?'MATH':'READING_WRITING') as SectionCode,
    module:Number(raw.module||1),domain:String(raw.domain||'').trim(),skill:String(raw.skill||'').trim(),
    difficulty:(['EASY','MEDIUM','HARD'].includes(String(raw.difficulty||'').toUpperCase())?String(raw.difficulty).toUpperCase():'MEDIUM') as Difficulty,
    estimatedTimeSeconds:Number(raw.estimatedTimeSeconds||raw.time||70),passage:String(raw.passage||''),prompt:String(raw.prompt||raw.question||'').trim(),
    choices:choices.map((c:any,i:number)=>({id:String(c.id||choiceIds[i]||i+1),text:String(c.text??c)})).slice(0,4),
    correctChoiceId:String(raw.correctChoiceId||raw.correct||'A').toUpperCase(),explanation:String(raw.explanation||''),
    commonMistakes:Array.isArray(raw.commonMistakes)?raw.commonMistakes:String(raw.commonMistakes||'').split('|').map((x:string)=>x.trim()).filter(Boolean),
    tags:Array.isArray(raw.tags)?raw.tags:String(raw.tags||'').split('|').map((x:string)=>x.trim()).filter(Boolean)
  };
  if(!q.id)errors.push('ID مفقود');if(!q.prompt)errors.push('نص السؤال مفقود');if(!q.domain)errors.push('Domain مفقود');if(!q.skill)errors.push('Skill مفقود');
  if(q.choices.length!==4||q.choices.some(c=>!c.text.trim()))errors.push('يجب وجود 4 اختيارات مكتملة');
  if(!q.choices.some(c=>c.id===q.correctChoiceId))errors.push('الإجابة الصحيحة غير مطابقة للاختيارات');
  if(!Number.isFinite(q.module)||q.module<1)errors.push('Module غير صالح');if(!Number.isFinite(q.estimatedTimeSeconds)||q.estimatedTimeSeconds<10)errors.push('الوقت المتوقع غير صالح');
  return {index,question:q,errors,duplicate:false};
}
function parseJson(text:string):ImportRow[]{const raw=JSON.parse(text);const arr=Array.isArray(raw)?raw:raw.questions;if(!Array.isArray(arr))throw new Error('JSON لا يحتوي على questions');return arr.map(normalizeQuestion)}
function parseCsv(text:string):ImportRow[]{
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());if(lines.length<2)throw new Error('CSV فارغ');
  const headers=splitCsvLine(lines[0]);return lines.slice(1).map((line,i)=>{const vals=splitCsvLine(line);const raw:any={};headers.forEach((h,j)=>raw[h.trim()]=vals[j]??'');return normalizeQuestion(raw,i)});
}
export default function ImportEngine(){
  const [rows,setRows]=useState<ImportRow[]>([]);const [raw,setRaw]=useState('');const [source,setSource]=useState<SourceMode>('FILE');const [mode,setMode]=useState<MergeMode>('MERGE');const [message,setMessage]=useState('');const [fileName,setFileName]=useState('');
  const bank=typeof window==='undefined'?[]:currentBank();
  const enriched=useMemo(()=>{const ids=new Set(bank.map(q=>q.id));return rows.map(r=>({...r,duplicate:!!r.question&&ids.has(r.question.id)}))},[rows]);
  const stats=useMemo(()=>({total:enriched.length,valid:enriched.filter(r=>r.errors.length===0).length,invalid:enriched.filter(r=>r.errors.length>0).length,duplicates:enriched.filter(r=>r.duplicate).length}),[enriched]);
  function parse(text:string,name='pasted-data'){try{const parsed=name.toLowerCase().endsWith('.csv')?parseCsv(text):parseJson(text);setRows(parsed);setMessage(`تم تحليل ${parsed.length} سؤال`)}catch(e){setRows([]);setMessage(e instanceof Error?e.message:'تعذر قراءة البيانات')}}
  function onFile(e:ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;setFileName(f.name);const reader=new FileReader();reader.onload=()=>parse(String(reader.result),f.name);reader.readAsText(f);e.target.value=''}
  function commit(){
    const valid=enriched.filter(r=>r.question&&r.errors.length===0).map(r=>r.question!)
    if(!valid.length){setMessage('لا توجد أسئلة سليمة للاستيراد');return}
    const existing=currentBank();let next:Question[];
    if(mode==='REPLACE')next=valid;
    else if(mode==='UPDATE'){const incoming=new Map(valid.map(q=>[q.id,q]));next=[...existing.map(q=>incoming.get(q.id)||q),...valid.filter(q=>!existing.some(x=>x.id===q.id))]}
    else next=[...valid.filter(q=>!existing.some(x=>x.id===q.id)),...existing];
    localStorage.setItem(STORAGE_KEY,JSON.stringify(next));setMessage(`تم حفظ ${valid.length} سؤال. إجمالي البنك الآن ${next.length}`)
  }
  function downloadTemplate(){const csv='id,exam,section,module,domain,skill,difficulty,estimatedTimeSeconds,passage,prompt,choiceA,choiceB,choiceC,choiceD,correctChoiceId,explanation,tags,commonMistakes\nSAT-RW-M1-1001,SAT,READING_WRITING,1,Information and Ideas,Central Ideas and Details,MEDIUM,70,Passage text,Question text,Choice A,Choice B,Choice C,Choice D,B,Explanation,tag1|tag2,mistake1|mistake2';const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='question-import-template.csv';a.click();URL.revokeObjectURL(a.href)}
  return <main className="import-page">
    <header className="cms-pro-topbar"><div className="cms-brand"><Link href="/admin/questions">M</Link><div><b>Question Import Engine</b><span>Mastery • Question Studio</span></div></div><div className="cms-pro-actions"><button className="secondary" onClick={downloadTemplate}>تحميل نموذج CSV</button><Link className="secondary" href="/admin/questions">العودة لبنك الأسئلة</Link></div></header>
    <section className="import-shell"><div className="import-hero"><span>V9 BULK IMPORT</span><h1>استيراد مئات الأسئلة بأمان</h1><p>ارفع JSON أو CSV، راجع الأخطاء والتكرارات، ثم أضف الأسئلة إلى البنك بضغطة واحدة.</p></div>
      <div className="import-grid"><aside className="import-controls card-like"><h2>1. مصدر البيانات</h2><div className="segmented"><button className={source==='FILE'?'active':''} onClick={()=>setSource('FILE')}>رفع ملف</button><button className={source==='PASTE'?'active':''} onClick={()=>setSource('PASTE')}>لصق البيانات</button></div>
        {source==='FILE'?<label className="drop-zone"><input type="file" accept=".json,.csv,application/json,text/csv" onChange={onFile}/><b>اختر ملف JSON أو CSV</b><span>{fileName||'اسحب الملف هنا أو اضغط للاختيار'}</span></label>:<><textarea value={raw} onChange={e=>setRaw(e.target.value)} placeholder='الصق JSON أو CSV هنا...'/><button className="primary full" onClick={()=>parse(raw,raw.trim().startsWith('{')||raw.trim().startsWith('[')?'data.json':'data.csv')}>تحليل البيانات</button></>}
        <h2>2. طريقة الدمج</h2><div className="merge-options"><label><input type="radio" checked={mode==='MERGE'} onChange={()=>setMode('MERGE')}/><span><b>دمج الجديد فقط</b><small>يتجاهل الـIDs الموجودة</small></span></label><label><input type="radio" checked={mode==='UPDATE'} onChange={()=>setMode('UPDATE')}/><span><b>تحديث ودمج</b><small>يستبدل المكرر ويضيف الجديد</small></span></label><label><input type="radio" checked={mode==='REPLACE'} onChange={()=>setMode('REPLACE')}/><span><b>استبدال البنك</b><small>يحذف البنك المحلي الحالي</small></span></label></div>
        <button className="primary full" disabled={!stats.valid} onClick={commit}>استيراد {stats.valid} سؤال سليم</button>{message&&<div className="import-message">{message}</div>}
      </aside>
      <section className="import-preview card-like"><div className="import-stats"><article><span>الإجمالي</span><b>{stats.total}</b></article><article><span>سليم</span><b className="ok-text">{stats.valid}</b></article><article><span>به أخطاء</span><b className="bad-text">{stats.invalid}</b></article><article><span>مكرر</span><b className="warn-text">{stats.duplicates}</b></article></div>
        <div className="import-table-wrap"><table className="import-table"><thead><tr><th>#</th><th>ID</th><th>السؤال</th><th>القسم</th><th>الصعوبة</th><th>الحالة</th></tr></thead><tbody>{enriched.length?enriched.map(r=><tr key={r.index} className={r.errors.length?'invalid-row':''}><td>{r.index+1}</td><td><code>{r.question?.id||'—'}</code></td><td><strong>{r.question?.prompt||'سؤال غير مكتمل'}</strong>{r.errors.length>0&&<small>{r.errors.join(' • ')}</small>}</td><td>{r.question?.section||'—'}</td><td>{r.question?.difficulty||'—'}</td><td>{r.errors.length?<span className="status-badge bad">خطأ</span>:r.duplicate?<span className="status-badge warn">مكرر</span>:<span className="status-badge ok">جاهز</span>}</td></tr>):<tr><td colSpan={6} className="empty-import">لم يتم تحليل أي ملف بعد.</td></tr>}</tbody></table></div>
      </section></div>
    </section>
  </main>
}
