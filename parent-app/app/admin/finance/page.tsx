import {requireAdminPage} from "@/lib/server/admin-auth";
import AdminFinanceReports from "@/components/admin-finance-reports";
export const dynamic="force-dynamic";
export default async function Page(){await requireAdminPage("finance.view");return <AdminFinanceReports/>}
