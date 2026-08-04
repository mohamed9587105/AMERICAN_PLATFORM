import Link from 'next/link';

export default function Home(){
  return (
    <main className="platform-home">
      <section className="home-hero">
        <div className="home-badge">American Platform • Control Center</div>
        <h1>اختر القسم الذي تريد فتحه</h1>
        <p>ابدأ تجربة الامتحان الرقمي أو ادخل إلى لوحة إدارة بنك الأسئلة لإضافة وتعديل ومراجعة الأسئلة.</p>
        <div className="home-actions-grid">
          <Link className="home-action-card exam" href="/exams/start">
            <span className="home-action-icon">✦</span>
            <div><b>SAT Exam Engine</b><small>بدء تجربة الامتحان الرقمي</small></div>
            <em>فتح ←</em>
          </Link>
          <Link className="home-action-card cms" href="/admin/questions">
            <span className="home-action-icon">▦</span>
            <div><b>Question Bank CMS</b><small>إضافة وتعديل وحذف وتصدير الأسئلة</small></div>
            <em>فتح ←</em>
          </Link>
        </div>
        <div className="home-features">
          <span>إضافة سؤال جديد</span><span>تعديل وحذف</span><span>بحث وفلترة</span><span>معاينة كاملة</span><span>تصدير JSON</span><span>حفظ محلي</span>
        </div>
      </section>
    </main>
  );
}
