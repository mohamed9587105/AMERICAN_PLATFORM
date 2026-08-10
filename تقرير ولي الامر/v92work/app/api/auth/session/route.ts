export const dynamic="force-dynamic";
export const revalidate=0;
import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {readSession} from "@/lib/server/auth";

export async function GET(req:Request){
  const jar=await cookies();
  const raw=jar.get("parent_session")?.value;
  const authHeader=req.headers.get("authorization")||"";
  const bearer=authHeader.toLowerCase().startsWith("bearer ")?authHeader.slice(7).trim():"";
  const session=readSession(raw||bearer);
  return NextResponse.json({
    hasCookie:Boolean(raw),
    hasBearer:Boolean(bearer),
    valid:Boolean(session),
    type:session?.type||null
  });
}
