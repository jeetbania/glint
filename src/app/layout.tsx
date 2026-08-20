import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { DesktopShellAdjustments } from "@/components/desktop-shell-adjustments";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  // Lets every page's relative OG/Twitter image paths (e.g. the landing
  // page's /landingpage/og-image.png) resolve to a real absolute URL —
  // required for link-preview cards (iMessage, Slack, X, ...) to
  // actually find the image; without this Next.js can't turn a
  // relative path into something an external crawler can fetch.
  metadataBase: new URL("https://glint-jeetbania.vercel.app"),
  title: "Glint",
  description: "A personal visual bookmarking space for images, links, and notes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrumentSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <DesktopShellAdjustments />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
