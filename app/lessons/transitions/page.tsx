import Link from 'next/link';

export default function TransitionsLesson() {
  return <main className="lesson-page" dir="rtl">
    <header className="lesson-topbar"><Link href="/learning/foundation">→ العودة للمسار</Link><div><small>Foundation • الوحدة 3</small><b>Transitions: Linking Ideas</b></div><span>الدرس 8 من 24</span></header>
    <section className="lesson-layout">
      <article className="lesson-content">
        <div className="video-placeholder"><span>▶</span><div><b>فيديو الدرس</b><small>18:24 دقيقة</small></div></div>
        <div className="lesson-tabs"><button className="active">ملخص الدرس</button><button>الملاحظات</button><button>الملفات</button><button>الأسئلة</button></div>
        <section className="lesson-summary"><span className="lesson-eyebrow">هدف الدرس</span><h1>اختيار أداة الربط المناسبة بين الأفكار</h1><p>ستتعلم كيف تحدد العلاقة المنطقية بين الجمل، ثم تختار الانتقال الذي يعبر عنها بدقة داخل أسئلة Digital SAT.</p><div className="lesson-points"><article><span>1</span><div><b>Continuation</b><p>روابط الاستمرار وإضافة فكرة داعمة مثل furthermore وmoreover.</p></div></article><article><span>2</span><div><b>Contrast</b><p>روابط التباين بين فكرتين مثل however وnevertheless.</p></div></article><article><span>3</span><div><b>Cause & Effect</b><p>روابط السبب والنتيجة مثل therefore وconsequently.</p></div></article></div></section>
      </article>
      <aside className="lesson-sidebar"><div className="lesson-progress-box"><span>تقدم الدرس</span><div><b>35%</b><i><em /></i></div><small>شاهد الفيديو ثم أكمل التدريب</small></div><div className="lesson-ai-box"><span>✦ المساعد الذكي</span><h3>هل لديك سؤال؟</h3><p>اسأل عن أي نقطة في الدرس واحصل على شرح بسيط مع مثال.</p><textarea placeholder="اكتب سؤالك هنا..."/><button>اسأل المساعد</button></div><div className="lesson-next-box"><small>بعد الفيديو</small><h3>تدريب تثبيت سريع</h3><p>10 أسئلة • 12 دقيقة</p><Link href="/exams/start">ابدأ التدريب ←</Link></div></aside>
    </section>
    <footer className="lesson-footer"><button>الدرس السابق</button><span>يتم حفظ تقدمك تلقائيًا</span><Link href="/exams/start">أنهي الدرس وابدأ التدريب ←</Link></footer>
  </main>;
}
