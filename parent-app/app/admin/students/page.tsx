import {requireAdminPage,hasPermission} from "@/lib/server/admin-auth";
import AllStudentsManager from "@/components/all-students-manager";
export const dynamic="force-dynamic";
export default async function Page(){
  const session=await requireAdminPage("students.view");
  return <AllStudentsManager permissions={{
    edit:hasPermission(session,"students.edit"),
    password:hasPermission(session,"students.password"),
    toggle:hasPermission(session,"students.toggle"),
    importStudents:hasPermission(session,"students.import"),
    create:hasPermission(session,"students.create"),
    reports:hasPermission(session,"reports.view"),
    finance:hasPermission(session,"finance.view")
  }}/>;
}
