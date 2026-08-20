"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { ArrowRight, Apple, MonitorSmartphone, Globe, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppMockup } from "./app-mockup";
import { FeatureBento } from "./feature-bento";

// Real profile links, pulled from the user's own portfolio site
// (jeetcreates.cc) rather than guessed. lucide-react doesn't ship brand
// glyphs (X/Instagram were dropped from the icon set), so these two are
// small hand-drawn marks matching lucide's own stroke conventions;
// Globe (an actual lucide icon) stands in for "portfolio."
const SOCIALS = [
  { label: "X", href: "https://x.com/figmajeet", Icon: XIcon },
  { label: "Instagram", href: "https://instagram.com/jeetbania", Icon: InstagramIcon },
  { label: "Portfolio", href: "https://jeetcreates.cc", Icon: Globe },
];

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.9 2.6h3.1l-6.8 7.8L23.2 21.4h-6.3l-4.9-6.4-5.6 6.4H3.2l7.3-8.3L2.8 2.6h6.4l4.4 5.8ZM17.8 19.5h1.7L8.3 4.4H6.5Z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Uploaded straight to Vercel Blob (release/Glint-0.1.0-arm64.dmg), not a
// GitHub release, at the user's call: source stays private for now, this
// is just a real, working download today. ?download=1 makes Blob send
// Content-Disposition: attachment, so the browser saves it instead of
// trying to open it inline.
const MAC_DOWNLOAD_URL =
  "https://wx1ppcub8lalgvoj.public.blob.vercel-storage.com/downloads/Glint-0.1.0-arm64.dmg?download=1";

const STEPS = [
  {
    title: "Save something",
    body: "Paste an image, drop in a link, or jot down a note. Takes a second.",
  },
  {
    title: "It finds its place",
    body: "Glint reads colors, pulls previews, and quietly sorts things into folders you set up once.",
  },
  {
    title: "Find it again in seconds",
    body: "Search, filter by color, or just scroll. It's all still exactly where you left it.",
  },
];

const FAQS = [
  {
    q: "Is Glint free?",
    a: "Yes. Glint is free while it's in beta. If that ever changes, nothing you've already saved goes away.",
  },
  {
    q: "What can I save in it?",
    a: "Images, links, notes, and tasks. Paste, drop, or type something in and Glint takes it from there.",
  },
  {
    q: "Which platforms does it run on?",
    a: "There's a Mac app available now, with Windows on the way. It also works as a regular website, so you can use it in any browser in the meantime.",
  },
  {
    q: "Can other people see what I save?",
    a: "No. Glint is a personal space. What you save is only ever visible to you.",
  },
];

function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function LandingPage() {
  const { theme, setTheme } = useTheme();

  // Opens in light mode every time, regardless of system preference or
  // whatever theme was last set in the real app, but a real toggle click
  // (in the hero mockup's header) still flips the *whole* page dark —
  // this uses the same next-themes context as everywhere else, not a
  // locked/forced theme, so it can't just be set once as a default.
  // Restoring the visitor's actual previous theme on unmount means
  // clicking through to /library doesn't leave them stuck on whatever
  // this page forced, in either direction.
  useEffect(() => {
    const previous = theme;
    setTheme("light");
    return () => {
      if (previous) setTheme(previous);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Smooth scrolling, scoped to this page only — the app-wide version
  // (Lenis) was deliberately removed for feeling like scroll-jacking,
  // but a plain CSS scroll-behavior here only affects anchor jumps
  // (the "Get started" button, in-page links), not wheel/trackpad
  // scrolling itself, so it doesn't reintroduce that. Reset on unmount
  // so it doesn't leak into the rest of the app.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "smooth";
    // Tells Next's own router this is intentional, so it doesn't force
    // an instant jump-scroll on route transitions to fight it — see
    // https://nextjs.org/docs/messages/missing-data-scroll-behavior
    root.setAttribute("data-scroll-behavior", "smooth");
    return () => {
      root.style.scrollBehavior = previous;
      root.removeAttribute("data-scroll-behavior");
    };
  }, []);

  return (
    <div className="relative overflow-x-clip">
      {/* Subtle top-of-page gradient glow — the one spot on the whole
          page that gets to be colorful, echoing the reference site's
          rainbow smear above its headline. Everything below stays flat
          and monochrome, per the app's own design language. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] opacity-[0.35] blur-3xl dark:opacity-[0.18]"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, #3b5bdb 0%, #a855f7 35%, #f97316 60%, transparent 75%)",
        }}
      />

      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-6">
        <Link href="/landingpage" className="flex items-center gap-2 font-heading text-base font-semibold tracking-heading">
          <Image src="/logo.png" alt="" width={26} height={26} className="rounded-[7px]" />
          Glint
        </Link>
        <Button variant="outline" size="sm" render={<Link href="/library" />}>
          Open app
        </Button>
      </nav>

      {/* Hero */}
      <section className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 pb-10 pt-14 text-center sm:pt-20">
        <motion.span
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-pill mb-6 inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium text-muted-foreground"
        >
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
          </span>
          Glint is in beta
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="text-balance font-heading text-4xl font-semibold tracking-heading sm:text-6xl"
        >
          Save what catches your eye
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-5 max-w-xl text-balance text-base text-muted-foreground sm:text-lg"
        >
          Glint is a personal space for the images, links, notes, and ideas you
          do not want to lose. Paste something in, and let it find its place.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-8"
        >
          <Button
            size="lg"
            className="px-5"
            onClick={() =>
              document.getElementById("download")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Get started
            <ArrowRight className="size-4" data-icon="inline-end" />
          </Button>
        </motion.div>
      </section>

      {/* Working app mockup */}
      <FadeIn className="mx-auto w-full max-w-5xl px-4">
        <AppMockup />
      </FadeIn>

      <FeatureBento />

      {/* How it works */}
      <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-16">
        <FadeIn className="mb-10 text-center">
          <h2 className="font-heading text-2xl font-semibold tracking-heading sm:text-3xl">
            How Glint works
          </h2>
        </FadeIn>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-6">
          {STEPS.map((step, i) => (
            <FadeIn key={step.title} delay={i * 0.08} className="text-center sm:text-left">
              <span className="mb-3 inline-flex size-7 items-center justify-center rounded-full border border-border/70 text-sm font-medium text-muted-foreground">
                {i + 1}
              </span>
              <h3 className="font-heading text-base font-semibold tracking-heading">
                {step.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
        <FadeIn className="mb-8 text-center">
          <h2 className="font-heading text-2xl font-semibold tracking-heading sm:text-3xl">
            Questions
          </h2>
        </FadeIn>
        <FadeIn className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60">
          {FAQS.map((item) => (
            <details key={item.q} className="group p-4 sm:p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium marker:content-none">
                {item.q}
                <span className="shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45">
                  <ArrowRight className="size-4 -rotate-45" />
                </span>
              </summary>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </FadeIn>
      </section>

      {/* Final CTA / download */}
      <section id="download" className="mx-auto w-full max-w-3xl px-4 py-10 text-center sm:py-16">
        <FadeIn>
          <h2 className="font-heading text-3xl font-semibold tracking-heading sm:text-4xl">
            Ready to give Glint a try?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-balance text-muted-foreground">
            Free while it is in beta. Grab the Mac app, or keep using Glint
            straight from your browser.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" className="w-full px-5 sm:w-auto" render={<a href={MAC_DOWNLOAD_URL} />}>
              <Apple className="size-4" />
              Download for Mac
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full px-5 sm:w-auto"
              onClick={() =>
                toast("Windows build is coming soon", {
                  description: "The Mac app is ready to go right now.",
                })
              }
            >
              <MonitorSmartphone className="size-4" />
              Download for Windows
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            macOS 12 or later, Apple Silicon. Windows support is on the way.
          </p>
        </FadeIn>
      </section>

      {/* Footer */}
      <footer className="mx-auto w-full max-w-5xl px-4 pb-4 pt-16 sm:pb-6">
        <div className="flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-6 text-sm text-muted-foreground sm:flex-row">
          <span className="flex items-center gap-1.5">
            Made with
            <Heart className="size-3.5 fill-current text-destructive" />
          </span>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
            <span className="h-4 w-px bg-border/60" aria-hidden />
            <Link href="/library" className="hover:text-foreground">
              Open the app
            </Link>
          </div>
        </div>

        {/* Full, solid brand mark — sized in vw so it scales with the
            viewport, then capped so it never outgrows the max-w-5xl
            container it sits in once the viewport is wider than that. */}
        <div
          aria-hidden
          className="mt-2 flex select-none items-center justify-center gap-[2vw] text-foreground"
        >
          <Image
            src="/logo.png"
            alt=""
            width={512}
            height={512}
            className="w-[17vw] max-w-[11rem] shrink-0 rounded-[22%] sm:w-[11vw]"
          />
          <span
            className="text-center font-heading leading-none font-semibold tracking-heading"
            style={{ fontSize: "clamp(5rem, 20vw, 18rem)" }}
          >
            Glint
          </span>
        </div>
      </footer>
    </div>
  );
}
