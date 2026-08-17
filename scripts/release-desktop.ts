/**
 * Builds the desktop app, signs it, and publishes it as the latest
 * auto-update — so "shipping a desktop update" is just running this one
 * script after `git commit`.
 *
 * What it does:
 *   1. Bumps `src-tauri/tauri.conf.json`'s version (patch bump, unless
 *      overridden) so the updater can tell this build apart from what
 *      everyone already has installed.
 *   2. Runs `tauri build`, which produces a signed `.app.tar.gz` (the
 *      updater's actual download) alongside the regular `.dmg` (for
 *      fresh installs on a machine that doesn't have the app yet).
 *   3. Uploads the `.tar.gz` + a `latest.json` manifest to Vercel Blob
 *      under `desktop-updates/` — the same Blob store the app already
 *      uses for saved images, so this needs no new infrastructure.
 *
 * Requires the signing private key to exist at ~/.tauri/glint-updater.key
 * (generated once via `tauri signer generate`) — DO NOT commit this file
 * or put its contents in git. If it's ever lost, a fresh keypair can be
 * generated, but everyone's installed app would need one final *manual*
 * DMG reinstall to pick up the new public key.
 *
 * Run via:
 *   npx dotenv -e .env.local -- npx tsx scripts/release-desktop.ts
 */
import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { put } from "@vercel/blob";

const ROOT = join(__dirname, "..");
const TAURI_CONF_PATH = join(ROOT, "src-tauri/tauri.conf.json");
const KEY_PATH = join(process.env.HOME ?? "", ".tauri/glint-updater.key");

function bumpPatchVersion(version: string): string {
  const parts = version.split(".").map(Number);
  parts[2] = (parts[2] ?? 0) + 1;
  return parts.join(".");
}

async function main() {
  if (!existsSync(KEY_PATH)) {
    throw new Error(
      `Signing key not found at ${KEY_PATH}. Generate one first with:\n` +
        `  npx tauri signer generate -w ${KEY_PATH}`,
    );
  }

  const conf = JSON.parse(readFileSync(TAURI_CONF_PATH, "utf-8"));
  const previousVersion = conf.version as string;
  const nextVersion = process.argv[2] ?? bumpPatchVersion(previousVersion);
  conf.version = nextVersion;
  writeFileSync(TAURI_CONF_PATH, JSON.stringify(conf, null, 2) + "\n");
  console.log(`Version: ${previousVersion} → ${nextVersion}`);

  console.log("Building (this takes a couple of minutes)...");
  execSync("npm run app:build", {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      TAURI_SIGNING_PRIVATE_KEY_PATH: KEY_PATH,
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "",
    },
  });

  const bundleDir = join(ROOT, "src-tauri/target/release/bundle/macos");
  const tarPath = join(bundleDir, "Glint.app.tar.gz");
  const sigPath = join(bundleDir, "Glint.app.tar.gz.sig");

  if (!existsSync(tarPath) || !existsSync(sigPath)) {
    throw new Error(
      `Expected updater artifacts not found in ${bundleDir}. Did the ` +
        `build actually run with createUpdaterArtifacts enabled?`,
    );
  }

  console.log("Uploading update artifact to Blob...");
  const tarBlob = await put(
    `desktop-updates/Glint_${nextVersion}_aarch64.app.tar.gz`,
    readFileSync(tarPath),
    { access: "public", addRandomSuffix: false, allowOverwrite: true },
  );
  const signature = readFileSync(sigPath, "utf-8").trim();

  const manifest = {
    version: nextVersion,
    notes: process.argv[3] ?? "See the app for what's new.",
    pub_date: new Date().toISOString(),
    platforms: {
      "darwin-aarch64": { signature, url: tarBlob.url },
    },
  };

  console.log("Publishing latest.json manifest...");
  await put("desktop-updates/latest.json", JSON.stringify(manifest, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });

  const dmgPath = join(
    ROOT,
    `src-tauri/target/release/bundle/dmg/Glint_${nextVersion}_aarch64.dmg`,
  );
  console.log("\nDone!");
  console.log(`  Update manifest live at: /api/updates/latest.json`);
  if (existsSync(dmgPath)) {
    console.log(`  Fresh-install DMG at: ${dmgPath}`);
  }
  console.log(
    `  Existing installs will pick this up next time they check for updates.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
