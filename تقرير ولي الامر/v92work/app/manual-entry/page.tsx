import {Suspense} from "react";
import ManualEntry from "@/components/manual-entry";
import AdminWorldShell from "@/components/admin-world-shell";
import {requireAdminPage} from "@/lib/server/admin-auth";

export const metadata = { title: "إدارة الطلاب والتقارير" };

function ManualEntryLoading(){
  return <main className="admin-world-loading-v90" dir="rtl">جاري تحميل مركز الإدارة...</main>;
}

export default async function ManualEntryPage(){
  await requireAdminPage();
  return <AdminWorldShell><Suspense fallback={<ManualEntryLoading/>}><ManualEntry /></Suspense></AdminWorldShell>;
}
