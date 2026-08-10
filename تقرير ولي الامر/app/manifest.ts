import type {MetadataRoute} from "next";

export default function manifest():MetadataRoute.Manifest{
  return {
    name:"متابعة ولي الأمر",
    short_name:"ولي الأمر",
    description:"متابعة أداء الطالب والتقارير الأسبوعية",
    start_url:"/parent",
    display:"standalone",
    background_color:"#f4f7fb",
    theme_color:"#173f86",
    lang:"ar",
    dir:"rtl",
    icons:[
      {src:"/parent-icon.svg",sizes:"any",type:"image/svg+xml",purpose:"any"}
    ]
  };
}
