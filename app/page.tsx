import Link from 'next/link';
import BrandLogo from '../components/brand-logo';

const quickActions = [
  { icon: '▶', title: 'أكمل آخر درس', subtitle: 'Transitions • Lesson 8', href: '/lessons/transitions', tone: 'violet' },
  { icon: '✓', title: 'حل واجب اليوم', subtitle: '12 سؤالًا • 20 دقيقة', href: '/exams/start', tone: 'blue' },
  { icon: '◎', title: 'ابدأ اختبارًا تجريبيًا', subtitle: 'Digital SAT Mock Test', href: '/exams/start', tone: 'cyan' },
  { icon: '✦', title: 'اسأل المساعد الذكي', subtitle: 'شرح فوري لأي سؤال', href: '#ai-coach', tone: 'green' },
];

const missions = [
  { title: 'شاهد درس Transitions', meta: '12 دقيقة', done: true },
  { title: 'حل Quiz سريع', meta: '10 أسئلة', done: false },
  { title: 'راجع 20 كلمة Vocabulary', meta: '8 دقائق', done: false },
  { title: 'حل Reading Drill', meta: '10 دقائق', done: false },
];

const paths = [
  { title: 'Foundation Program', subtitle: 'ثبّت الأساس وابدأ صح', progress: 68, lessons: '16 / 24 درسًا', href: '/learning/foundation', tone: 'emerald', icon: '📚' },
  { title: 'Advanced Training', subtitle: 'تدريبات مكثفة على نمط الامتحان', progress: 34, lessons: '8 / 24 درسًا', href: '/learning', tone: 'violet', icon: '⚡' },
  { title: 'Final Revision', subtitle: 'مراجعات واختبارات نهائية', progress: 12, lessons: '3 / 20 درسًا', href: '/learning', tone: 'amber', icon: '🎯' },
];

const subjects = [
  { name: 'Reading & Writing', score: 710, percent: 84, delta: '+35' },
  { name: 'Math', score: 690, percent: 78, delta: '+20' },
  { name: 'Vocabulary', score: 82, percent: 82, delta: '+9%' },
];

const heatmap = [0,1,2,2,3,1,0,2,3,4,1,0,2,2,3,4,2,1,0,3,4,4,2,1,3,4,2,0,3,4,4,2,3,1,0];

export default function Home() {
  return (
    <main className="student-dashboard premium-dashboard" dir="rtl">
      <aside className="student-sidebar">
        <div className="student-brand"><BrandLogo light /></div>
        <nav>
          <Link className="active" href="/"><span>⌂</span>الرئيسية</Link>
          <Link href="/learning"><span>▤</span>مساري التعليمي</Link>
          <Link href="/exams/start"><span>◫</span>الواجبات</Link>
          <Link href="/exams/start"><span>◎</span>الاختبارات</Link>
          <Link href="#ai-coach"><span>✦</span>المساعد الذكي</Link>
          <Link href="#progress"><span>↗</span>تحليل الأداء</Link>
          <Link href="/question-bank"><span>⚙</span>بنك الأسئلة</Link>
          <Link href="/design-system"><span>◆</span>دليل التصميم</Link>
        </nav>
        <div className="sidebar-help"><b>تحتاج مساعدة؟</b><p>فريق الدعم متاح لمساعدتك في رحلتك.</p><button>تواصل معنا</button></div>
        <div className="student-profile-mini"><div className="avatar">م</div><div><b>محمد أحمد</b><small>Grade 11 • SAT</small></div><span>•••</span></div>
      </aside>

      <section className="student-main">
        <header className="dashboard-topbar">
          <div><h1>صباح الخير يا محمد 👋</h1><p>كل مهمة تنجزها اليوم تقرّبك أكثر من هدفك.</p></div>
          <div className="topbar-actions"><div className="level-pill"><span>Level 12</span><b>1250 XP</b></div><button aria-label="الإشعارات">♢<i /></button><div className="top-avatar">م</div></div>
        </header>

        <section className="destination-strip" aria-label="وجهة الطالب الحالية">
          <div className="destination-title">
            <span className="destination-icon">⌁</span>
            <div><small>Your Destination</small><h2>SAT 1500+</h2></div>
          </div>
          <div className="destination-score"><small>موقعك الحالي</small><b>1400</b><span>+55 هذا الشهر</span></div>
          <div className="destination-track" aria-label="التقدم نحو الدرجة المستهدفة">
            <div className="destination-track-head"><span>بدأت من 1280</span><strong>تبقّى 100 نقطة</strong><span>الهدف 1500+</span></div>
            <div className="destination-line"><i style={{width:'72%'}}/><em style={{right:'72%'}}>1400</em><b style={{right:'84%'}}>المحطة التالية 1450</b></div>
          </div>
          <div className="destination-date"><small>موعد الاختبار</small><b>42</b><span>يومًا متبقيًا</span></div>
        </section>

        <section className="dashboard-hero premium-hero">
          <div className="hero-copy">
            <span className="hero-kicker">Mission Control • خطة اليوم</span>
            <h2>استعد للوصول إلى <strong>1500+</strong></h2>
            <p>أكمل خطة اليوم في 46 دقيقة، وستحافظ على المسار المتوقع للوصول إلى هدفك قبل موعد الامتحان.</p>
            <div className="hero-metrics">
              <div><small>درجتك الحالية</small><b>1400</b></div>
              <div><small>الهدف</small><b>1500+</b></div>
              <div><small>المتبقي</small><b>42 يومًا</b></div>
              <div><small>السلسلة</small><b>7 أيام 🔥</b></div>
            </div>
            <div className="hero-buttons"><Link href="/lessons/transitions" className="hero-primary">ابدأ مذاكرة اليوم</Link><Link href="/learning" className="hero-secondary">عرض الخطة الكاملة</Link></div>
          </div>
          <div className="mission-orbit">
            <div className="mission-ring"><div><small>تقدم مهمة اليوم</small><b>25%</b><span>1 من 4 مهام</span></div></div>
            <span className="reward-chip">🏆 +150 XP</span>
          </div>
        </section>

        <section className="journey-pulse" aria-label="محطات رحلة الطالب">
          <div className="journey-step complete"><span>✓</span><div><small>الأساس</small><b>Foundation</b></div></div>
          <i />
          <div className="journey-step active"><span>2</span><div><small>أنت هنا</small><b>Skill Building</b></div></div>
          <i />
          <div className="journey-step"><span>3</span><div><small>المحطة التالية</small><b>Mock Mastery</b></div></div>
          <i />
          <div className="journey-step"><span>4</span><div><small>القمة</small><b>Test Ready</b></div></div>
        </section>

        <section className="premium-main-grid">
          <article className="daily-mission-card premium-card">
            <div className="section-heading compact"><div><span>Today's Mission</span><h2>مهام اليوم</h2></div><b className="xp-badge">+150 XP</b></div>
            <div className="mission-progress"><i style={{width:'25%'}} /></div>
            <div className="mission-list">
              {missions.map((mission, index) => (
                <label key={mission.title} className={mission.done ? 'done' : ''}>
                  <input type="checkbox" defaultChecked={mission.done} />
                  <span className="mission-number">{index + 1}</span>
                  <span><b>{mission.title}</b><small>{mission.meta}</small></span>
                </label>
              ))}
            </div>
            <Link href="/lessons/transitions" className="mission-cta">أكمل المهمة التالية</Link>
          </article>

          <article id="ai-coach" className="ai-coach-card premium-card premium-ai">
            <div className="ai-head"><span className="ai-symbol">✦</span><div><small>AI Coach</small><h2>توصية ذكية مخصصة</h2></div><span className="live-pill">محدّثة الآن</span></div>
            <p>لاحظت أنك تخسر نقاطًا في <strong>Transitions</strong>. أفضل خطوة الآن: مراجعة مركزة ثم تدريب مخصص يثبت المهارة.</p>
            <div className="ai-insight"><span>نقطة الضعف</span><b>Transitions</b><em>-11%</em></div>
            <div className="ai-plan"><div><span>1</span><b>مراجعة سريعة</b><small>8 دقائق</small></div><i /><div><span>2</span><b>تدريب مخصص</b><small>10 أسئلة</small></div><i /><div><span>3</span><b>اختبار تثبيت</b><small>5 دقائق</small></div></div>
            <Link href="/lessons/transitions" className="ai-start">ابدأ الخطة الذكية</Link>
          </article>
        </section>

        <section className="quick-section"><div className="section-heading"><div><span>Quick Actions</span><h2>ابدأ من المكان المناسب</h2></div></div><div className="quick-grid">{quickActions.map((action)=><Link key={action.title} className={`quick-card ${action.tone}`} href={action.href}><span className="quick-icon">{action.icon}</span><div><b>{action.title}</b><small>{action.subtitle}</small></div><em>←</em></Link>)}</div></section>

        <section className="learning-paths-section">
          <div className="section-heading"><div><span>Learning Paths</span><h2>مساراتك التعليمية</h2></div><Link href="/learning" className="view-all-link">عرض الكل ←</Link></div>
          <div className="path-grid">
            {paths.map(path => (
              <Link href={path.href} className={`path-card ${path.tone}`} key={path.title}>
                <div className="path-cover"><span>{path.icon}</span><small>{path.progress}% مكتمل</small></div>
                <div className="path-content"><h3>{path.title}</h3><p>{path.subtitle}</p><div className="path-progress"><i style={{width:`${path.progress}%`}} /></div><div className="path-meta"><span>{path.lessons}</span><b>متابعة ←</b></div></div>
              </Link>
            ))}
          </div>
        </section>

        <section id="progress" className="progress-section">
          <div className="section-heading"><div><span>Performance</span><h2>تقدمك هذا الشهر</h2></div><button className="period-button">آخر 30 يومًا⌄</button></div>
          <div className="progress-grid"><article className="chart-card premium-card"><div className="chart-summary"><div><small>متوسط الدرجة</small><b>1400</b><span>+55 نقطة هذا الشهر</span></div><div className="chart-legend"><i/>نتائج الاختبارات</div></div><div className="line-chart"><span className="grid-line g1"/><span className="grid-line g2"/><span className="grid-line g3"/><svg viewBox="0 0 600 190" preserveAspectRatio="none"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".25"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs><path className="area" d="M0,155 C75,150 95,135 145,142 C210,150 220,110 290,118 C365,128 390,80 450,91 C515,102 535,40 600,48 L600,190 L0,190 Z"/><path className="line" d="M0,155 C75,150 95,135 145,142 C210,150 220,110 290,118 C365,128 390,80 450,91 C515,102 535,40 600,48"/></svg><div className="chart-labels"><span>1 يوليو</span><span>8 يوليو</span><span>15 يوليو</span><span>22 يوليو</span><span>اليوم</span></div></div></article>
          <article className="subjects-card premium-card"><h3>الأداء حسب المهارة</h3>{subjects.map(s=><div className="subject-row" key={s.name}><div><b>{s.name}</b><small>{s.score}{s.name==='Vocabulary'?'%':''}</small></div><div className="subject-bar"><i style={{width:`${s.percent}%`}}/></div><span>{s.delta}</span></div>)}<button className="text-button">عرض التقرير الكامل ←</button></article></div>
        </section>

        <section className="bottom-grid premium-bottom-grid">
          <article className="heatmap-card premium-card"><div className="section-heading compact"><div><span>Study Heatmap</span><h2>استمراريتك هذا الشهر</h2></div><b>23 يوم مذاكرة</b></div><div className="heatmap">{heatmap.map((level,index)=><span key={index} className={`heat-${level}`} title={`اليوم ${index+1}`}/>)}</div><div className="heatmap-legend"><span>أقل</span><i className="heat-1"/><i className="heat-2"/><i className="heat-3"/><i className="heat-4"/><span>أكثر</span></div></article>
          <article className="achievement-card premium-card"><div className="section-heading compact"><div><span>Achievement</span><h2>إنجاز جديد</h2></div></div><div className="achievement-content"><div className="trophy">🏆</div><div><b>Reading Streak Master</b><p>أكملت 7 تدريبات قراءة متتالية بنسبة دقة أعلى من 80%.</p><span>+250 XP</span></div></div></article>
          <article className="exam-card premium-card"><div><span>الاختبار القادم</span><h2>Full Digital SAT Mock</h2><p>الجمعة، 7:00 مساءً • ساعتان و14 دقيقة</p></div><Link href="/exams/start">استعد للاختبار ←</Link></article>
        </section>
      </section>
    </main>
  );
}
