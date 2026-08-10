import {requireAdminPage,hasPermission} from "@/lib/server/admin-auth";
import AdminReportsManager from "@/components/admin-reports-manager";
export const dynamic="force-dynamic";
export default async function Page(){
  const session=await requireAdminPage("reports.view");
  return <AdminReportsManager canEdit={hasPermission(session,"reports.edit")} canPdf={hasPermission(session,"reports.pdf")}/>;
}
