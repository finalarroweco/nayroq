import {PLANS,PlanKey} from "@/lib/plans";
export function subscriptionAllowsAI(company:any,conversationCount:number){
 const plan=PLANS[(company?.plan||"trial") as PlanKey]||PLANS.trial;
 if(company?.subscription_status==="trialing"&&company?.trial_ends_at&&new Date(company.trial_ends_at).getTime()<Date.now())return {ok:false,reason:"trial_expired",plan};
 if(company?.subscription_status&&!["trialing","active"].includes(company.subscription_status))return {ok:false,reason:"subscription_inactive",plan};
 if(conversationCount>=plan.conversations)return {ok:false,reason:"conversation_limit",plan};
 return {ok:true,reason:null,plan};
}