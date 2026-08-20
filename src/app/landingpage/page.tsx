import type { Metadata } from "next";
import { LandingPage } from "./landing-client";

const description =
  "Glint is a personal space for the images, links, notes and tasks you don't want to lose. Paste something in, and it finds its place.";

export const metadata: Metadata = {
  title: "Glint, a home for everything you save",
  description,
  openGraph: {
    title: "Glint",
    description,
    url: "/landingpage",
    siteName: "Glint",
    images: [{ url: "/landingpage/og-image.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Glint",
    description,
    images: ["/landingpage/og-image.png"],
  },
};

export default function Page() {
  return <LandingPage />;
}
