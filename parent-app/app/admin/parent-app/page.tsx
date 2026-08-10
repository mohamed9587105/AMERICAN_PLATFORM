import {requireAdminPage} from "@/lib/server/admin-auth";
import ParentAppAdminSettings from "@/components/parent-app-admin-settings";
export const dynamic="force-dynamic";
export default async function Page(){await requireAdminPage("dashboard.view");return <ParentAppAdminSettings/>}
