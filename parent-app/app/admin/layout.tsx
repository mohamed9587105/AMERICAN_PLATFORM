import type {ReactNode} from "react";
import {requireAdminPage} from "@/lib/server/admin-auth";
import AdminWorldShell from "@/components/admin-world-shell";

export const dynamic="force-dynamic";
export const revalidate=0;

export default async function AdminLayout({children}:{children:ReactNode}){
  const session=await requireAdminPage();
  return <AdminWorldShell session={session}>{children}</AdminWorldShell>;
}
