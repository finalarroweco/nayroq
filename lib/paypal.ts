import type{PaidPlanKey}from"@/lib/plans";

const isLive=process.env.PAYPAL_ENV==="live";
export const paypalBaseUrl=isLive?"https://api-m.paypal.com":"https://api-m.sandbox.paypal.com";

export const paypalPlanIds:Record<PaidPlanKey,string|undefined>={
 starter:process.env.PAYPAL_STARTER_PLAN_ID||process.env.NEXT_PUBLIC_PAYPAL_STARTER_PLAN_ID,
 business:process.env.PAYPAL_BUSINESS_PLAN_ID||process.env.NEXT_PUBLIC_PAYPAL_BUSINESS_PLAN_ID,
 growth:process.env.PAYPAL_GROWTH_PLAN_ID||process.env.NEXT_PUBLIC_PAYPAL_GROWTH_PLAN_ID
};

export async function getPayPalAccessToken(){const clientId=process.env.PAYPAL_CLIENT_ID||process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;const secret=process.env.PAYPAL_CLIENT_SECRET;if(!clientId||!secret)throw new Error("PayPal server credentials are not configured");const basic=Buffer.from(clientId+":"+secret).toString("base64");const response=await fetch(paypalBaseUrl+"/v1/oauth2/token",{method:"POST",headers:{Authorization:"Basic "+basic,"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=client_credentials",cache:"no-store"});const data=await response.json();if(!response.ok||!data.access_token)throw new Error(data?.error_description||"Could not authenticate with PayPal");return data.access_token as string}

export async function getPayPalSubscription(subscriptionId:string){const token=await getPayPalAccessToken();const response=await fetch(paypalBaseUrl+"/v1/billing/subscriptions/"+encodeURIComponent(subscriptionId),{headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data?.message||"Could not verify PayPal subscription");return data}

export function planFromPayPalId(planId:string):PaidPlanKey|null{for(const[plan,id]of Object.entries(paypalPlanIds))if(id&&id===planId)return plan as PaidPlanKey;return null}
