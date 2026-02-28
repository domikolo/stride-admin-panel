import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import ToastProvider from "@/components/ui/toast-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Stride Admin Panel",
  description: "Admin panel for Stride Services SaaS platform",
  icons: {
    icon: [
      { url: '/favicon-biale.png', media: '(prefers-color-scheme: dark)' },
      { url: '/favicon-czarne.png', media: '(prefers-color-scheme: light)' },
    ],
  },
};

// Force dynamic rendering to prevent Cognito initialization during build
export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading x-nonce here causes Next.js to attach the nonce to its own
  // inline <script> tags during SSR, enabling nonce-based CSP without 'unsafe-inline'.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _nonce = (await headers()).get("x-nonce");

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
