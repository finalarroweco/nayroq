import{NextResponse}from"next/server";import{getPayPalConfig}from"@/lib/paypal";
export const runtime="nodejs";
export async function GET(){const config=await getPayPalConfig();const clientId=process.env.PAYPAL_CLIENT_ID||process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID||"";return NextResponse.json({configured:Boolean(clientId&&config.planIds.starter&&config.planIds.business&&config.planIds.growth),environment:config.environment,clientId,planIds:config.planIds,currency:"USD"},{headers:{"Cache-Control":"no-store"}})}
