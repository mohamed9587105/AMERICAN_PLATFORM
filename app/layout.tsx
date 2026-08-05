import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Mastery | Master Your Future', template: '%s | Mastery' },
  description: 'منصة تعليمية ذكية تقود طلاب SAT وEST وACT من نقطة البداية إلى الدرجة المستهدفة.',
  applicationName: 'Mastery',
  keywords: ['Mastery', 'SAT', 'EST', 'ACT', 'American Diploma', 'Digital SAT'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ar" dir="rtl" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
