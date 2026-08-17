use tauri::Manager;

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

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
