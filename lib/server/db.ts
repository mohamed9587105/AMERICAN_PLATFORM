import "server-only";

const url=process.env.SUPABASE_URL;
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dbConfigured=Boolean(url&&serviceKey);

function headers(extra:Record<string,string>={}){
  if(!url||!serviceKey) throw new Error("DATABASE_NOT_CONFIGURED");
  return {
    apikey:serviceKey,
    Authorization:`Bearer ${serviceKey}`,
    "Content-Type":"application/json",
    Prefer:"return=representation",
    ...extra
  };
}

export async function dbSelect(table:string, query=""){
  if(!dbConfigured) return [];
  const res=await fetch(`${url}/rest/v1/${table}?${query}`,{
    headers:headers(),
    cache:"no-store"
  });
  if(!res.ok) throw new Error(`DB_SELECT_${table}_${res.status}:${await res.text()}`);
  return res.json();
}

export async function dbInsert(table:string, body:any){
  if(!dbConfigured) throw new Error("DATABASE_NOT_CONFIGURED");
  const res=await fetch(`${url}/rest/v1/${table}`,{
    method:"POST",
    headers:headers(),
    body:JSON.stringify(body)
  });
  if(!res.ok) throw new Error(`DB_INSERT_${table}_${res.status}:${await res.text()}`);
  return res.json();
}

export async function dbUpdate(table:string, query:string, body:any){
  if(!dbConfigured) throw new Error("DATABASE_NOT_CONFIGURED");
  const res=await fetch(`${url}/rest/v1/${table}?${query}`,{
    method:"PATCH",
    headers:headers(),
    body:JSON.stringify(body)
  });
  if(!res.ok) throw new Error(`DB_UPDATE_${table}_${res.status}:${await res.text()}`);
  return res.json();
}

export async function dbDelete(table:string, query:string){
  if(!dbConfigured) throw new Error("DATABASE_NOT_CONFIGURED");
  const res=await fetch(`${url}/rest/v1/${table}?${query}`,{
    method:"DELETE",
    headers:headers({"Prefer":"return=minimal"})
  });
  if(!res.ok) throw new Error(`DB_DELETE_${table}_${res.status}:${await res.text()}`);
  return true;
}
