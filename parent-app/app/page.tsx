import ParentApp from "@/components/parent-app";

const allowedTabs = new Set([
  "home","academic","exams","attendance","tasks","commitment","finance","notifications","weekly","contact","account"
]);

export default async function Page({
  searchParams
}:{
  searchParams: Promise<{tab?:string}>
}){
  const params=await searchParams;
  const requested=String(params?.tab||"home");
  const initialTab=allowedTabs.has(requested) ? requested : "home";

  return <ParentApp initialTab={initialTab as any}/>;
}
