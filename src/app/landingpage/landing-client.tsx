"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { ArrowRight, Check, Globe, Heart, MousePointerClick, Puzzle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppMockup } from "./app-mockup";
import { FeatureBento, SCATTER_IMAGES, TINTS } from "./feature-bento";

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

// The user's own logo files (Downloads/apple-logo.svg,
// Downloads/windows-icon.svg), inlined here rather than served from
// /public so `fill="black"` can become `currentColor` — the download
// buttons need the Mac one to read white-on-blue and the Windows one
// to follow the outline button's normal text color, in both themes.
function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M34.1 40.56C32.14 42.46 30 42.16 27.94 41.26C25.76 40.34 23.76 40.3 21.46 41.26C18.58 42.5 17.06 42.14 15.34 40.56C5.57996 30.5 7.01996 15.18 18.1 14.62C20.8 14.76 22.68 16.1 24.26 16.22C26.62 15.74 28.88 14.36 31.4 14.54C34.42 14.78 36.7 15.98 38.2 18.14C31.96 21.88 33.44 30.1 39.16 32.4C38.02 35.4 36.54 38.38 34.08 40.58L34.1 40.56ZM24.06 14.5C23.76 10.04 27.38 6.36 31.54 6C32.12 11.16 26.86 15 24.06 14.5Z"
      />
    </svg>
  );
}

function WindowsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <path
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={3.833}
        strokeLinejoin="round"
        d="M6.75 11.063L19.688 9.338V21.413H6.75V11.063ZM24.862 8.845L41.25 6.75V21.413H24.862V8.845ZM24.862 27.45L41.25 27.833V41.25L24.862 38.567V27.45ZM6.75 26.588L19.688 26.899V37.8L6.75 35.62V26.588Z"
      />
    </svg>
  );
}

// GitHub Releases, not Vercel Blob: the repo went public specifically so
// installers could live here instead of eating Blob storage. The asset
// filenames are fixed (no version number baked in — see package.json's
// `build.mac.artifactName`/`build.win.artifactName`), so
// /releases/latest/download/<file> always resolves to whatever the newest
// published release contains — this URL never needs to change again as
// the app gets updated.
const MAC_DOWNLOAD_URL =
  "https://github.com/jeetbania/glint/releases/latest/download/Glint-mac.dmg";
const WINDOWS_DOWNLOAD_URL =
  "https://github.com/jeetbania/glint/releases/latest/download/Glint-Setup.exe";

// Same pattern as the Mac DMG: the extension isn't on the Chrome Web
// Store (that review process is its own separate effort), so this is
// the actual browser-extension/ folder from the repo, zipped and
// uploaded straight to Blob — a real, working download today rather
// than a placeholder.
const EXTENSION_DOWNLOAD_URL =
  "https://wx1ppcub8lalgvoj.public.blob.vercel-storage.com/downloads/Glint-browser-extension.zip?download=1";

const EXTENSION_FEATURES = [
  { icon: MousePointerClick, text: "Click the toolbar icon to save the tab you're on" },
  { icon: Puzzle, text: "Right-click any page, image, or link and save it directly" },
  { icon: Check, text: "A quiet notification confirms the save, no tab-switching" },
];

const PANEL_SHADOW = "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_10px_-6px_rgba(0,0,0,0.08)]";

const STEPS = [
  {
    title: "Save something",
    body: "Paste an image, drop in a link, or jot down a note. Takes a second.",
    tint: "sky" as const,
    scene: (
      <div className={`relative flex w-40 items-center gap-2.5 rounded-xl border border-border/60 bg-card p-2.5 ${PANEL_SHADOW}`}>
        <div className="relative size-8 shrink-0 overflow-hidden rounded-lg">
          <Image src={SCATTER_IMAGES[0]} alt="" fill className="object-cover" sizes="32px" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="truncate text-xs font-medium">moodboard.png</p>
          <div className="relative h-1 w-full overflow-hidden rounded-full bg-foreground/10">
            <div className="h-full w-2/3 rounded-full bg-primary" />
          </div>
        </div>
        <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-2.5" />
        </span>
      </div>
    ),
  },
  {
    title: "It finds its place",
    body: "Glint reads colors, pulls previews, and quietly sorts things into folders you set up once.",
    tint: "lavender" as const,
    scene: (
      <div className="flex items-center gap-2.5">
        <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-border/60">
          <Image src={SCATTER_IMAGES[1]} alt="" fill className="object-cover" sizes="40px" />
          <span className="absolute left-1 top-1 size-2 rounded-full border border-white/80 bg-primary" />
        </div>
        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
        <div className={`w-12 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-card ${PANEL_SHADOW}`}>
          <div className="h-1.5 w-full bg-primary/70" />
          <div className="space-y-1 p-1.5">
            <div className="h-1 w-full rounded-full bg-foreground/15" />
            <div className="h-1 w-2/3 rounded-full bg-foreground/15" />
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Find it again in seconds",
    body: "Search, filter by color, or just scroll. It's all still exactly where you left it.",
    tint: "mint" as const,
    scene: (
      <div className="w-40 space-y-1.5">
        <div className={`flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-2.5 py-1.5 ${PANEL_SHADOW}`}>
          <Search className="size-3 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">moodboard</span>
        </div>
        <div className={`space-y-1 rounded-lg border border-border/60 bg-card p-1.5 ${PANEL_SHADOW}`}>
          <div className="flex items-center gap-1.5 rounded-md px-1 py-0.5">
            <span className="size-4 shrink-0 rounded-md bg-primary" />
            <span className="min-w-0 flex-1 truncate text-[11px] font-medium">moodboard.png</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md px-1 py-0.5">
            <span className="size-4 shrink-0 rounded-md bg-foreground/15" />
            <span className="min-w-0 flex-1 truncate text-[11px] font-medium">Moodboard notes</span>
          </div>
        </div>
      </div>
    ),
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
  // Theme just follows next-themes normally here — same system-or-
  // last-chosen default as the rest of the app, no page-specific
  // override. An earlier version forced this page to always open
  // light; now that dark mode looks right here too, there's no reason
  // for the landing page to disagree with the real app about which
  // theme the visitor wants.

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
    <div className="landing-page relative overflow-x-clip">
      {/* Subtle top-of-page gradient glow — the one spot on the whole
          page that gets to be colorful, echoing the reference site's
          rainbow smear above its headline. Everything below stays flat
          and monochrome, per the app's own design language. */}
      {/* Two separate gradients, not one shared gradient with a
          dark:opacity-* override — the same multi-hue gradient just
          dimmed down read as a muddy red/brown in dark mode instead of
          "the same vibrant blue," because the lower band of the
          gradient (where the "Get started" button sits) is the
          orange/transparent tail, and orange at low opacity over
          near-black desaturates toward brown-red rather than reading
          as orange. The dark-mode version is blue/indigo end to end
          instead, so there's no orange band to shift color at all. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] opacity-[0.35] blur-3xl dark:hidden"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, #3b5bdb 0%, #a855f7 35%, #f97316 60%, transparent 75%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 hidden h-[420px] opacity-[0.28] blur-3xl dark:block"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, #7c93f2 0%, #3b5bdb 45%, #3b5bdb 70%, transparent 85%)",
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
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            From a quick paste to finding it again, it only takes three steps.
          </p>
        </FadeIn>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
          className="relative overflow-hidden rounded-2xl border border-border/60 sm:grid sm:grid-cols-3 sm:divide-x sm:divide-border/60"
        >
          <span aria-hidden className="absolute left-4 top-3 text-sm text-muted-foreground/40 select-none">
            +
          </span>
          <span aria-hidden className="absolute right-4 top-3 text-sm text-muted-foreground/40 select-none">
            +
          </span>

          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-4 p-4 sm:p-5"
            >
              <div
                style={{ background: TINTS[step.tint] }}
                className="relative flex h-40 items-center justify-center overflow-hidden rounded-xl"
              >
                {step.scene}
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground">Step {i + 1}</span>
                <h3 className="font-heading text-base font-semibold tracking-heading">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
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

      {/* Browser extension */}
      <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-16">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <FadeIn>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Browser extension
            </span>
            <h2 className="mt-2 font-heading text-2xl font-semibold tracking-heading sm:text-3xl">
              Save from anywhere you browse
            </h2>
            <p className="mt-3 text-muted-foreground">
              Install the Glint extension for Chrome and save straight from
              whatever page is open, no copying links back and forth.
            </p>
            <ul className="mt-5 space-y-3">
              {EXTENSION_FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15">
                    <Icon className="size-3 text-primary" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button render={<a href={EXTENSION_DOWNLOAD_URL} />}>
                <Puzzle className="size-4" />
                Download extension
              </Button>
              <span className="text-xs text-muted-foreground">
                For Chrome. Unzip it, then load it unpacked, about 30 seconds.
              </span>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            {/* The extension's own context menu, mid-save — wrapped in
                the same little-browser-window chrome as the hero mockup
                (traffic lights, rounded card) so a plain screenshot
                reads as "this is what it looks like in your browser"
                instead of a loose, borderless image. */}
            <div className="glass-panel overflow-hidden rounded-2xl p-2">
              <div className="flex items-center gap-1.5 px-2 pb-2 pt-1">
                <span className="size-2.5 rounded-full bg-[#ff5f57]/70" />
                <span className="size-2.5 rounded-full bg-[#febc2e]/70" />
                <span className="size-2.5 rounded-full bg-[#28c840]/70" />
              </div>
              <div className="relative aspect-[698/514] w-full overflow-hidden rounded-xl border border-border/60">
                <Image
                  src="/landingpage/extension-context-menu.png"
                  alt="The Glint browser extension's right-click menu, with “Save link to Glint” highlighted"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 90vw, 500px"
                />
              </div>
            </div>
          </FadeIn>
        </div>
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
            <Button
              size="lg"
              className="w-full gap-0.5 px-5 sm:w-auto"
              render={<a href={MAC_DOWNLOAD_URL} />}
            >
              <AppleIcon className="size-5" />
              Download for Mac
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full gap-0.5 px-5 sm:w-auto"
              render={<a href={WINDOWS_DOWNLOAD_URL} />}
            >
              <WindowsIcon className="size-5" />
              Download for Windows
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            macOS 12+ (Apple Silicon) and Windows 10/11 (x64 or ARM).
          </p>
        </FadeIn>
      </section>

      {/* Footer */}
      <footer className="mx-auto w-full max-w-5xl px-4 pb-4 pt-16 [container-type:inline-size] sm:pb-6">
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

        {/* Full, solid brand mark — sized in container-query width
            (cqw), not viewport width (vw). vw sizing can't know about
            the max-w-5xl cap this footer itself has, so past ~1440px
            viewport the text kept growing (or sat capped at a guessed
            rem value) independently of how wide the actual container
            was, and the two drifted apart. cqw is relative to this
            <footer>'s own content width (marked
            [container-type:inline-size] above), which already IS
            capped at max-w-5xl — so the text is mathematically tied to
            the real container edge at every viewport, matching the
            "Made with / Open the app" row above it exactly, instead of
            a hand-tuned guess. Faded to gray (opacity + grayscale)
            rather than full brand color — a quiet closing mark, not a
            second logo competing for attention. The logo's height is
            set in `em` off the same fontSize as the wordmark, so it
            tracks the text's actual glyph height instead of scaling
            independently. */}
        <div
          aria-hidden
          className="mt-2 flex select-none items-center justify-center gap-[1.5cqw] text-foreground opacity-15 grayscale"
          style={{ fontSize: "clamp(4rem, 32cqw, 24rem)" }}
        >
          <Image
            src="/logo.png"
            alt=""
            width={512}
            height={512}
            draggable={false}
            className="shrink-0 rounded-[22%]"
            style={{ width: "0.72em", height: "0.72em" }}
          />
          <span className="text-center font-heading leading-none font-semibold tracking-heading">
            Glint
          </span>
        </div>
      </footer>
    </div>
  );
}
