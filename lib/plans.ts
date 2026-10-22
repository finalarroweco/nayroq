export const PLANS={
 trial:{name:"Free Trial",price:0,currency:"USD",employees:1,conversations:100},
 starter:{name:"Starter",price:39,currency:"USD",employees:1,conversations:1500},
 business:{name:"Business",price:69,currency:"USD",employees:3,conversations:5000},
 growth:{name:"Growth",price:99,currency:"USD",employees:999,conversations:15000}
} as const;
export type PlanKey=keyof typeof PLANS;
export type PaidPlanKey=Exclude<PlanKey,"trial">;
