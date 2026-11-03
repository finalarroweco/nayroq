import { createClient } from "@/lib/supabase/client";
export async function ownerWorkspace() {
  const client = createClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new Error("Sign in to continue / يرجى تسجيل الدخول");
  let chosen: string | null = null;
  try { chosen = localStorage.getItem("nayroq_service_company"); } catch {}
  if (chosen) {
    const selected = await client.from("companies").select("id,name,owner_id").eq("id", chosen).maybeSingle();
    if (selected.data) {
      if(selected.data.owner_id===user.id)return {client,company:selected.data,role:"owner"};
      const membership=await client.from("service_members").select("role").eq("company_id",chosen).eq("user_id",user.id).eq("active",true).maybeSingle();
      if(membership.data)return {client,company:selected.data,role:membership.data.role};
    }
  }
  const result = await client.from("companies").select("id,name,owner_id").eq("owner_id", user.id).limit(1).maybeSingle();
  if (result.error) throw new Error("Cannot load company / تعذّر تحميل الشركة");
  if (result.data) return { client, company: result.data,role:"owner" };
  const member=await client.from("service_members").select("company_id,role").eq("user_id",user.id).eq("active",true).order("created_at").limit(1).maybeSingle();
  if(member.data){const selected=await client.from("companies").select("id,name,owner_id").eq("id",member.data.company_id).maybeSingle();if(selected.data)return {client,company:selected.data,role:member.data.role};}
  throw new Error("Complete company onboarding or join a service team / أكمل إعداد الشركة أو انضم إلى فريق خدمة");
}
