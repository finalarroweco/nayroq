"use client";

import{useEffect}from"react";
import{usePathname}from"next/navigation";
import{trackPageView}from"@/lib/client-analytics";

export default function SiteAnalytics(){
 const pathname=usePathname();
 useEffect(()=>{trackPageView(pathname||location.pathname)},[pathname]);
 return null;
}
