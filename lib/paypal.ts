import{createClient}from"@supabase/supabase-js";
import type{PaidPlanKey}from"@/lib/plans";

export type PayPalPlatformConfig={
 environment:"sandbox"|"live";
 productId:string|null;
 planIds:Record<PaidPlanKey,string|undefined>;
 webhookId:string|null;
};

export function getPayPalEnvironment():"sandbox"|"live"{return process.env.PAYPAL_ENV==="live"?"live":"sandbox"}
export function getPayPalBaseUrl(environment=getPayPalEnvironment()){return environment==="live"?"https://api-m.paypal.com":"https://api-m.sandbox.paypal.com"}
export const paypalBaseUrl=getPayPalBaseUrl();

function environmentFallback():PayPalPlatformConfig{return{
 environment:getPayPalEnvironment(),
 productId:process.env.PAYPAL_PRODUCT_ID||null,
 planIds:{
  starter:process.env.PAYPAL_STARTER_PLAN_ID||process.env.NEXT_PUBLIC_PAYPAL_STARTER_PLAN_ID,
  business:process.env.PAYPAL_BUSINESS_PLAN_ID||process.env.NEXT_PUBLIC_PAYPAL_BUSINESS_PLAN_ID,
  growth:process.env.PAYPAL_GROWTH_PLAN_ID||process.env.NEXT_PUBLIC_PAYPAL_GROWTH_PLAN_ID
 },
 webhookId:process.env.PAYPAL_WEBHOOK_ID||null
}}

export async function getPayPalConfig():Promise<PayPalPlatformConfig>{const fallback=environmentFallback();const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return fallback;try{const admin=createClient(url,key);const{data,error}=await admin.from("paypal_config").select("environment,product_id,starter_plan_id,business_plan_id,growth_plan_id,webhook_id").eq("singleton",true).maybeSingle();if(error||!data)return fallback;const environment=data.environment==="live"?"live":"sandbox";if(environment!==fallback.environment)return fallback;return{environment,productId:data.product_id||fallback.productId,planIds:{starter:data.starter_plan_id||fallback.planIds.starter,business:data.business_plan_id||fallback.planIds.business,growth:data.growth_plan_id||fallback.planIds.growth},webhookId:data.webhook_id||fallback.webhookId}}catch{return fallback}}

export async function getPayPalAccessToken(){const clientId=process.env.PAYPAL_CLIENT_ID||process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;const secret=process.env.PAYPAL_CLIENT_SECRET;if(!clientId||!secret)throw new Error("PayPal server credentials are not configured");const basic=Buffer.from(clientId+":"+secret).toString("base64");const response=await fetch(getPayPalBaseUrl()+"/v1/oauth2/token",{method:"POST",headers:{Authorization:"Basic "+basic,"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=client_credentials",cache:"no-store"});const data=await response.json();if(!response.ok||!data.access_token)throw new Error(data?.error_description||"Could not authenticate with PayPal");return data.access_token as string}

export async function getPayPalSubscription(subscriptionId:string){const token=await getPayPalAccessToken();const response=await fetch(getPayPalBaseUrl()+"/v1/billing/subscriptions/"+encodeURIComponent(subscriptionId),{headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data?.message||"Could not verify PayPal subscription");return data}

export async function planFromPayPalId(planId:string):Promise<PaidPlanKey|null>{const config=await getPayPalConfig();for(const[plan,id]of Object.entries(config.planIds))if(id&&id===planId)return plan as PaidPlanKey;return null}
