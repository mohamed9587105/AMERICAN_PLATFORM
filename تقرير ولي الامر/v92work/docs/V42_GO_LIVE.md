# V42 — تشغيل ولي الأمر على الموبايل

## 1) قاعدة البيانات
في Supabase SQL Editor نفذ:
`supabase/V36_PARENT_APP_SCHEMA.sql`

## 2) متغيرات البيئة
ضع في Vercel:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_SESSION_SECRET`

مهم: لا تستخدم NEXT_PUBLIC مع Service Role Key.

## 3) النشر
ارفع المشروع على GitHub ثم اربطه بـ Vercel، أو استخدم مشروع Vercel قائم.

## 4) روابط الاستخدام
- الأدمن: `/manual-entry`
- سجل التقارير: `/admin/reports`
- دخول ولي الأمر: `/parent-login`
- تطبيق ولي الأمر بعد الدخول: `/parent`
- تعليمات التثبيت: `/install`

## 5) تثبيت على الهاتف
Android Chrome: Install app / Add to Home screen
iPhone Safari: Share > Add to Home Screen

## 6) قبل تسليم أي حساب حقيقي
- أضف الطالب وولي الأمر من الأدمن.
- انشر تقريرًا أسبوعيًا.
- افتح `/parent-login` من هاتف آخر.
- تأكد أن ولي الأمر يرى ابنه فقط وتقاريره المنشورة فقط.
