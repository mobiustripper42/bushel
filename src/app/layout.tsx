import type { Metadata, Viewport } from "next";
import { Source_Sans_3, Playfair_Display, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "@/styles/app.css";

const sourceSans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "600"],
});

const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
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
    <html
      lang="en"
      className={`${sourceSans.variable} ${playfair.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
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
