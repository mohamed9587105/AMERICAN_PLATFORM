"use client";
import {useEffect} from "react";

function isLocalLanHost(hostname:string){
  return hostname==="localhost" ||
    hostname==="127.0.0.1" ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
}

export default function PwaRegister(){
  useEffect(()=>{
    if(!("serviceWorker" in navigator)) return;

    const localHttp=
      window.location.protocol==="http:" &&
      isLocalLanHost(window.location.hostname);

    if(localHttp){
      navigator.serviceWorker.getRegistrations()
        .then(regs=>Promise.all(regs.map(r=>r.unregister())))
        .catch(()=>{});

      if("caches" in window){
        caches.keys()
          .then(keys=>Promise.all(keys.map(k=>caches.delete(k))))
          .catch(()=>{});
      }
      return;
    }

    const register=()=>navigator.serviceWorker.register("/sw.js").catch(()=>{});
    const w=window as Window & typeof globalThis & {requestIdleCallback?:(cb:()=>void,opts?:{timeout:number})=>number};
    if(typeof w.requestIdleCallback==="function"){
      w.requestIdleCallback(register,{timeout:2500});
    }else{
      setTimeout(register,1200);
    }
  },[]);

  return null;
}
