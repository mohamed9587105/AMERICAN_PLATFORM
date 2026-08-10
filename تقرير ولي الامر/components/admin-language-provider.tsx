"use client";
import {createContext,useContext,useEffect,useMemo,useState} from "react";

type Lang="en"|"ar";
type Ctx={lang:Lang;dir:"ltr"|"rtl";setLang:(l:Lang)=>void;t:(en:string,ar:string)=>string};
const AdminLangContext=createContext<Ctx|null>(null);

export function AdminLanguageProvider({children}:{children:React.ReactNode}){
  const [lang,setLangState]=useState<Lang>("en");
  useEffect(()=>{
    const saved=localStorage.getItem("admin_lang");
    if(saved==="ar"||saved==="en")setLangState(saved);
  },[]);
  const setLang=(l:Lang)=>{setLangState(l);localStorage.setItem("admin_lang",l)};
  const value=useMemo<Ctx>(()=>({lang,dir:lang==="ar"?"rtl":"ltr",setLang,t:(en,ar)=>lang==="ar"?ar:en}),[lang]);
  return <AdminLangContext.Provider value={value}>{children}</AdminLangContext.Provider>;
}

export function useAdminLanguage(){
  const ctx=useContext(AdminLangContext);
  if(!ctx)throw new Error("useAdminLanguage must be used inside AdminLanguageProvider");
  return ctx;
}
