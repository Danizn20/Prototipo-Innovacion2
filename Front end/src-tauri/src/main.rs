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

fn copy_bundled_db_to_persist(app_handle: &tauri::AppHandle) {
  if let Some(resource_dir) = app_handle.path_resolver().resource_dir() {
    if let Some(src_db) = find_resource_file(&resource_dir, "app.db") {
      if let Some(mut app_dir) = app_handle.path_resolver().app_data_dir() {
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

fn try_spawn_bundled_node_runner(app_handle: &tauri::AppHandle) {
  if let Some(resource_dir) = app_handle.path_resolver().resource_dir() {
    // find node binary (windows: node.exe, unix: node)
    let node_candidate = find_resource_file(&resource_dir, "node.exe")
      .or_else(|| find_resource_file(&resource_dir, "node"));

    // find packaged start script
    let start_script = find_resource_file(&resource_dir, "start-packaged.js");

    if let (Some(node_path), Some(start_path)) = (node_candidate, start_script) {
      println!("Found bundled node: {}", node_path.display());
      println!("Found start script: {}", start_path.display());

      // determine persistent app dir to pass to the script
      let mut persist_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .unwrap_or_else(|| PathBuf::from("."));
      persist_dir.push("PrototipoInnovacion");

      // spawn node start-packaged.js
      match std::process::Command::new(node_path)
        .arg(start_path)
        .env("PROTOTIPO_DATA_DIR", persist_dir.as_os_str())
        .env("PROTOTIPO_UPLOADS_DIR", persist_dir.join("uploads"))
        .spawn()
      {
        Ok(child) => {
          println!("Spawned bundled node runner (pid={})", child.id());
        }
        Err(e) => {
          eprintln!("Failed to spawn bundled node runner: {}", e);
        }
      }
    }
  }
}

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      let handle = app.handle();
      copy_bundled_db_to_persist(&handle);
      try_spawn_bundled_node_runner(&handle);
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
