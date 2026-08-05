'use client';
import Link from 'next/link';
import {useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {satReadingWritingModule1} from '@/data/sat/reading-writing/module-1';
import type {Question} from '@/types/question';
const BANK='american-platform-question-bank-v2', PRACTICE='american-platform-selected-practice-v1';
type Area='READING'|'WRITING';
const areaOf=(q:Question):Area=>['Expression of Ideas','Standard English Conventions'].includes(q.domain)?'WRITING':'READING';
const loadBank=():Question[]=>{if(typeof window==='undefined')return satReadingWritingModule1;try{return JSON.parse(localStorage.getItem(BANK)||'null')||satReadingWritingModule1}catch{return satReadingWritingModule1}};
const plain=(value:string)=>value.replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'\"').replace(/&#39;/gi,"'").replace(/\s+/g,' ').trim();
export default function Page(){
 const router=useRouter(),[bank]=useState(loadBank),[area,setArea]=useState<Area>('READING'),[lesson,setLesson]=useState('ALL'),[difficulty,setDifficulty]=useState('ALL'),[query,setQuery]=useState(''),[selected,setSelected]=useState<string[]>([]);
 const lessons=useMemo(()=>[...new Set(bank.filter(q=>areaOf(q)===area).map(q=>q.skill))].sort(),[bank,area]);
 const filtered=useMemo(()=>bank.filter(q=>areaOf(q)===area&&(lesson==='ALL'||q.skill===lesson)&&(difficulty==='ALL'||q.difficulty===difficulty)&&`${q.prompt} ${q.skill} ${q.domain} ${q.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())),[bank,area,lesson,difficulty,query]);
 const toggle=(id:string)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
 const selectVisible=()=>{const ids=filtered.map(q=>q.id);setSelected(s=>ids.every(id=>s.includes(id))?s.filter(id=>!ids.includes(id)):[...new Set([...s,...ids])])};
 const start=()=>{if(!selected.length)return;localStorage.setItem(PRACTICE,JSON.stringify(selected));router.push('/practice/session')};
 const minutes=Math.max(1,Math.ceil(bank.filter(q=>selected.includes(q.id)).reduce((s,q)=>s+q.estimatedTimeSeconds,0)/60));
 return <main className="student-bank-page" dir="rtl"><header className="student-bank-top"><div><Link href="/">← الرئيسية</Link><span>QUESTION BANK</span><h1>بنك الأسئلة</h1><p>اختر Reading أو Writing، فلتر باسم الدرس، ثم حدد الأسئلة التي تريد حلها.</p></div><div className="selected-counter"><small>تم الاختيار</small><b>{selected.length}</b><span>سؤال</span></div></header>
 <section className="bank-tabs"><button className={area==='READING'?'active':''} onClick={()=>{setArea('READING');setLesson('ALL')}}><b>Reading</b><span>الأفكار، الأدلة، الاستنتاج والكلمات في السياق</span></button><button className={area==='WRITING'?'active':''} onClick={()=>{setArea('WRITING');setLesson('ALL')}}><b>Writing</b><span>القواعد، التنظيم، التعبير والـ Transitions</span></button></section>
 <section className="bank-toolbar"><label><span>اسم الدرس</span><select value={lesson} onChange={e=>setLesson(e.target.value)}><option value="ALL">كل الدروس</option>{lessons.map(x=><option key={x}>{x}</option>)}</select></label><label><span>الصعوبة</span><select value={difficulty} onChange={e=>setDifficulty(e.target.value)}><option value="ALL">كل المستويات</option><option value="EASY">سهل</option><option value="MEDIUM">متوسط</option><option value="HARD">صعب</option></select></label><label><span>بحث</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث داخل الأسئلة..."/></label><button className="select-visible" onClick={selectVisible}>تحديد الظاهر ({filtered.length})</button></section>
 <section className="bank-content"><div className="bank-list-head"><div><b>{area==='READING'?'أسئلة Reading':'أسئلة Writing'}</b><span>{filtered.length} سؤال متاح</span></div>{lesson!=='ALL'&&<em>{lesson}</em>}</div><div className="student-question-list">{filtered.length?filtered.map((q,i)=><label key={q.id} className={selected.includes(q.id)?'chosen':''}><input type="checkbox" checked={selected.includes(q.id)} onChange={()=>toggle(q.id)}/><span className="question-index">{i+1}</span><div><div className="question-meta"><span>{q.skill}</span><span>{q.difficulty==='EASY'?'سهل':q.difficulty==='MEDIUM'?'متوسط':'صعب'}</span><span>{Math.ceil(q.estimatedTimeSeconds/60)} دقيقة</span></div><b>{plain(q.prompt)}</b><small>{q.domain}</small></div></label>):<div className="bank-empty">لا توجد أسئلة مطابقة.</div>}</div></section>
 <div className="practice-bar"><div><b>{selected.length} سؤال محدد</b><span>{selected.length?`وقت متوقع ${minutes} دقيقة`:'اختر سؤالًا واحدًا على الأقل'}</span></div><button disabled={!selected.length} onClick={start}>ابدأ حل الأسئلة المختارة</button></div></main>;
}
