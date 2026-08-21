"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { APP_VERSION, GITHUB_REPO } from "@/lib/version";

const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000; // don't hammer GitHub's API every single load
const LAST_CHECK_KEY = "glint:update-last-checked";
const DISMISSED_KEY = "glint:update-dismissed-version";

function parseVersion(v: string): number[] {
  return v
    .replace(/^v/, "")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
}

function isNewer(remote: string, local: string): boolean {
  const r = parseVersion(remote);
  const l = parseVersion(local);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rn = r[i] ?? 0;
    const ln = l[i] ?? 0;
    if (rn !== ln) return rn > ln;
  }
  return false;
}

/** Mounted once in the (app) layout. Checks GitHub's Releases API for a
 * newer tag than APP_VERSION and, if found, shows a dismissible toast
 * (bottom-right — Sonner's default position, unchanged from the rest of
 * the app's toasts) with a Download action, rather than blocking
 * anything — the app stays fully usable underneath it.
 *
 * This is the one deliberately-online thing a local-first, offline-first
 * app does: there's no other channel to tell someone running the
 * DOWNLOADED desktop app that a newer build exists (no auto-update
 * infrastructure, no push notifications) — a quiet check against a
 * public, unauthenticated GitHub endpoint once every few hours is the
 * simplest way to close that gap without adding a server of our own. A
 * failed check (offline, rate-limited, GitHub down) is silently
 * ignored — this is a nice-to-have nudge, never something the app
 * should surface an error for. */
export function UpdateChecker() {
  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const lastChecked = Number(localStorage.getItem(LAST_CHECK_KEY) || 0);
        if (Date.now() - lastChecked < CHECK_INTERVAL_MS) return;

        const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
          headers: { Accept: "application/vnd.github+json" },
        });
        localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
        if (!res.ok || cancelled) return;

        const data = await res.json();
        const tag: string | null = typeof data.tag_name === "string" ? data.tag_name : null;
        if (!tag || cancelled) return;
        if (!isNewer(tag, APP_VERSION)) return;

        const dismissed = localStorage.getItem(DISMISSED_KEY);
        if (dismissed === tag) return; // already told about THIS version — don't nag every session

        const releaseUrl: string =
          typeof data.html_url === "string" ? data.html_url : `https://github.com/${GITHUB_REPO}/releases/latest`;
        const version = tag.replace(/^v/, "");

        toast(`Glint ${version} is available`, {
          description: `You're on ${APP_VERSION}.`,
          duration: Infinity,
          action: {
            label: "Download",
            onClick: () => window.open(releaseUrl, "_blank", "noopener,noreferrer"),
          },
          cancel: {
            label: "Dismiss",
            onClick: () => {
              try {
                localStorage.setItem(DISMISSED_KEY, tag);
              } catch {
                // Nothing to fall back to — worst case it asks again next time.
              }
            },
          },
        });
      } catch {
        // Offline, GitHub unreachable, rate-limited — see comment above.
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
