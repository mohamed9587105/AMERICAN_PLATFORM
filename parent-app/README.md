# American Platform — V8 Question Bank CMS Pro

Run:

```powershell
npm.cmd install
npm.cmd run typecheck
npm.cmd run dev
```

Open:
- Control center: http://localhost:3000
- Question Bank CMS Pro: http://localhost:3000/admin/questions
- SAT Exam Engine: http://localhost:3000/exams/start

Question changes and favorites are stored locally in the browser. Use Export JSON to create a portable backup.

## V47 — Bulk Students + Parent Codes + Registration Link
- استيراد الطلبة دفعة واحدة من CSV أو Excel من شاشة الأدمن.
- زر تحميل قالب جاهز للطلبة وأولياء الأمور.
- يولد كود طالب تلقائيًا إذا لم يوجد كود في الشيت.
- يولد كود مستقل لكل ولي أمر بصيغة PR-xxxxxx.
- بعد الاستيراد Online يتم تنزيل شيت ببيانات أولياء الأمور والكود وكود الطالب والباسورد المؤقت للحسابات الجديدة.
- زر "تحميل شيت أولياء الأمور" لتصدير: كود ولي الأمر، الاسم، الرقم، كود الطالب، الطالب، الكورس.
- استمارة حجز عامة على `/register` يمكن إرسال رابطها للطالب.
- الطالب يملأ بياناته وولي الأمر والكورس، ويُضاف مباشرة لقاعدة البيانات ويظهر له كود الطالب وكود ولي الأمر.
- ولي الأمر الثاني اختياري.
- الحجز من أجهزة مختلفة يتطلب تفعيل Supabase؛ وضع Demo لا يشارك البيانات بين الأجهزة.
- قبل التشغيل Online نفّذ `supabase/V47_BULK_REGISTRATION_MIGRATION.sql` بعد مخطط V36.


## V48 — Supabase course_id compatibility fix
- الطلاب يستخدمون `course_id` المرتبط بجدول `courses` الحالي في American Diploma Student Hub.
- إضافة/تعديل الطالب يحول اسم الكورس إلى UUID تلقائيًا.
- SAT وEST يتم ربطهما تلقائيًا بأول كورس نشط من نفس `exam_type`.
- قراءة الطلاب والتقارير وتصدير أولياء الأمور تعرض اسم الكورس من relation `courses`.
- إزالة الاعتماد على العمود القديم `course_name` من قاعدة البيانات.


## V49 — No Demo Flash in Online Mode
- Online mode now starts with an empty/loading student list.
- Demo students are no longer rendered before the Supabase response arrives.
- Supabase students become the only source of truth when `mode=online`.
- Demo/localStorage fallback is used only if the backend reports demo mode or the API cannot be reached.


## V50 — Parent Login / Password Persistence
- باسورد ولي الأمر أصبح يُحفظ فعليًا في `parent_accounts.password_hash`.
- زر واضح "حفظ الباسورد" لكل ولي أمر.
- تعديل اسم ورقم ولي الأمر يُحفظ Online.
- أرقام التليفون تُوحّد إلى digits-only في التسجيل والدخول.


## V51 — Mobile Parent Session Fix
- Session cookie secure flag now follows the actual request protocol.
  - Local LAN HTTP (`192.168.x.x`) => `secure=false`
  - Production HTTPS => `secure=true`
- Login fetch uses `credentials: "include"`.
- Successful login uses hard navigation to `/parent`.
- Parent reports/logout fetches explicitly include credentials.
- Added diagnostic endpoint: `/api/auth/session`.


## V52 — Hybrid Mobile Session
- Keeps HttpOnly cookie as the primary parent session.
- Adds a local HTTP/LAN fallback token for mobile browsers that do not persist the cookie.
- `/api/parent/reports` accepts cookie first, then Bearer token fallback.
- `/parent` automatically sends the fallback token when available.
- Logout clears both cookie and fallback token.
- Production HTTPS still uses the secure HttpOnly cookie path.


## V53 — Mobile Login Hard Fix
- Disables/unregisters the PWA service worker automatically on localhost/LAN HTTP testing.
- Clears PWA caches on local network so the phone always receives fresh code.
- Successful login carries the fallback session in a URL fragment (`#session=...`).
- `/parent` consumes the fragment locally, stores the session, removes it from the address bar, then loads reports.
- Session-dependent API routes are force-dynamic/no-cache.
- Production HTTPS still registers the PWA normally.


## V54 — Native Parent Login
- Parent login no longer depends on React hydration or client JavaScript.
- `/parent-login` now submits a native HTML POST.
- New endpoint: `/api/auth/parent-login-form`.
- Server validates parent phone/password and returns a 303 redirect.
- Session token is bootstrapped to `/parent` and then removed from the visible URL.
- Service worker never caches `/parent-login`, `/api/*`, or `/_next/*`.
- This specifically fixes mobile logs that showed only `GET /parent-login?` and no login POST.


## V55 — Correct Mobile Redirect Host
- Fixes successful parent login redirecting to `http://0.0.0.0:3000`.
- Redirects now prefer the browser's real `Host` / `x-forwarded-host` header.
- On LAN, a request opened at `http://192.168.100.2:3000` redirects back to the same host.
- HTTPS detection also respects `x-forwarded-proto` for future Vercel deployment.


## V56 — Server-rendered Parent Portal
- `/parent` is now a Server Component.
- No React hydration or client JavaScript is required to view reports.
- Reads parent session, linked students, and published reports directly on the server.
- If no report exists, shows a real empty state instead of staying on "جاري التحميل".
- Student switching and weekly report navigation work as normal server links.
- Works even on mobile browsers where client-side hydration is failing.


## V57 — Finance Render Fix
- Fixes `/parent` crash after publishing a report.
- Supabase may return `finance_entries` as a single object because finance is one-to-one per report.
- Added `asArray()` normalization so one-to-one or one-to-many relation shapes render safely.
- Also normalizes attendance, homework, exams, and finance before rendering.


## V58 — Parent Mobile Navigation
- `/parent` is now a true home dashboard, not the detailed reports page.
- `/parent/reports` contains the weekly report archive and full report details.
- `/parent/account` contains parent information and linked students.
- Account tab no longer logs the parent out.
- Explicit "تسجيل الخروج" button added inside account page.
- Bottom navigation now points to three genuinely different screens.


## V59 — Admin Reports Relation Shape Fix
- Fixes `/admin/reports` crash when Supabase returns `finance_entries` as one object.
- Added `asArray()` normalization in AdminReportsManager.
- Finance, attendance, homework, exams, and exam sections now render safely whether Supabase returns an object or an array.
- Keeps V58 mobile navigation changes intact.


## V61 — Exact Old Mobile UI Restore
- Rebuilt `/parent` from the supplied video reference rather than approximating it.
- Restored the original five-tab bottom navigation:
  الرئيسية / الامتحانات / الحضور / الواجبات / المالية
- Restored the blue student card, weekly-report icon, quick indicators, red attention block,
  green financial block, exam analysis screen, attendance screen, homework screen and finance screen.
- Tabs use server-rendered `?tab=` navigation, so the working V59 Supabase/session backend remains intact.


## V62 — Home Screen First
- Changes only the parent mobile home screen.
- Student name/course at top right.
- Weekly report app-style 4D button at top left.
- Large, unified typography for parent readability.
- Four clear 4D metric buttons linking to Exams, Homework, Attendance and Commitment.
- Keeps "يحتاج انتباهك" as the approved red attention panel.
- "تواصل معنا" is the last card on the home page.
- Other screens remain from V61 for later screen-by-screen refinement.


## V63 — Exams Screen by Week
- Changes only the mobile Exams screen.
- Removes the student header/card from the Exams tab.
- Starts with a clear list of published weeks.
- Each week is a large button showing week label and date range.
- Selecting a week shows only that week's exams, grades and section scores.
- Keeps V62 Home screen unchanged.


## V64 — Unified Header + Exam Accordion
- The same student/course + weekly-report header used on Home now appears on all parent tabs.
- Exams are grouped by published week using native `<details>` accordion.
- Tap a week to open; tap the same week again to close.
- Each exam shows Reading, Writing and Total / 800.
- Each exam includes a note area.
- Home screen from V62 remains unchanged.


## V65 — 3D Week Buttons
- Changes only the visual styling of week accordion buttons.
- Weeks now use a vivid blue/purple 3D surface with depth, highlight, and press state.
- Open week uses a darker pressed visual while keeping the same accordion behavior.


## V66 — Attendance by Week
- Attendance screen now follows the same 3D weekly accordion pattern as Exams.
- Green = present, red = absent, orange = late.
- Each week opens/closes on tap and shows its individual attendance days.


## V67 — Homework by Week
- Homework now follows the weekly 3D accordion model.
- Each week opens/closes on tap.
- Each homework shows status and actual score: score / max_score.
- Completed = green, late = orange, missing = red.
- Keeps V62 Home, V65 Exams and V66 Attendance intact.


## V69 — Automatic Session Finance
- New ledger model: payments are positive transactions, session charges are negative transactions.
- Default pricing:
  - SAT: 450 EGP/session, or 10 USD/session when the student's billing currency is USD.
  - EST: 350 EGP/session.
  - Beginners 1/2: 350 EGP/session.
- Present and late attendance are charged automatically on report publish.
- Absent attendance is not charged by default; admin can enable it per student.
- Republishing a report replaces that report's session charges, preventing duplicate deductions.
- Admin student profile now contains billing currency, per-session price, auto-charge settings, payment entry, and live balance.
- Parent Finance tab now shows live balance and full transaction ledger.
- Negative balance is shown as money owed.
- Run `supabase/V69_AUTOMATIC_SESSION_FINANCE.sql` once before using this build.


## V70 — Admin Finance Reports
- Added `/admin/finance`.
- Student report: code, course, session price, payments, charges, session count, balance.
- Per-student account drawer with full transaction ledger.
- Course report: students count, total payments, total session charges, money owed, available credit and net balance.
- Search and filters by course/currency.
- Uses the V69 financial ledger directly; no duplicate reporting data.


## V71 — Student finance shortcut
- Added a prominent `الحساب المالي` button directly beside the selected student's name in Admin.
- The button opens the Admin Finance Reports page.


## V72 — Group finance access
- Removed the large "الحساب المالي التلقائي" block from inside the student profile.
- Added "التقارير المالية" to the top Group Management actions.
- Styled Group Management actions as consistent 3D buttons.
- Added a "الحساب المالي" button next to each student in the admin student list.
- Per-student button opens `/admin/finance?student=<id>` and auto-opens that student's ledger.


## V73 — Correct Admin Finance Placement
- Added "التقارير المالية" inside the real "إدارة جماعية" tools block.
- Converted all Group Management controls to the same 3D button style.
- Added a separate "الحساب المالي" button under every student in the actual left student list.
- Per-student finance button opens `/admin/finance?student=<id>` and automatically opens that student's ledger.
- Removed the accidental finance shortcut from search results.
- The large automatic finance block remains removed.


## V74 — Unified 3D Admin Buttons
- "سجل تقارير الطلاب", "تجربة دخول ولي الأمر", and "عرض تطبيق ولي الأمر" now use the same purple 3D style as "التقارير المالية".
- Every control inside "إدارة جماعية" now uses that exact same 3D color and visual treatment.
- Main Admin top action buttons are also normalized to the same visual system.


## V75 — Student Pricing & Payment Management
- "الحساب المالي" now opens editable student billing controls:
  currency, per-session price, auto-charge settings, quick payment entry and live balance.
- Added "الدفعات" button beside every student in Admin Finance Reports.
- Payments view supports add, edit and delete for payment transactions.
- Editing/deleting a payment updates the student's balance immediately.
- SAT supports EGP or USD; other current courses remain EGP-only.


## V76 — All Students Management
- Added standalone `/admin/students`.
- Shows every student in one searchable/filterable table.
- Each student has three direct 3D actions:
  - تعديل البيانات
  - تعديل التقرير
  - تعديل الحسابات
- "تعديل البيانات" opens Admin with that student selected and edit mode enabled.
- "تعديل التقرير" opens that student's reports.
- "تعديل الحسابات" opens that student's finance account.
- Added "كل الطلاب" shortcut inside Group Management.


## V77 — Premium Admin & Reports Design
- Premium visual redesign for the main Admin dashboard and Student Reports history.
- Unified navy / royal-blue / purple visual system.
- Glassy top controls, stronger hierarchy, more spacious cards, refined borders and shadows.
- Student sidebar, admin content panels, group-management block and report panels now share one premium system.
- Existing functionality and routes remain unchanged.


## V78 — Fix Edit Student Button
- Fixed "تعديل البيانات" from `/admin?...` to the actual student editor route:
  `/manual-entry?student=<id>&edit=student`.
- The selected student is loaded and edit mode opens automatically.


## V79 — Search only when typing
- Student search starts completely empty.
- Results never appear unless the search box is focused and the user has typed text.
- Clicking outside hides the dropdown.
- Selecting a result clears the search field and closes results.
- Browser autocomplete is disabled for this search field.


## V80 — Inline Edit Modals
- All three student-management actions now open premium modals without leaving `/admin/students`.
- Data modal edits student, course, parent contact and report visibility and saves to Supabase.
- Report modal loads the student's weeks and edits attendance, homework, exams, section scores and notes.
- Finance modal edits currency/session price, auto-charge settings, adds payments and shows recent ledger activity.
- The student list stays visible in the background and refreshes after saves.


## V81 — Pre-release polish
- Existing weekly reports now update in-place from the inline report modal instead of creating duplicate weeks.
- Existing attendance/homework/exam child rows are rebuilt safely on report update.
- Improved student table readability with sticky headers and hover states.
- Improved keyboard focus states and mobile modal sizing.
- This build is intended as the pre-deployment review candidate.


## V82 — Typecheck fixes
- Fixed `student_billing_profiles` map typing in finance reports.
- Fixed duplicate `className` attributes in Admin header buttons.
- Added the missing `xlsx` dependency used by Zoom attendance importer.
- Added TypeScript excludes for accidental nested `PARENT_APP_*` backup folders.
- Important on Windows: do not keep an extracted copy of another full project inside the active project folder.


## V83 — Admin Reports Suspense Fix
- Wrapped `AdminReportsManager` in React `Suspense` on `/admin/reports`.
- Fixes Next.js 16 production build error caused by `useSearchParams()` during prerender.
- Added a lightweight Arabic loading fallback for the reports page.


## V84 — Manual Entry Suspense Fix
- Wrapped `ManualEntry` in React `Suspense` on `/manual-entry`.
- Fixes Next.js 16 production build prerender error caused by `useSearchParams()`.
- Added an Arabic loading fallback for the admin editor.


## V85 — Premium Student Data Popup
- Redesigned "تعديل البيانات" as a premium modal without leaving All Students.
- Split into Student Data, Parent Data, and Report Visibility sections.
- Added optional parent password change.
- Added sticky Save/Cancel footer.
- Student row updates immediately after Save.


## V86 — True Popup Modal
- Student edit modal now renders with `createPortal(..., document.body)`.
- Popup is fully detached from the student table/layout and always appears above the entire page.
- Full-screen dark/blurred backdrop.
- Body scrolling is locked while popup is open.
- Modal is centered on desktop and mobile and never expands inline below the student row.


## V87 — Secure Admin Authentication
- Added `/admin-login`.
- Admin credentials come only from Vercel/server environment:
  - `ADMIN_EMAIL`
  - `ADMIN_PASSWORD`
  - existing `APP_SESSION_SECRET`
- Admin session uses an HttpOnly/Secure cookie and expires after 12 hours.
- `/manual-entry` is protected server-side.
- All `/admin/*` pages are protected by `app/admin/layout.tsx`.
- Every `/api/admin/*` route returns `401` without a valid admin session.
- Added visible Logout control to protected admin areas.
- Parent login, parent app, and public registration remain public and unaffected.


## V88 — Cleaner Admin Workspace
- Removed the always-visible student sidebar/list from the main Admin report-entry screen.
- Student selection remains available through search when needed.
- Added a direct shortcut to `/admin/students` for full student management.
- Main Admin workspace now uses the full available width.
- Builds on V87 secure admin authentication.
