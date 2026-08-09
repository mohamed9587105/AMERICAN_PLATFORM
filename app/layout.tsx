import "./globals.css";
import PwaRegister from "@/components/pwa-register";
import type { Metadata, Viewport } from "next";



export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#f8faff",
};

export const metadata: Metadata = {
  title: "تطبيق ولي الأمر",
  description: "متابعة شاملة لحالة الطالب الأكاديمية والمالية",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body><PwaRegister />{children}</body>
    </html>
  );
}
