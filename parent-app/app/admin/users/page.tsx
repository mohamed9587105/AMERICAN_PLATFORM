import {requireAdminPage} from "@/lib/server/admin-auth";
import AdminUsersManager from "@/components/admin-users-manager";
export const dynamic="force-dynamic";
export default async function AdminUsersPage(){await requireAdminPage("users.manage");return <AdminUsersManager/>}
