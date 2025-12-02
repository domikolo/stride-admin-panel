import type { Metadata } from "next";
import { Inter, Syne, Outfit, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const syne = Syne({ subsets: ["latin"], variable: "--font-syne" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });

export const metadata: Metadata = {
  title: "Stride Services - AI Chatbots",
  description: "Nowoczesne chatboty AI dla Twojego biznesu",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className={`scroll-smooth antialiased ${inter.variable} ${syne.variable} ${outfit.variable} ${spaceGrotesk.variable}`}>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
