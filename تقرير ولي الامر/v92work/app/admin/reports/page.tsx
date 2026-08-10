import {Suspense} from "react";
import AdminReportsManager from "@/components/admin-reports-manager";

export const metadata = { title: "سجل تقارير الطلاب | الإدارة" };

function ReportsLoading(){
  return (
    <main
      dir="rtl"
      style={{
        minHeight:"100vh",
        display:"grid",
        placeItems:"center",
        background:"#f3f5f9",
        color:"#536174",
        fontWeight:900
      }}
    >
      جاري تحميل سجل تقارير الطلاب...
    </main>
  );
}

export default function AdminReportsPage(){
  return (
    <Suspense fallback={<ReportsLoading/>}>
      <AdminReportsManager />
    </Suspense>
  );
}
