use tauri::Manager;

/// Emitted to the frontend whenever the system clipboard's content
/// changes to something new — the frontend (ClipboardWatchProvider)
/// decides whether to actually surface a "Save to Glint?" prompt (gated
/// behind the user's Settings > Capture toggle) and does the actual
/// upload/save, reusing the same ingest path as in-app paste capture.
#[derive(Clone, serde::Serialize)]
struct ClipboardCapture {
  kind: String, // "image" | "text"
  data: String, // base64 PNG data for images, raw string for text/links
}

/// Polls AppKit's general pasteboard directly (rather than via a
/// cross-platform crate like arboard) so the clipboard-watcher can reuse
/// objc2/objc2-app-kit — already-vendored transitive dependencies of
/// wry/tauri for window and menu handling — instead of pulling in new
/// ones. Runs for the whole app session; the frontend Settings toggle
/// only controls whether emitted events actually surface a prompt, not
/// whether this loop runs, so flipping the setting on takes effect
/// immediately with no restart needed.
#[cfg(target_os = "macos")]
mod clipboard_watch {
  use super::ClipboardCapture;
  use base64::{engine::general_purpose, Engine as _};
  use objc2_app_kit::{NSPasteboard, NSPasteboardTypePNG, NSPasteboardTypeString};
  use objc2_foundation::NSInteger;
  use tauri::Emitter;

  pub fn start(app_handle: tauri::AppHandle) {
    std::thread::spawn(move || {
      let mut last_change_count: NSInteger = NSInteger::MIN;

      loop {
        std::thread::sleep(std::time::Duration::from_millis(900));

        // SAFETY: NSPasteboard's general pasteboard is safe to read from
        // any thread — AppKit's pasteboard server itself handles the
        // cross-process/cross-thread synchronization, this isn't
        // mutating any UI state.
        let (change_count, capture) = unsafe {
          let pasteboard = NSPasteboard::generalPasteboard();
          let change_count = pasteboard.changeCount();
          if change_count == last_change_count {
            (change_count, None)
          } else if let Some(data) = pasteboard.dataForType(NSPasteboardTypePNG) {
            (
              change_count,
              Some(ClipboardCapture {
                kind: "image".into(),
                data: general_purpose::STANDARD.encode(data.to_vec()),
              }),
            )
          } else if let Some(text) = pasteboard.stringForType(NSPasteboardTypeString) {
            let trimmed = text.to_string().trim().to_string();
            if trimmed.is_empty() {
              (change_count, None)
            } else {
              (
                change_count,
                Some(ClipboardCapture {
                  kind: "text".into(),
                  data: trimmed,
                }),
              )
            }
          } else {
            (change_count, None)
          }
        };

        last_change_count = change_count;
        if let Some(capture) = capture {
          log::info!("clipboard-watch: detected {} ({} bytes)", capture.kind, capture.data.len());
          let _ = app_handle.emit("clipboard-changed", capture);
        }
      }
    });
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let window = app
        .get_webview_window("main")
        .expect("main window not found");

      // Real OS-level vibrancy — not a CSS approximation. The window is
      // transparent (see tauri.conf.json) so this material shows through
      // wherever the page itself doesn't paint a background; the app's
      // own glass panels then layer their own blur on top, matching how
      // native macOS apps (Mail, Notes) combine window vibrancy with
      // per-panel materials.
      #[cfg(target_os = "macos")]
      {
        window_vibrancy::apply_vibrancy(
          &window,
          window_vibrancy::NSVisualEffectMaterial::Sidebar,
          None,
          None,
        )
        .expect("apply_vibrancy failed — unsupported on this macOS version");
      }

      // Mica on Windows 11 (silently no-ops on unsupported Windows
      // versions rather than panicking, since this build isn't verified
      // on Windows yet).
      #[cfg(target_os = "windows")]
      {
        let _ = window_vibrancy::apply_mica(&window, None);
      }

      #[cfg(target_os = "macos")]
      clipboard_watch::start(app.handle().clone());

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
