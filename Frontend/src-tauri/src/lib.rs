use tauri_plugin_shell::ShellExt;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                let resource_dir = app_handle.path().resource_dir()
                    .expect("Failed to get resource dir");
                let script_path = resource_dir.join("Backend").join("start-packaged.js");

                let (_rx, _child) = app_handle.shell().sidecar("node")
                    .expect("Failed to setup node sidecar")
                    .args([script_path.to_string_lossy().into_owned()])
                    .spawn()
                    .expect("Failed to spawn backend process");
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
