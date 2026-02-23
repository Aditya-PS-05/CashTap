import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth-context";
import { PriceProvider } from "@/lib/price-context";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CashTap — Bitcoin Cash Payment Rails",
  description: "Accept Bitcoin Cash payments with mobile POS, payment links, invoices, and CashToken loyalty rewards.",
  openGraph: {
    title: "CashTap — Bitcoin Cash Payment Rails",
    description: "Accept Bitcoin Cash payments with mobile POS, payment links, invoices, and CashToken loyalty rewards.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <PriceProvider>
            {children}
          </PriceProvider>
        </AuthProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
