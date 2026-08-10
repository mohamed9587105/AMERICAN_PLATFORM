import {requireAdminPage} from "@/lib/server/admin-auth";
import AdminAuditLog from "@/components/admin-audit-log";
export const dynamic="force-dynamic";
export default async function AuditPage(){await requireAdminPage("audit.view");return <AdminAuditLog/>}
