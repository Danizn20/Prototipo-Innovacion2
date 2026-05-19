use std::fs;
use std::path::{Path, PathBuf};

fn find_resource_file(start: &Path, file_name: &str) -> Option<PathBuf> {
  if !start.exists() {
    return None;
  }

  let mut stack = vec![start.to_path_buf()];
  while let Some(dir) = stack.pop() {
    if let Ok(entries) = fs::read_dir(&dir) {
      for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
          stack.push(path);
        } else if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
          if name == file_name {
            return Some(path);
          }
        }
      }
    }
  }

  None
}

fn copy_bundled_db_to_persist() {
  // resource_dir points to where Tauri places bundled resources at runtime
  if let Some(resource_dir) = tauri::api::path::resource_dir() {
    if let Some(src_db) = find_resource_file(&resource_dir, "app.db") {
      // choose app data dir for persistence
      if let Some(mut app_dir) = tauri::api::path::app_data_dir() {
        app_dir.push("PrototipoInnovacion");
        if !app_dir.exists() {
          let _ = fs::create_dir_all(&app_dir);
        }
        let target_db = app_dir.join("app.db");
        if !target_db.exists() {
          if let Err(e) = fs::copy(&src_db, &target_db) {
            eprintln!("Failed to copy bundled DB: {}", e);
          } else {
            println!("Copied bundled app.db to {}", target_db.display());
          }
        }
      }
    }
  }
}

fn main() {
  // attempt to ensure a persistent DB is available for the packaged app
  copy_bundled_db_to_persist();

  tauri::Builder::default()
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
