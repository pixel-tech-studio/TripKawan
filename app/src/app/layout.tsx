import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import RealtimeRefresh from "@/components/RealtimeRefresh";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "TripKawan",
  description: "Plan trips together. Split expenses without stress.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TripKawan",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0ea5e9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${poppins.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-sand-50 text-foreground font-sans antialiased">
        <RealtimeRefresh />
        {children}
      </body>
    </html>
  );
}
