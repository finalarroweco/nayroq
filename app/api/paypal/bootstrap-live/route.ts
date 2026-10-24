import{NextResponse}from"next/server";
import{createClient}from"@supabase/supabase-js";
import{getPayPalAccessToken,getPayPalBaseUrl,getPayPalEnvironment}from"@/lib/paypal";
import{PLANS,type PaidPlanKey}from"@/lib/plans";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const paidPlans:PaidPlanKey[]=["starter","business","growth"];

async function paypalPost(path:string,body:any,requestId:string,token:string){
 const response=await fetch(getPayPalBaseUrl()+path,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json",Accept:"application/json",Prefer:"return=representation","PayPal-Request-Id":requestId},body:JSON.stringify(body),cache:"no-store"});
 const data=await response.json();
 if(!response.ok)throw new Error(data?.details?.[0]?.description||data?.message||`PayPal request failed (${response.status})`);
 return data;
}

function planBody(productId:string,plan:PaidPlanKey){
 return{product_id:productId,name:`NAYROQ ${PLANS[plan].name}`,description:`NAYROQ ${PLANS[plan].name} monthly subscription`,billing_cycles:[{frequency:{interval_unit:"MONTH",interval_count:1},tenure_type:"REGULAR",sequence:1,total_cycles:0,pricing_scheme:{fixed_price:{value:PLANS[plan].price.toFixed(2),currency_code:"USD"}}}],payment_preferences:{auto_bill_outstanding:true,payment_failure_threshold:3}};
}

async function bootstrap(supplied:string|null){
 try{
  if(!supplied||supplied!==process.env.PAYPAL_BOOTSTRAP_TOKEN)return NextResponse.json({error:"Forbidden"},{status:403,headers:{"Cache-Control":"no-store"}});
  const environment=getPayPalEnvironment();
  if(environment!=="live")return NextResponse.json({error:"PAYPAL_ENV must be live"},{status:409,headers:{"Cache-Control":"no-store"}});
  if(!process.env.PAYPAL_CLIENT_ID||!process.env.PAYPAL_CLIENT_SECRET)return NextResponse.json({error:"PayPal Live credentials are not configured"},{status:503,headers:{"Cache-Control":"no-store"}});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!serviceKey)return NextResponse.json({error:"Supabase server configuration is missing"},{status:503,headers:{"Cache-Control":"no-store"}});
  const admin=createClient(url,serviceKey);
  const token=await getPayPalAccessToken();
  const{data:current,error:readError}=await admin.from("paypal_config").select("*").eq("singleton",true).maybeSingle();
  if(readError)throw readError;
  const saved=current?.environment===environment?current:{} as any;
  let productId=saved.product_id as string|undefined;
  if(!productId){
   const product=await paypalPost("/v1/catalogs/products",{name:"NAYROQ AI Workforce",description:"AI workforce subscriptions for businesses",type:"SERVICE",home_url:(process.env.NEXT_PUBLIC_APP_URL||"https://nayroq.finalarrow.com").replace(/\/$/,"")},"nayroq-live-product-v1",token);
   productId=product.id;
  }
  const planIds:Record<PaidPlanKey,string|undefined>={starter:saved.starter_plan_id,business:saved.business_plan_id,growth:saved.growth_plan_id};
  for(const plan of paidPlans){
   if(planIds[plan])continue;
   const created=await paypalPost("/v1/billing/plans",planBody(productId!,plan),`nayroq-live-${plan}-${PLANS[plan].price}-v1`,token);
   planIds[plan]=created.id;
  }
  let webhookId=saved.webhook_id as string|undefined;
  if(!webhookId){
   const webhookUrl=(process.env.NEXT_PUBLIC_APP_URL||"https://nayroq.finalarrow.com").replace(/\/$/,"")+"/api/paypal/webhook";
   const webhook=await paypalPost("/v1/notifications/webhooks",{url:webhookUrl,event_types:[{name:"BILLING.SUBSCRIPTION.ACTIVATED"},{name:"BILLING.SUBSCRIPTION.UPDATED"},{name:"BILLING.SUBSCRIPTION.SUSPENDED"},{name:"BILLING.SUBSCRIPTION.CANCELLED"},{name:"BILLING.SUBSCRIPTION.EXPIRED"},{name:"BILLING.SUBSCRIPTION.PAYMENT.FAILED"}]},"nayroq-live-webhook-v1",token);
   webhookId=webhook.id;
  }
  const{error}=await admin.from("paypal_config").upsert({singleton:true,environment,product_id:productId,starter_plan_id:planIds.starter,business_plan_id:planIds.business,growth_plan_id:planIds.growth,webhook_id:webhookId,updated_at:new Date().toISOString()},{onConflict:"singleton"});
  if(error)throw error;
  return NextResponse.json({ok:true,environment,productId,planIds,webhookId,prices:{starter:PLANS.starter.price,business:PLANS.business.price,growth:PLANS.growth.price}},{headers:{"Cache-Control":"no-store"}});
 }catch(e:any){
  console.error("Temporary PayPal Live bootstrap failed",e);
  return NextResponse.json({error:e?.message||"PayPal Live bootstrap failed"},{status:500,headers:{"Cache-Control":"no-store"}});
 }
}

export async function POST(req:Request){return bootstrap(req.headers.get("x-bootstrap-token"))}
export async function GET(req:Request){return bootstrap(new URL(req.url).searchParams.get("k"))}
