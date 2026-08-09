import "server-only";
import crypto from "crypto";

const secret=process.env.APP_SESSION_SECRET||"dev-only-change-me";

export function hashPassword(password:string,salt=crypto.randomBytes(16).toString("hex")){
  const hash=crypto.pbkdf2Sync(password,salt,120000,32,"sha256").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password:string,stored:string){
  const [salt,hash]=stored.split(":");
  if(!salt||!hash) return false;
  const candidate=crypto.pbkdf2Sync(password,salt,120000,32,"sha256").toString("hex");
  try{
    return crypto.timingSafeEqual(Buffer.from(hash,"hex"),Buffer.from(candidate,"hex"));
  }catch{return false}
}

function sign(payload:string){
  return crypto.createHmac("sha256",secret).update(payload).digest("base64url");
}

export function createSession(data:Record<string,any>){
  const payload=Buffer.from(JSON.stringify({...data,exp:Date.now()+1000*60*60*24*30})).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSession(token?:string|null){
  if(!token) return null;
  const [payload,sig]=token.split(".");
  if(!payload||!sig||sign(payload)!==sig) return null;
  try{
    const data=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));
    if(!data.exp||data.exp<Date.now()) return null;
    return data;
  }catch{return null}
}
