import type { Metadata } from "next";
import { DM_Sans, DM_Mono } from "next/font/google";
import { AuthProvider } from "@/features/auth/auth-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { Nav } from "@/components/layout/nav";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://app.wantan.online"),
  title: "stackd · student talent",
  description: "Build a bio. Skip the application. Companies find you and reach out directly.",
  openGraph: {
    title: "stackd · student talent",
    description: "Build a bio. Skip the application. Companies find you and reach out directly.",
    url: "https://app.wantan.online",
    siteName: "stackd",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "stackd · student talent",
    description: "Build a bio. Skip the application. Companies find you and reach out directly.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable}`}>
      <body>
        <QueryProvider>
          <AuthProvider>
            <Nav />
            {children}
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
