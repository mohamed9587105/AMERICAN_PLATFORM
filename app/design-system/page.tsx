import BrandLogo from '../../components/brand-logo';
import { Badge, Button, Card, EmptyState, Field, Progress, Skeleton, Stat } from '../../components/ui';

const colors = [
  ['Mastery Blue', '#0A3DFF'], ['Electric Cyan', '#00C2FF'], ['Deep Navy', '#071226'],
  ['Success', '#16C784'], ['Warning', '#FFB020'], ['Danger', '#FF4D4F'], ['AI Purple', '#7C3AED'], ['Canvas', '#F5F8FC'],
];

export default function DesignSystemPage() {
  return (
    <main className="design-system-page" dir="rtl">
      <header className="ds-hero">
        <div><Badge tone="blue">MASTERY V8</Badge><h1>نظام التصميم الرسمي</h1><p>مكتبة موحدة لبناء تجربة تعليمية سريعة، واضحة ومميزة في كل شاشة.</p></div>
        <BrandLogo light />
      </header>

      <section className="ds-section"><div className="ds-title"><span>01</span><div><h2>ألوان الهوية</h2><p>ألوان وظيفية ثابتة وليست زخرفية.</p></div></div><div className="ds-color-grid">{colors.map(([name, color]) => <Card key={name} className="ds-color-card"><i style={{background: color}}/><b>{name}</b><code>{color}</code></Card>)}</div></section>

      <section className="ds-section"><div className="ds-title"><span>02</span><div><h2>الخطوط</h2><p>Cairo للعربية وInter للإنجليزية.</p></div></div><Card className="ds-type-card"><div><small>Display</small><h1>كل خطوة تقرّبك من هدفك</h1></div><div><small>Heading</small><h2>رحلتك نحو الدرجة الأعلى</h2></div><div><small>Body</small><p>تجربة واضحة تساعد الطالب على معرفة خطوته التالية دون تشتت.</p></div><div dir="ltr"><small>English</small><h2>Master Your Future</h2></div></Card></section>

      <section className="ds-section"><div className="ds-title"><span>03</span><div><h2>الأزرار والحالات</h2><p>نفس الأحجام والحركة وحالات التحميل في كل المنصة.</p></div></div><Card className="ds-demo-row"><Button>ابدأ الآن</Button><Button variant="secondary">عرض التفاصيل</Button><Button variant="outline">تعديل</Button><Button variant="ghost">إلغاء</Button><Button variant="danger">حذف</Button><Button loading>جارٍ الحفظ</Button><Button disabled>غير متاح</Button></Card></section>

      <section className="ds-section"><div className="ds-title"><span>04</span><div><h2>حقول الإدخال</h2><p>Focus واضح، رسائل مساعدة وخطأ موحدة.</p></div></div><Card className="ds-form-grid"><Field label="اسم الطالب" placeholder="اكتب الاسم الكامل" hint="سيظهر الاسم في حساب الطالب."/><Field label="البريد الإلكتروني" type="email" defaultValue="student@mastery.com"/><Field label="الدرجة المستهدفة" defaultValue="1500" error="يجب أن تكون الدرجة بين 400 و1600."/></Card></section>

      <section className="ds-section"><div className="ds-title"><span>05</span><div><h2>البطاقات والإحصاءات</h2><p>مكونات قابلة لإعادة الاستخدام في الرئيسية والتقارير.</p></div></div><div className="ds-stats"><Stat label="الدرجة الحالية" value="1400" change="+55 هذا الشهر" icon="↗"/><Stat label="أيام الاستمرار" value="7 أيام" change="أفضل سلسلة: 12" icon="🔥"/><Stat label="المهام المكتملة" value="18 / 24" change="75% مكتمل" icon="✓"/></div></section>

      <section className="ds-section"><div className="ds-title"><span>06</span><div><h2>التقدم والحالات</h2><p>نفس اللغة البصرية للنجاح والتحذير والذكاء الاصطناعي.</p></div></div><div className="ds-two-columns"><Card><Progress label="تقدم المسار" value={68}/><Progress label="مهمة اليوم" value={25}/><div className="ds-badges"><Badge>نشط</Badge><Badge tone="green">مكتمل</Badge><Badge tone="amber">يحتاج متابعة</Badge><Badge tone="red">متأخر</Badge><Badge tone="purple">AI Coach</Badge></div></Card><Card><Skeleton height={22} width="45%"/><Skeleton height={14}/><Skeleton height={14} width="82%"/><Skeleton height={90}/></Card></div></section>

      <section className="ds-section"><div className="ds-title"><span>07</span><div><h2>الحالات الفارغة</h2><p>توجيه المستخدم بدل ترك الشاشة بلا معنى.</p></div></div><Card><EmptyState title="لا توجد واجبات اليوم" description="ممتاز، أنهيت كل المطلوب. يمكنك بدء تدريب إضافي لتحسين درجتك." action={<Button variant="outline">فتح بنك الأسئلة</Button>}/></Card></section>
    </main>
  );
}
