import AllStudentsManager from "@/components/all-students-manager";

export const metadata={title:"كل الطلاب | الإدارة"};
export const dynamic="force-dynamic";

export default function AllStudentsPage(){
  return <AllStudentsManager/>;
}
