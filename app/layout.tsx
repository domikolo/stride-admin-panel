import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import ToastProvider from "@/components/ui/toast-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Stride Admin Panel",
  description: "Admin panel for Stride Services SaaS platform",
};

// Force dynamic rendering to prevent Cognito initialization during build
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <AuthProvider>
          <TooltipProvider>
            <ToastProvider />
            {children}
          </TooltipProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
