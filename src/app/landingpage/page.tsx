import type { Metadata } from "next";
import { LandingPage } from "./landing-client";

export const metadata: Metadata = {
  title: "Glint — a home for everything you save",
  description:
    "Glint is a personal space for the images, links, notes and tasks you don't want to lose. Paste something in, and it finds its place.",
};

export default function Page() {
  return <LandingPage />;
}
