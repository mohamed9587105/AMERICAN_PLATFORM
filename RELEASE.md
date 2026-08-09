# V9 — Import Engine

- Bulk JSON import
- Bulk CSV import
- Paste-and-parse workflow
- Validation preview
- Duplicate detection
- Merge, update, or replace modes
- Downloadable CSV template
- Direct link from Question Bank CMS

## V7 — Mastery Visual Identity
- Rebranded the platform from American Platform / American Mastery to **Mastery**.
- Added the official vector Mastery mark and reusable BrandLogo component.
- Added Mastery favicon/app icon and global metadata.
- Added a full visual token system for colors, radius, shadows, surfaces and states.
- Applied the navy/blue/cyan identity to the student dashboard, learning center, navigation, hero, cards, buttons, forms and admin import header.
- Added reduced-motion accessibility support and responsive logo behavior.

## V8 — Mastery Design System Foundation
- Added reusable UI primitives: Button, Card, Badge, Field, Progress, Stat, EmptyState and Skeleton.
- Added a live visual reference page at `/design-system`.
- Unified component states: hover, focus, disabled, loading, validation and empty states.
- Added responsive component documentation and a direct dashboard navigation link.

## MASTERY V9 — Journey Dashboard
- Added a persistent Destination strip showing current score, target, next milestone, and exam countdown.
- Added a four-stage Journey Pulse to make the student experience feel like a guided climb.
- Applied the Mastery V8 UI tokens to the new dashboard components.
- Added the Next.js smooth-scroll metadata hint to remove the development warning.

## V10 — Master Exam Engine
- Added four exam profiles: SAT, EST, ACT, and Beginners.
- Added dynamic sections and timings per exam profile.
- Rebuilt exam setup as a profile-driven selection experience.
- Exam session, timer, review, local save, and results now follow the selected profile.
- Expanded question types to support Reading, Writing, Math, English, Science, Grammar, and Vocabulary.

## V11 — ACT Official-Style Experience
- Dedicated ACT session layout, independent from SAT.
- Purple ACT toolbar, split passage/question workspace, official-style bottom navigation.
- Question navigator with answered, unanswered and marked states.
- Accessibility tools: text sizing, contrast, line reader and answer masking.
- Calculator appears only in ACT Math.
- ACT section times updated for the enhanced format used by this prototype.

## V12 — ACT Experience Refinement
- Rebuilt the ACT testing workspace with a neutral, secure-testing visual system.
- Added a two-level command/tool bar, saved-response status, clearer timer, and section context.
- Improved passage/question layout, LTR isolation, answer-choice states, elimination controls, navigator, accessibility tools, and mobile behavior.
- Added passage highlighting and refined contrast, masking, line-reader, and Math calculator access.

## MASTERY V13 — ACT Compact Exam Navigation
- Moved ACT question progress into a fixed bottom dock.
- Added horizontally scrollable question numbers with current, answered, and review states.
- Replaced the crowded ACT toolbar with a single Tools dropdown.
- Moved zoom, highlighting, contrast, line reader, answer masking, calculator, and reset actions into the dropdown.
- Added responsive mobile behavior for the bottom question strip and tools panel.

## MASTERY V13.1 — ACT Timer & Reading Workspace
- Removed the duplicate global exam header/timer from ACT mode.
- Connected the remaining ACT timer to the real countdown state.
- Added click-to-hide/click-to-show timer behavior and saved the preference locally.
- Enlarged the navy Reading/Passage header for clearer section identification.
- Increased the default passage width to 60% on desktop.
- Added a draggable divider to resize passage and question panels (45%–72%).
- Saved the preferred passage width locally.

## V13.2 — ACT Refined Testing Surface
- Replaced the stark white full-screen background with a very light neutral testing surface.
- Kept the passage and question areas pure white for maximum readability.
- Added restrained borders, soft elevation, and clearer separation between testing regions.
- Refined the navy passage header and bottom question dock without adding visual distraction.
- Preserved the single interactive timer, resizable passage, compact tools menu, and bottom question progress.


## V13.3 — ACT Section Strip Readability
- Fixed the ACT section name contrast after the toolbar background was changed to light gray.
- The Reading/English section title is now dark and clearly visible in normal mode.
- Added matching high-contrast mode colors.
- The passage header now displays the active section name, such as “READING Passage”.

## V14 — Exam Experience Core
- Fullscreen and focus modes for ACT.
- Automatic response-save status.
- A–D / 1–4 answer shortcuts, arrow navigation, M review flag and F focus shortcut.
- Smooth question transitions and automatic panel/question-strip positioning.
- Per-question telemetry: time, visits, and answer changes.
- Exam Replay timeline and behavior analytics on the result screen.
- Scheduled break screen foundation.
- Urgent final-five-minute timer treatment.

## V15 — SAT & ACT Official-Style UI Polish
- Rebuilt the SAT session as a clean split-pane secure-testing layout with compact controls, timer hide/show, question strip, answer states, notes, highlighting, references, and math calculator access.
- Rebuilt the ACT session to closely follow the supplied visual reference: navy command bar, passage/question split, draggable divider, right-side reading tools, compact answers, inline Back/Next, and bottom progress/navigation.
- Preserved Mastery branding and original implementation while aligning spacing, proportions, typography, and interaction patterns with familiar digital-test environments.

## V16 — EST Paper Simulation
- Added paper-style EST booklet with separate interactive bubble sheet.
- Linked paper questions and bubble rows with synchronized navigation and review flags.
- Added Paper View / Digital View switch and responsive mobile layout.

## V47
- Bulk student import and CSV template.
- Parent codes and parent export sheet.
- Public student registration form at /register.
- Direct creation of student and parent accounts from registration.
