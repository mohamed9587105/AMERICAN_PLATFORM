import BulkDataEntryCenter from "@/components/bulk-data-entry-center";
import {getAdminSession,requireAdminPage} from "@/lib/server/admin-auth";
export const dynamic="force-dynamic";
export default async function BulkDataEntryPage(){
  const session=await requireAdminPage();
  const can=(p:string)=>Boolean(session?.isOwner||session?.permissions?.[p]);
  if(!["data_entry.attendance","data_entry.homework","data_entry.exams","data_entry.finance"].some(can)){
    await requireAdminPage("data_entry.attendance");
  }
  const permissions=session?.isOwner?{attendance:true,homework:true,exam:true,finance:true}:{
    attendance:can("data_entry.attendance"),homework:can("data_entry.homework"),exam:can("data_entry.exams"),finance:can("data_entry.finance")
  };
  return <BulkDataEntryCenter allowedModes={permissions}/>;
}
