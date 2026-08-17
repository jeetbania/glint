"use client";

import { useCallback, useEffect } from "react";
import { createUISFX, type CueName, type UISFXPlayer } from "uisfx";

let sharedPlayer: UISFXPlayer | null = null;
let unlocked = false;

function getPlayer(): UISFXPlayer {
  if (!sharedPlayer) {
    sharedPlayer = createUISFX({
      // "minimal" is the dry, near-invisible pack — matches the app's
      // own restraint (no shine overlays, no loud motion) far better
      // than the punchier packs (arcade, cinematic, …).
      pack: "minimal",
      volume: 0.35,
      preferences: { key: "glint:sound" },
    });
  }
  return sharedPlayer;
}

/** Browsers require a trusted user gesture before any AudioContext can
 * actually produce sound — mounted once near the root, this unlocks on
 * the very first pointer/key interaction anywhere in the app so every
 * later `playSound()` call just works without every call site needing
 * to know about the unlock step. */
export function SoundUnlocker() {
  useEffect(() => {
    if (unlocked) return;
    function unlock() {
      if (unlocked) return;
      unlocked = true;
      void getPlayer().unlock();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    }
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
  return null;
}

/** Fire a semantic UI sound cue — subtle by design (see the "minimal"
 * pack + low volume above), used only on genuinely notable moments
 * (save, delete, open/close, toggle, tab switch), never on every hover
 * or keystroke. Safe to call before unlock/on the server: uisfx no-ops
 * silently until a real user gesture has unlocked audio. */
export function useSound() {
  const play = useCallback((cue: CueName) => {
    try {
      getPlayer().play(cue);
    } catch {
      // Audio is a nice-to-have — never let a synthesis/playback
      // failure interrupt the actual action it's soundtracking.
    }
  }, []);
  return play;
}

/** Same as useSound(), but as a plain function for non-component call
 * sites (event handlers built outside React) that can't call a hook. */
export function playSound(cue: CueName) {
  try {
    getPlayer().play(cue);
  } catch {
    // see useSound()
  }
}
