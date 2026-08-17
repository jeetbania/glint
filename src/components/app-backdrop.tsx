/** Fixed, non-interactive ambient background: faint dot-grain texture plus
 * a few softly blurred gradient blobs in the corners — the same liquid,
 * slightly-alive backdrop as jeetcreates.cc, dialed down so it never
 * competes with a content-dense app. */
export function AppBackdrop() {
  return (
    <div className="app-backdrop" aria-hidden="true">
      <div
        className="app-backdrop-blob gradient-lavender"
        style={{ width: 420, height: 420, top: -140, left: -120 }}
      />
      <div
        className="app-backdrop-blob gradient-mint"
        style={{ width: 380, height: 380, top: -100, right: -140 }}
      />
      <div
        className="app-backdrop-blob gradient-peach"
        style={{ width: 320, height: 320, bottom: -160, left: "35%" }}
      />
    </div>
  );
}
