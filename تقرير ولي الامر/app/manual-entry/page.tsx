import {Suspense} from "react";
import ManualEntry from "@/components/manual-entry";
import AdminWorldShell from "@/components/admin-world-shell";
import {requireAdminPage} from "@/lib/server/admin-auth";

export const metadata={title:"إدارة الطلاب والتقارير"};

function Loading(){
  return <main className="admin-world-loading-v90" dir="rtl">جاري تحميل مركز الإدارة...</main>;
}

export default async function ManualEntryPage(){
  const session=await requireAdminPage("dashboard.view");
  return <AdminWorldShell session={session}><Suspense fallback={<Loading/>}><ManualEntry/></Suspense></AdminWorldShell>;
}
