"use client";
import {useEffect,useState} from "react";
type Event={id:string;event_type:string;title:string;event_at:string;note?:string|null};
export default function ParentScheduleReminders({events,minutes=30}:{events:Event[];minutes?:number}){
  const [permission,setPermission]=useState<string>(typeof Notification==="undefined"?"unsupported":Notification.permission);
  const enable=async()=>{
    if(typeof Notification==="undefined")return;
    const p=await Notification.requestPermission();setPermission(p);
  };
  useEffect(()=>{
    if(typeof window==="undefined"||typeof Notification==="undefined")return;
    const fired=new Set<string>();
    const check=()=>{
      const now=Date.now();
      for(const e of events){
        const at=new Date(e.event_at).getTime();
        const diff=at-now;
        if(diff<=minutes*60000&&diff>0&&!fired.has(e.id)){
          fired.add(e.id);
          if(Notification.permission==="granted")new Notification(`موعد قريب: ${e.title}`,{body:`متبقي حوالي ${Math.max(1,Math.ceil(diff/60000))} دقيقة`});
          try{
            const ctx=new AudioContext();
            const o=ctx.createOscillator(),g=ctx.createGain();
            o.connect(g);g.connect(ctx.destination);o.frequency.value=740;g.gain.value=.06;o.start();o.stop(ctx.currentTime+.35);
          }catch{}
        }
      }
    };
    check();const id=window.setInterval(check,30000);return()=>clearInterval(id);
  },[events,minutes]);
  return <section className="parent-reminder-permission-v117">
    <div><strong>تنبيهات المواعيد</strong><span>{permission==="granted"?"مفعّلة":"فعّلها لاستقبال تنبيه قبل الموعد"}</span></div>
    {permission!=="granted"&&permission!=="unsupported"?<button onClick={enable}>تفعيل التنبيهات</button>:null}
  </section>
}
