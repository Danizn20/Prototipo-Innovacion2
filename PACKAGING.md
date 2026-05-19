Packaging notes — Prototipo-Innovacion2

Goal
- Create a single installer (Windows .exe) that installs the app and ensures the local SQLite-based database (sql.js exported file `app.db`) is included and persists across runs.

What is already present
- Front end web app in `Front end/` with a `src-tauri/` folder (Tauri configuration present).
- Backend Node API in `Backend/` that uses `sql.js` and persists the database to `Backend/data/app.db`.
- `Backend/data/app.db` exists in the repository and will be included as a resource if configured.

Key requirements to satisfy
1. The packaged app must include an initial `app.db` so the app starts with seeded data.
2. At runtime, the application must write to a writable location so changes persist between runs.
3. The packaged app should expose or set an environment variable so the backend uses the persistent location.

What I changed
- Added `Front end/src-tauri/tauri.conf.json` bundle resources entry to include `../Backend/data/app.db` and `../Backend/uploads` in the packaged bundle.
- Updated `Backend/src/db.js` to allow overriding the data and uploads directories using the environment variables `PROTOTIPO_DATA_DIR` and `PROTOTIPO_UPLOADS_DIR`. If these are not set it falls back to `Backend/data` and `Backend/uploads` respectively.

Recommended packaging flow (manual steps)
1. Build the frontend assets

```bash
cd "Front end"
npm install
npm run build
```

2. Prepare the backend (install dependencies)

```bash
cd ../Backend
npm install
```

3. Build the Tauri application (requires Rust + Tauri prerequisites)

- Install Rust and the required toolchain: https://www.rust-lang.org/tools/install
- Install the `tauri-cli` if needed, or use the cargo-based commands.

From the `Front end` folder, run:

```bash
# from Front end
# this will run the `beforeBuildCommand` and then build the tauri app
# requires `cargo` available in PATH
npm run build
cd src-tauri
cargo build --release
# or use a wrapper if configured: npm run tauri:build
```

4. Ensure the packaged app sets a writable persistent folder for runtime data.

- On Windows, a good location is `%APPDATA%/PrototipoInnovacion`.
- When launching the backend process in the packaged environment, set `PROTOTIPO_DATA_DIR` to that path.

Example: when the packaged launcher starts the Node backend, it should call the backend with the environment variable set:

```powershell
$persist = "$env:APPDATA\PrototipoInnovacion"
# ensure folder exists
mkdir $persist -Force
# run backend (example)
$env:PROTOTIPO_DATA_DIR = $persist
node Backend/src/server.js
```

Notes about Tauri: if you intend to run a Node backend inside the Tauri bundle, you must include Node and manage its execution yourself. Alternatively you can port the backend logic into the Tauri (Rust) side or spawn a separate process shipped alongside the app.

Testing the bundled DB persistence
- On first run, copy the bundled `app.db` from resources into the persistent folder if it does not exist (this can be scripted in the launcher). Thereafter, `Backend/src/db.js` will use the file in the persistent folder and persist changes there.

Next steps I can implement now (choose one):
- Add a small startup script (`start-wrapped.js`) that copies the bundled `app.db` into `%APPDATA%/PrototipoInnovacion` and launches the backend with the correct environment variables (Windows-friendly). I can add it under `Backend/` and update packaging notes.
- Attempt to integrate that script into the Tauri `src-tauri` launch flow (requires editing Rust code in `src-tauri/src/main.rs`). This is more involved and I can draft the changes.

If you want I can implement the startup copy script now so the packaged installer can simply place the backend files and the launcher will create the persistent folder and use it.