use tauri::api::process::{Command, CommandEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      let handle = app.handle();
      tauri::async_runtime::spawn(async move {
        let (mut rx, _child) = Command::new_sidecar("node")
          .expect("failed to create `node` sidecar command")
          .spawn()
          .expect("Failed to spawn sidecar");

        while let Some(event) = rx.recv().await {
          match event {
            CommandEvent::Stdout(line) => {
              log::info!("[BACKEND] {}", line);
            }
            CommandEvent::Stderr(line) => {
              log::error!("[BACKEND] {}", line);
            }
            _ => {}
          }
        }
      });

      if cfg!(debug_assertions) {
        handle.plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
