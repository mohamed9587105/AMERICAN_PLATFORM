'use client';

import {useMemo, useState} from 'react';
import Link from 'next/link';
import {satReadingWritingModule1} from '@/data/sat/reading-writing/module-1';
import type {Difficulty, Question, SectionCode} from '@/types/question';

const STORAGE_KEY = 'american-platform-question-bank-v2';
const FAVORITES_KEY = 'american-platform-question-favorites-v1';
const choiceIds = ['A','B','C','D'] as const;

type FolderFilter = 'ALL' | 'SAT' | 'READING_WRITING' | 'MATH' | 'FAVORITES';
type ValidationIssue = {field:string; message:string};

const blankQuestion = (): Question => ({
  id:`SAT-RW-M1-${Date.now()}`,
  exam:'SAT', section:'READING_WRITING', module:1,
  domain:'Information and Ideas', skill:'Central Ideas and Details', difficulty:'MEDIUM', estimatedTimeSeconds:70,
  passage:'', prompt:'', choices:choiceIds.map(id=>({id,text:''})),
  correctChoiceId:'A', explanation:'', commonMistakes:[], tags:[]
});

function loadQuestions(): Question[] {
  if (typeof window === 'undefined') return satReadingWritingModule1;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : satReadingWritingModule1;
  } catch { return satReadingWritingModule1; }
}
function loadFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'); } catch { return []; }
}
function validateQuestion(q:Question, all:Question[]):ValidationIssue[]{
  const issues:ValidationIssue[]=[];
  if(!q.id.trim()) issues.push({field:'ID',message:'أدخل معرفًا فريدًا للسؤال.'});
  if(all.some(x=>x.id===q.id && x!==q)) issues.push({field:'ID',message:'معرف السؤال مستخدم بالفعل.'});
  if(!q.domain.trim()) issues.push({field:'Domain',message:'اختر أو اكتب الـDomain.'});
  if(!q.skill.trim()) issues.push({field:'Skill',message:'اختر أو اكتب المهارة.'});
  if(!q.prompt.trim()) issues.push({field:'Question',message:'نص السؤال مطلوب.'});
  if(q.choices.length!==4) issues.push({field:'Choices',message:'السؤال يجب أن يحتوي على أربعة اختيارات.'});
  q.choices.forEach(c=>{if(!c.text.trim()) issues.push({field:`Choice ${c.id}`,message:`نص الاختيار ${c.id} فارغ.`})});
  if(!q.choices.some(c=>c.id===q.correctChoiceId)) issues.push({field:'Correct answer',message:'حدد إجابة صحيحة.'});
  if(q.estimatedTimeSeconds<10) issues.push({field:'Time',message:'الوقت المتوقع يجب ألا يقل عن 10 ثوانٍ.'});
  if(!q.explanation.trim()) issues.push({field:'Explanation',message:'أضف شرحًا للإجابة؛ يمكن الحفظ كمسودة بدونه.'});
  return issues;
}
function isReady(q:Question){return validateQuestion(q,[q]).filter(i=>i.field!=='Explanation').length===0 && !!q.explanation.trim()}

export default function QuestionBankCmsPro(){
  const [questions,setQuestions]=useState<Question[]>(loadQuestions);
  const [favorites,setFavorites]=useState<string[]>(loadFavorites);
  const [selectedId,setSelectedId]=useState(questions[0]?.id ?? '');
  const [query,setQuery]=useState('');
  const [difficulty,setDifficulty]=useState<'ALL'|Difficulty>('ALL');
  const [section,setSection]=useState<'ALL'|SectionCode>('ALL');
  const [domain,setDomain]=useState('ALL');
  const [skill,setSkill]=useState('ALL');
  const [moduleFilter,setModuleFilter]=useState('ALL');
  const [folder,setFolder]=useState<FolderFilter>('ALL');
  const [editing,setEditing]=useState<Question|null>(null);
  const [validation,setValidation]=useState<ValidationIssue[]>([]);
  const [toast,setToast]=useState('');

  const selected=questions.find(q=>q.id===selectedId) ?? questions[0];
  const domains=useMemo(()=>Array.from(new Set(questions.map(q=>q.domain))).sort(),[questions]);
  const skills=useMemo(()=>Array.from(new Set(questions.map(q=>q.skill))).sort(),[questions]);
  const modules=useMemo(()=>Array.from(new Set(questions.map(q=>q.module))).sort((a,b)=>a-b),[questions]);

  const filtered=useMemo(()=>questions.filter(q=>{
    const hay=`${q.id} ${q.domain} ${q.skill} ${q.prompt} ${q.tags.join(' ')}`.toLowerCase();
    const folderOk=folder==='ALL'||folder==='SAT'||(folder==='FAVORITES'&&favorites.includes(q.id))||q.section===folder;
    return folderOk && hay.includes(query.toLowerCase()) && (difficulty==='ALL'||q.difficulty===difficulty) && (section==='ALL'||q.section===section) && (domain==='ALL'||q.domain===domain) && (skill==='ALL'||q.skill===skill) && (moduleFilter==='ALL'||String(q.module)===moduleFilter);
  }),[questions,query,difficulty,section,domain,skill,moduleFilter,folder,favorites]);

  const stats=useMemo(()=>({
    total:questions.length,
    ready:questions.filter(isReady).length,
    draft:questions.filter(q=>!isReady(q)).length,
    favorites:favorites.length,
    rw:questions.filter(q=>q.section==='READING_WRITING').length,
    math:questions.filter(q=>q.section==='MATH').length,
  }),[questions,favorites]);

  function notify(message:string){setToast(message);window.setTimeout(()=>setToast(''),1800)}
  function persist(next:Question[]){setQuestions(next);localStorage.setItem(STORAGE_KEY,JSON.stringify(next));}
  function persistFavorites(next:string[]){setFavorites(next);localStorage.setItem(FAVORITES_KEY,JSON.stringify(next));}
  function openEditor(q:Question){setValidation([]);setEditing(structuredClone(q))}
  function saveQuestion(){
    if(!editing) return;
    const issues=validateQuestion(editing,questions.filter(q=>q.id!==editing.id));
    setValidation(issues);
    const blocking=issues.filter(i=>i.field!=='Explanation');
    if(blocking.length){notify('راجع حقول السؤال قبل الحفظ');return;}
    const exists=questions.some(q=>q.id===editing.id);
    const next=exists?questions.map(q=>q.id===editing.id?editing:q):[editing,...questions];
    persist(next);setSelectedId(editing.id);setEditing(null);setValidation([]);notify(exists?'تم تحديث السؤال':'تمت إضافة السؤال');
  }
  function removeQuestion(id:string){
    if(!confirm('حذف هذا السؤال نهائيًا من النسخة المحلية؟')) return;
    const next=questions.filter(q=>q.id!==id);persist(next);persistFavorites(favorites.filter(x=>x!==id));setSelectedId(next[0]?.id??'');notify('تم حذف السؤال');
  }
  function duplicateQuestion(q:Question){
    const copy:Question={...structuredClone(q),id:`${q.id}-COPY-${Date.now().toString().slice(-5)}`};
    persist([copy,...questions]);setSelectedId(copy.id);openEditor(copy);notify('تم إنشاء نسخة قابلة للتعديل');
  }
  function toggleFavorite(id:string){
    const next=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];persistFavorites(next);notify(next.includes(id)?'أضيف للمفضلة':'أزيل من المفضلة');
  }
  function resetBank(){if(confirm('استعادة بنك الأسئلة الأساسي؟ ستُحذف التعديلات المحلية.')){persist(satReadingWritingModule1);persistFavorites([]);setSelectedId(satReadingWritingModule1[0]?.id??'');notify('تمت استعادة البنك الأساسي')}}
  function exportJson(){
    const blob=new Blob([JSON.stringify({version:2,exportedAt:new Date().toISOString(),questions},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`american-platform-question-bank-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);notify('تم تصدير بنك الأسئلة');
  }
  function clearFilters(){setQuery('');setDifficulty('ALL');setSection('ALL');setDomain('ALL');setSkill('ALL');setModuleFilter('ALL');setFolder('ALL')}
  function insertMarkup(field:'passage'|'prompt'|'explanation',before:string,after=before){
    if(!editing)return;const value=String(editing[field]??'');setEditing({...editing,[field]:`${value}${before}نص${after}`});
  }

  return <main className="cms-pro-page">
    <header className="cms-pro-topbar">
      <div className="cms-brand"><Link href="/">AP</Link><div><b>Question Bank CMS Pro</b><span>American Platform • V9</span></div></div>
      <div className="cms-pro-actions"><Link className="secondary" href="/admin/questions/import">استيراد جماعي</Link><button className="secondary" onClick={exportJson}>تصدير</button><button className="primary" onClick={()=>openEditor(blankQuestion())}>+ سؤال جديد</button></div>
    </header>

    <section className="cms-pro-shell">
      <aside className="cms-tree">
        <div className="tree-title"><span>المكتبة</span><button onClick={clearFilters}>إعادة ضبط</button></div>
        <button className={folder==='ALL'?'active':''} onClick={()=>setFolder('ALL')}><span>▦ كل الأسئلة</span><b>{stats.total}</b></button>
        <button className={folder==='FAVORITES'?'active':''} onClick={()=>setFolder('FAVORITES')}><span>★ المفضلة</span><b>{stats.favorites}</b></button>
        <div className="tree-group"><strong>SAT</strong>
          <button className={folder==='SAT'?'active':''} onClick={()=>setFolder('SAT')}><span>جميع أقسام SAT</span><b>{stats.total}</b></button>
          <button className={folder==='READING_WRITING'?'active':''} onClick={()=>setFolder('READING_WRITING')}><span>↳ Reading & Writing</span><b>{stats.rw}</b></button>
          <button className={folder==='MATH'?'active':''} onClick={()=>setFolder('MATH')}><span>↳ Math</span><b>{stats.math}</b></button>
        </div>
        <div className="tree-group disabled"><strong>قريبًا</strong><span>EST</span><span>ACT</span></div>
        <div className="tree-health"><div><span>جاهز للنشر</span><b>{stats.ready}</b></div><div><span>مسودة</span><b>{stats.draft}</b></div></div>
        <button className="tree-reset" onClick={resetBank}>استعادة البنك الأساسي</button>
      </aside>

      <section className="cms-pro-main">
        <div className="cms-pro-heading"><div><span className="eyebrow">CONTENT OPERATIONS</span><h1>بنك الأسئلة</h1><p>نظّم، راجع، واعتمد أسئلة SAT قبل استخدامها داخل الامتحانات.</p></div><div className="cms-mini-stats"><article><span>الكل</span><b>{stats.total}</b></article><article><span>جاهز</span><b>{stats.ready}</b></article><article><span>مسودة</span><b>{stats.draft}</b></article></div></div>

        <div className="cms-pro-toolbar">
          <div className="search-box">⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث بالـID أو المهارة أو نص السؤال..."/></div>
          <select value={section} onChange={e=>setSection(e.target.value as 'ALL'|SectionCode)}><option value="ALL">كل الأقسام</option><option value="READING_WRITING">Reading & Writing</option><option value="MATH">Math</option></select>
          <select value={difficulty} onChange={e=>setDifficulty(e.target.value as 'ALL'|Difficulty)}><option value="ALL">كل الصعوبات</option><option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option></select>
          <select value={domain} onChange={e=>setDomain(e.target.value)}><option value="ALL">كل Domains</option>{domains.map(x=><option key={x}>{x}</option>)}</select>
          <select value={skill} onChange={e=>setSkill(e.target.value)}><option value="ALL">كل Skills</option>{skills.map(x=><option key={x}>{x}</option>)}</select>
          <select value={moduleFilter} onChange={e=>setModuleFilter(e.target.value)}><option value="ALL">كل Modules</option>{modules.map(x=><option key={x} value={x}>Module {x}</option>)}</select>
        </div>

        <div className="cms-pro-content">
          <aside className="cms-question-list">
            <div className="list-caption"><b>{filtered.length} سؤال</b><span>اضغط للمعاينة</span></div>
            <div className="list-scroll">{filtered.map(q=>{
              const ready=isReady(q);return <button key={q.id} className={selected?.id===q.id?'active':''} onClick={()=>setSelectedId(q.id)}>
                <div className="item-top"><code>{q.id}</code><span className={`status-dot ${ready?'ready':'draft'}`}>{ready?'جاهز':'مسودة'}</span></div>
                <strong>{q.skill}</strong><p>{q.prompt||'سؤال بدون نص'}</p>
                <div className="item-meta"><span>{q.domain}</span><em className={`difficulty ${q.difficulty.toLowerCase()}`}>{q.difficulty}</em>{favorites.includes(q.id)&&<i>★</i>}</div>
              </button>})}{!filtered.length&&<div className="empty-state">لا توجد نتائج مطابقة للفلاتر الحالية.</div>}</div>
          </aside>

          <article className="cms-pro-preview">{selected?<>
            <div className="pro-preview-head"><div><span>{selected.exam} • {selected.section.replace('_',' & ')} • Module {selected.module}</span><h2>{selected.skill}</h2><p>{selected.id}</p></div><div className="preview-command-bar"><button title="مفضلة" className={favorites.includes(selected.id)?'fav active':'fav'} onClick={()=>toggleFavorite(selected.id)}>★</button><button className="secondary" onClick={()=>duplicateQuestion(selected)}>نسخ</button><button className="secondary" onClick={()=>openEditor(selected)}>تعديل</button><button className="danger" onClick={()=>removeQuestion(selected.id)}>حذف</button></div></div>
            <div className="quality-strip"><div><span>الحالة</span><b className={isReady(selected)?'ready-text':'draft-text'}>{isReady(selected)?'جاهز للاستخدام':'يحتاج مراجعة'}</b></div><div><span>Domain</span><b>{selected.domain}</b></div><div><span>Difficulty</span><b>{selected.difficulty}</b></div><div><span>Expected</span><b>{selected.estimatedTimeSeconds}s</b></div></div>
            <div className="exam-preview-canvas">
              {selected.passage&&<section className="exam-preview-passage"><div className="preview-label">PASSAGE</div>{selected.passage.split('\n\n').map((p,i)=><p key={i}>{p}</p>)}</section>}
              <section className="exam-preview-question"><div className="preview-label">QUESTION</div><h3>{selected.prompt}</h3><div className="pro-preview-choices">{selected.choices.map(c=><div key={c.id} className={c.id===selected.correctChoiceId?'correct':''}><b>{c.id}</b><span>{c.text}</span>{c.id===selected.correctChoiceId&&<small>✓ Correct</small>}</div>)}</div></section>
            </div>
            <div className="preview-bottom-grid"><section><span>Explanation</span><p>{selected.explanation||'لا يوجد شرح حتى الآن.'}</p></section><section><span>Tags</span><div className="tag-row">{selected.tags.length?selected.tags.map(t=><i key={t}>{t}</i>):<p>—</p>}</div></section><section><span>Common mistakes</span><p>{selected.commonMistakes.join(' • ')||'—'}</p></section></div>
          </>:<div className="empty-state">أضف أول سؤال إلى البنك.</div>}</article>
        </div>
      </section>
    </section>

    {editing&&<div className="cms-modal"><div className="cms-pro-editor">
      <div className="editor-head"><div><span className="eyebrow">AUTHORING STUDIO</span><h2>{questions.some(q=>q.id===editing.id)?'تعديل السؤال':'إنشاء سؤال جديد'}</h2><p>املأ البيانات ثم راجع مؤشر الجودة قبل الحفظ.</p></div><button className="close-editor" onClick={()=>setEditing(null)}>×</button></div>
      {validation.length>0&&<div className="validation-panel"><b>مراجعة الجودة</b><ul>{validation.map((x,i)=><li key={i}><strong>{x.field}:</strong> {x.message}</li>)}</ul></div>}
      <div className="form-section"><h3>التصنيف</h3><div className="form-grid pro">
        <label>ID<input value={editing.id} onChange={e=>setEditing({...editing,id:e.target.value})}/></label>
        <label>Exam<select value={editing.exam} onChange={e=>setEditing({...editing,exam:e.target.value as Question['exam']})}><option>SAT</option><option>EST</option><option>ACT</option></select></label>
        <label>Section<select value={editing.section} onChange={e=>setEditing({...editing,section:e.target.value as SectionCode})}><option value="READING_WRITING">Reading & Writing</option><option value="MATH">Math</option></select></label>
        <label>Module<input type="number" min="1" value={editing.module} onChange={e=>setEditing({...editing,module:Number(e.target.value)})}/></label>
        <label>Difficulty<select value={editing.difficulty} onChange={e=>setEditing({...editing,difficulty:e.target.value as Difficulty})}><option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option></select></label>
        <label>Expected seconds<input type="number" min="10" value={editing.estimatedTimeSeconds} onChange={e=>setEditing({...editing,estimatedTimeSeconds:Number(e.target.value)})}/></label>
        <label className="span-2">Domain<input list="domain-list" value={editing.domain} onChange={e=>setEditing({...editing,domain:e.target.value})}/><datalist id="domain-list">{domains.map(x=><option key={x} value={x}/>)}</datalist></label>
        <label className="span-2">Skill<input list="skill-list" value={editing.skill} onChange={e=>setEditing({...editing,skill:e.target.value})}/><datalist id="skill-list">{skills.map(x=><option key={x} value={x}/>)}</datalist></label>
      </div></div>
      <div className="form-section"><div className="section-with-tools"><h3>Passage</h3><div><button onClick={()=>insertMarkup('passage','**')}>B</button><button onClick={()=>insertMarkup('passage','_')}>I</button><button onClick={()=>insertMarkup('passage','__')}>U</button></div></div><textarea rows={7} value={editing.passage??''} onChange={e=>setEditing({...editing,passage:e.target.value})} placeholder="اكتب القطعة هنا..."/></div>
      <div className="form-section"><div className="section-with-tools"><h3>Question</h3><div><button onClick={()=>insertMarkup('prompt','**')}>B</button><button onClick={()=>insertMarkup('prompt','_')}>I</button></div></div><textarea rows={3} value={editing.prompt} onChange={e=>setEditing({...editing,prompt:e.target.value})} placeholder="اكتب نص السؤال..."/></div>
      <div className="form-section"><h3>Choices & correct answer</h3><div className="choice-editor pro">{editing.choices.map((choice,index)=><label key={choice.id} className={editing.correctChoiceId===choice.id?'correct-choice':''}><span><input type="radio" name="correct" checked={editing.correctChoiceId===choice.id} onChange={()=>setEditing({...editing,correctChoiceId:choice.id})}/>{choice.id}</span><input value={choice.text} onChange={e=>{const choices=[...editing.choices];choices[index]={...choice,text:e.target.value};setEditing({...editing,choices})}} placeholder={`Choice ${choice.id}`}/></label>)}</div></div>
      <div className="form-section"><div className="section-with-tools"><h3>Explanation</h3><div><button onClick={()=>insertMarkup('explanation','**')}>B</button><button onClick={()=>insertMarkup('explanation','- ','')}>List</button></div></div><textarea rows={4} value={editing.explanation} onChange={e=>setEditing({...editing,explanation:e.target.value})} placeholder="اشرح لماذا الإجابة صحيحة..."/></div>
      <div className="form-grid pro final-fields"><label className="span-2">Tags<input value={editing.tags.join(', ')} onChange={e=>setEditing({...editing,tags:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)})} placeholder="inference, medium, module-1"/></label><label className="span-2">Common mistakes<input value={editing.commonMistakes.join(', ')} onChange={e=>setEditing({...editing,commonMistakes:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)})} placeholder="اختيار إجابة جزئية، تجاهل دليل النص"/></label></div>
      <div className="editor-footer"><div className="quality-meter"><span>جودة السؤال</span><b>{Math.max(0,100-validateQuestion(editing,questions.filter(q=>q.id!==editing.id)).length*14)}%</b></div><div className="editor-actions"><button className="secondary" onClick={()=>{setValidation(validateQuestion(editing,questions.filter(q=>q.id!==editing.id)));notify('تم فحص السؤال')}}>فحص الجودة</button><button className="secondary" onClick={()=>setEditing(null)}>إلغاء</button><button className="primary" onClick={saveQuestion}>حفظ السؤال</button></div></div>
    </div></div>}
    {toast&&<div className="cms-toast">{toast}</div>}
  </main>
}
