import type { Metadata } from "next";import "./globals.css";
export const metadata:Metadata={title:"NAYROQ — Your AI Workforce",description:"Hire AI employees that sell, support, book and follow up 24/7."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}