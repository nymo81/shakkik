import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700", "900"],
});

export const metadata: Metadata = {
  title: "شكّك | SHAKKIK — شكّك بكلشي",
  description: "لعبة الخداع الاجتماعي والأسئلة السرية باللهجة العراقية مع شخصيات ذكاء اصطناعي",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body
        className={`${cairo.className} bg-[#120D1D] text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950 min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
