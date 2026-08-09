import {Suspense} from "react";
import ManualEntry from "@/components/manual-entry";

export const metadata = { title: "إدارة الطلاب والتقارير" };

function ManualEntryLoading(){
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
      جاري تحميل لوحة الإدارة...
    </main>
  );
}

export default function ManualEntryPage(){
  return (
    <Suspense fallback={<ManualEntryLoading/>}>
      <ManualEntry />
    </Suspense>
  );
}
