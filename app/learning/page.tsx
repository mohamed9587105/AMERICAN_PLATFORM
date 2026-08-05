import Link from 'next/link';
import BrandLogo from '../../components/brand-logo';

const tracks = [
  { title: 'Foundation Program', tag: 'المسار الحالي', desc: 'تأسيس شامل في Reading, Writing وMath قبل الانتقال للتدريب المتقدم.', progress: 68, lessons: '24 درسًا', time: '18 ساعة', href: '/learning/foundation', tone: 'foundation' },
  { title: 'Advanced SAT', tag: 'يفتح قريبًا', desc: 'استراتيجيات متقدمة، تدريبات زمنية وامتحانات كاملة بمستوى الاختبار الحقيقي.', progress: 0, lessons: '32 درسًا', time: '26 ساعة', href: '#', tone: 'advanced', locked: true },
  { title: 'Final Revision', tag: 'مغلق', desc: 'مراجعة نهائية مركزة على نقاط الضعف قبل موعد الاختبار.', progress: 0, lessons: '14 درسًا', time: '12 ساعة', href: '#', tone: 'revision', locked: true },
];

const nextLessons = [
  { no: '08', title: 'Transitions: Linking Ideas', subject: 'Reading & Writing', duration: '18 دقيقة', status: 'ابدأ الآن', href: '/lessons/transitions' },
  { no: '09', title: 'Command of Evidence', subject: 'Reading & Writing', duration: '22 دقيقة', status: 'بعد إنهاء الدرس السابق', locked: true },
  { no: '10', title: 'Linear Equations', subject: 'Math', duration: '25 دقيقة', status: 'مغلق', locked: true },
];

export default function LearningCenter() {
  return (
    <main className="student-dashboard learning-page" dir="rtl">
      <aside className="student-sidebar">
        <div className="student-brand"><BrandLogo light /></div>
        <nav>
          <Link href="/"><span>⌂</span>الرئيسية</Link>
          <Link className="active" href="/learning"><span>▤</span>مساري التعليمي</Link>
          <Link href="/exams/start"><span>◫</span>الواجبات</Link>
          <Link href="/exams/start"><span>◎</span>الاختبارات</Link>
          <Link href="/#ai-coach"><span>✦</span>المساعد الذكي</Link>
          <Link href="/#progress"><span>↗</span>تحليل الأداء</Link>
          <Link href="/admin/questions"><span>⚙</span>بنك الأسئلة</Link>
        </nav>
        <div className="sidebar-help"><b>تحتاج مساعدة؟</b><p>فريق الدعم متاح لمساعدتك في رحلتك.</p><button>تواصل معنا</button></div>
        <div className="student-profile-mini"><div className="avatar">م</div><div><b>محمد أحمد</b><small>Grade 11 • SAT</small></div><span>•••</span></div>
      </aside>

      <section className="student-main">
        <header className="dashboard-topbar">
          <div><h1>مساري التعليمي</h1><p>كل درس تنهيه يقرّبك خطوة من الدرجة المستهدفة.</p></div>
          <div className="topbar-actions"><button aria-label="الإشعارات">♢<i /></button><div className="top-avatar">م</div></div>
        </header>

        <section className="learning-hero">
          <div>
            <span className="hero-kicker">خطة تعلم مخصصة لك</span>
            <h2>استكمل برنامج التأسيس</h2>
            <p>أنت الآن في الوحدة الثالثة. بناءً على أدائك، نوصيك بإنهاء درس Transitions ثم حل التدريب القصير.</p>
            <div className="learning-hero-actions"><Link href="/lessons/transitions">أكمل من حيث توقفت</Link><button>عرض الخطة الأسبوعية</button></div>
          </div>
          <div className="course-progress-ring"><div><b>68%</b><span>مكتمل</span></div></div>
        </section>

        <section className="learning-stats">
          <article><span>✓</span><div><small>الدروس المكتملة</small><b>16 من 24</b></div></article>
          <article><span>◷</span><div><small>وقت التعلم</small><b>11 ساعة و40 دقيقة</b></div></article>
          <article><span>★</span><div><small>متوسط الاختبارات</small><b>84%</b></div></article>
          <article><span>🔥</span><div><small>سلسلة التعلم</small><b>7 أيام</b></div></article>
        </section>

        <section className="learning-section">
          <div className="section-heading"><div><span>برامجك</span><h2>المسارات التعليمية</h2></div><small>يتم فتح المسارات تلقائيًا حسب تقدمك</small></div>
          <div className="track-grid">
            {tracks.map(track => (
              <article className={`track-card ${track.tone} ${track.locked ? 'locked' : ''}`} key={track.title}>
                <div className="track-cover"><span>{track.locked ? '🔒' : '✦'}</span><em>{track.tag}</em></div>
                <div className="track-body">
                  <h3>{track.title}</h3><p>{track.desc}</p>
                  <div className="track-meta"><span>{track.lessons}</span><span>{track.time}</span></div>
                  <div className="track-progress"><div><b>{track.progress}%</b><small>نسبة الإنجاز</small></div><i><span style={{width: `${track.progress}%`}} /></i></div>
                  {track.locked ? <button disabled>أكمل المسار الحالي أولًا</button> : <Link href={track.href}>فتح المسار ←</Link>}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="learning-bottom-grid">
          <article className="next-lessons-card">
            <div className="section-heading compact"><div><span>تابع التعلم</span><h2>الدروس القادمة</h2></div><Link href="/learning/foundation">عرض كل الدروس</Link></div>
            <div className="next-lessons-list">
              {nextLessons.map(lesson => (
                <div className={lesson.locked ? 'lesson-row locked' : 'lesson-row'} key={lesson.no}>
                  <span className="lesson-number">{lesson.no}</span><div><b>{lesson.title}</b><small>{lesson.subject} • {lesson.duration}</small></div>
                  {lesson.locked ? <span className="lesson-state">🔒 {lesson.status}</span> : <Link href={lesson.href || '#'}>{lesson.status} ←</Link>}
                </div>
              ))}
            </div>
          </article>

          <article className="weekly-plan-card">
            <span className="plan-badge">خطة هذا الأسبوع</span><h2>هدفك: 4 دروس + اختبار</h2><p>أنجزت 3 من أصل 5 مهام تعليمية لهذا الأسبوع.</p>
            <div className="week-days"><span className="done">س</span><span className="done">ح</span><span className="done">ن</span><span className="today">ث</span><span>ر</span><span>خ</span><span>ج</span></div>
            <div className="week-progress"><i><span /></i><b>60%</b></div>
            <button>تعديل الخطة</button>
          </article>
        </section>
      </section>
    </main>
  );
}
