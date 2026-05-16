import type { Metadata } from "next";
import { DM_Sans, DM_Mono } from "next/font/google";
import { StudentsProvider } from "@/components/providers/students-provider";
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
  title: "stackd · student talent",
  description: "Students putting themselves on the map. Browse, find, reach out directly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable}`}>
      <body>
        <StudentsProvider>
          <Nav />
          {children}
        </StudentsProvider>
      </body>
    </html>
  );
}
