import type { Metadata, Viewport } from "next";
import { Nunito_Sans } from "next/font/google";
import "./globals.css";

const nunitoSans = Nunito_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Bay Branch Farm — Order",
    template: "%s · Bay Branch Farm",
  },
  description: "Weekly ordering for Bay Branch Farm wholesale customers.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={nunitoSans.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        {process.env.NODE_ENV === "development" && (
          <div className="fixed top-0 left-0 right-0 h-0.5 bg-red-500 z-[9999]" />
        )}
        {process.env.VERCEL_ENV === "preview" && (
          <div className="fixed top-0 left-0 right-0 h-0.5 bg-yellow-400 z-[9999]" />
        )}
        {children}
      </body>
    </html>
  );
}
