import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
export const runtime="nodejs";
export async function POST(req:Request){
 try{
  const auth=req.headers.get("authorization");if(!auth?.startsWith("Bearer "))return NextResponse.json({error:"Unauthorized"},{status:401});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;if(!url||!key)return NextResponse.json({error:"Storage unavailable"},{status:503});
  const client=createClient(url,key,{global:{headers:{Authorization:auth}}});const{data:{user}}=await client.auth.getUser();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const raw=await req.text();if(raw.length>4096)return NextResponse.json({error:"Request too large"},{status:413});let body;try{body=JSON.parse(raw);}catch{return NextResponse.json({error:"Invalid JSON"},{status:400});}
  if(body?.action==="join"){
   if(typeof body.code!=="string"||!/^[a-f0-9]{64}$/.test(body.code)||typeof body.name!=="string"||!body.name.trim()||body.name.length>100)return NextResponse.json({error:"Check invitation code and name"},{status:400});
   const joined=await client.rpc("redeem_service_invite",{hashed_token:createHash("sha256").update(body.code).digest("hex"),member_name:body.name.trim()});
   if(joined.error)return NextResponse.json({error:"Invitation invalid, expired, already used, or you already own this company"},{status:409});
   return NextResponse.json({companyId:joined.data},{headers:{"Cache-Control":"no-store"}});
  }
  if(typeof body?.companyId!=="string")return NextResponse.json({error:"Company is required"},{status:400});
  const{data:company}=await client.from("companies").select("id").eq("id",body.companyId).eq("owner_id",user.id).maybeSingle();if(!company)return NextResponse.json({error:"Only the company owner can manage access"},{status:403});
  if(body.action==="invite"){
   if(!["agent","manager"].includes(body.role))return NextResponse.json({error:"Invalid role"},{status:400});
   const code=randomBytes(32).toString("hex");const inserted=await client.rpc("issue_service_invite",{target:company.id,hashed_token:createHash("sha256").update(code).digest("hex"),invite_role:body.role});
   if(inserted.error)return NextResponse.json({error:"Unable to create invitation (maximum 20 active invitations)"},{status:409});
   return NextResponse.json({code,expiresInHours:24},{headers:{"Cache-Control":"no-store"}});
  }
  if(body.action==="access"&&typeof body.memberId==="string"&&typeof body.active==="boolean"){
   const result=await client.from("service_members").update({active:body.active}).eq("company_id",company.id).eq("id",body.memberId).select("id").maybeSingle();if(result.error||!result.data)return NextResponse.json({error:"Member not found"},{status:404});return NextResponse.json({ok:true});
  }
  return NextResponse.json({error:"Unknown action"},{status:400});
 }catch{return NextResponse.json({error:"Team request failed"},{status:500});}
}
