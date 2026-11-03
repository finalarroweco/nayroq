import { createClient } from "@/lib/supabase/client";
export async function ownerWorkspace() {
  const client = createClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new Error("Sign in to continue / يرجى تسجيل الدخول");
  const result = await client.from("companies").select("id,name").eq("owner_id", user.id).limit(1).maybeSingle();
  if (result.error) throw new Error("Cannot load company / تعذّر تحميل الشركة");
  if (!result.data) throw new Error("Complete company onboarding / أكمل إعداد الشركة");
  return { client, company: result.data };
}
