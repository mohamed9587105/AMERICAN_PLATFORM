import Link from 'next/link';

const units = [
  { title: 'الوحدة 1 — أساسيات القراءة', progress: 100, lessons: ['Understanding Main Ideas', 'Words in Context', 'Text Structure'] },
  { title: 'الوحدة 2 — القواعد الأساسية', progress: 100, lessons: ['Sentence Boundaries', 'Subject–Verb Agreement', 'Punctuation'] },
  { title: 'الوحدة 3 — Craft & Structure', progress: 55, lessons: ['Rhetorical Synthesis', 'Transitions: Linking Ideas', 'Command of Evidence'], current: 1 },
  { title: 'الوحدة 4 — Math Foundations', progress: 0, lessons: ['Linear Equations', 'Systems of Equations', 'Percentages & Ratios'], locked: true },
];

export default function FoundationTrack() {
  return <main className="course-detail-page" dir="rtl">
    <header className="course-detail-top"><Link href="/learning">→ العودة لمساري</Link><div><span>Foundation Program</span><h1>برنامج التأسيس الشامل</h1><p>ابنِ الأساس الصحيح في Reading, Writing وMath بخطوات مرتبة واختبارات قصيرة.</p></div><div className="course-detail-progress"><b>68%</b><span>16 من 24 درسًا</span></div></header>
    <section className="course-detail-layout">
      <div className="units-list">
        {units.map((unit, unitIndex) => <article className={`unit-card ${unit.locked ? 'locked' : ''}`} key={unit.title}>
          <header><div><span>{unit.locked ? '🔒' : unit.progress === 100 ? '✓' : unitIndex + 1}</span><div><h2>{unit.title}</h2><small>{unit.lessons.length} دروس • {unit.progress}% مكتمل</small></div></div><b>{unit.progress}%</b></header>
          <div className="unit-progress"><i style={{width:`${unit.progress}%`}} /></div>
          <div className="unit-lessons">{unit.lessons.map((lesson, index) => {
            const completed = unit.progress === 100 || (unit.current !== undefined && index < unit.current);
            const current = unit.current === index;
            const unavailable = unit.locked || (unit.current !== undefined && index > unit.current);
            return <div className={`unit-lesson ${current ? 'current' : ''} ${unavailable ? 'unavailable' : ''}`} key={lesson}>
              <span>{completed ? '✓' : current ? '▶' : '🔒'}</span><div><b>{lesson}</b><small>{18 + index * 3} دقيقة • فيديو + تدريب</small></div>
              {current ? <Link href="/lessons/transitions">ابدأ الدرس</Link> : completed ? <button>مراجعة</button> : <em>مغلق</em>}
            </div>
          })}</div>
        </article>)}
      </div>
      <aside className="course-side-panel"><div className="side-recommendation"><span>✦ توصية ذكية</span><h3>ابدأ بدرس Transitions</h3><p>نتيجتك في هذه المهارة أقل من متوسطك العام بـ 12%.</p><Link href="/lessons/transitions">ابدأ الآن</Link></div><div className="course-certificate"><div>🏅</div><h3>شهادة إتمام المسار</h3><p>أكمل جميع الدروس واحصل على 80% على الأقل في الاختبار النهائي.</p><small>16 / 24 درسًا</small></div></aside>
    </section>
  </main>;
}
