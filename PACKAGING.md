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

Implemented automation and helper scripts

- `Backend/start-packaged.js`: copies bundled `app.db` into the user persistent folder (e.g. `%APPDATA%/PrototipoInnovacion`) if missing, creates `uploads` folder, sets `PROTOTIPO_DATA_DIR` and `PROTOTIPO_UPLOADS_DIR`, and launches the backend server. This ensures the app uses a writable DB that persists across runs.

- `Front end/src-tauri/src/main.rs`: on app startup the Tauri runtime will attempt to copy an included `app.db` resource into the user's app-data folder if it doesn't already exist. It will also detect a bundled Node runtime and spawn `start-packaged.js` automatically so the backend starts without extra user steps.

- `scripts/package-windows.ps1`: a PowerShell helper that automates assembling the bundle for Windows:
	- downloads a portable Node runtime into `Front end/src-tauri/bundled/node`
	- installs backend production dependencies (`npm ci --production` in `Backend`)
	- builds frontend (`npm ci` + `npm run build`)
	- runs `cargo build --release` in `Front end/src-tauri` to produce the Tauri binary (requires Rust installed on the developer machine)

How to use the Windows packaging helper

1. From the repository root run PowerShell as administrator or developer and execute:

```powershell
.\scripts\package-windows.ps1
```

2. The script will download the Node runtime (configurable by passing `-NodeVersion`), prepare the bundled Node folder, install backend production dependencies, build the frontend, and run `cargo build --release`.

Notes and developer requirements

- The developer machine (where the build runs) must have:
	- Rust toolchain (cargo) installed to build the Tauri binary.
	- Internet access to download Node (or you may place a Node runtime manually under `Front end/src-tauri/bundled/node` before running the script).

- End users DO NOT need Rust or Node installed. The built installer will include the Node runtime and the backend files; the Tauri app will spawn the included Node to run the backend.

Recommended final checks before distributing the installer

1. Test the built installer on a clean Windows VM:
	- Install the produced installer.
	- Run the application and verify the backend starts automatically (check the backend logs or network port) and the UI connects.
	- Create several records and files; close the app and re-open to confirm persistence.

2. If you want truly standalone single-executable behavior (no separate Node binary), consider porting the backend to Rust or bundling a Node executable and the backend files into a single launcher binary; that is more advanced and I can advise if you want.

If you want, I can now run the `scripts/package-windows.ps1` here (if this environment has Rust and network access). Otherwise I can walk you step-by-step and make any tweaks you want to the helper script.