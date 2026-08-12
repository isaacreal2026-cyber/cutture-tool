# CutterStudio Pro (aisac)

Vinyl-cutter design studio. The original single file is `htlm`. The **Windows-ready app** lives in `app/`.

## Run in a browser

```bash
npm run preview
# or: python3 -m http.server 8080 --directory app
```

Open `http://localhost:8080`.

## Run as a desktop app

```bash
npm install
npm start
```

## Build a Windows installer / portable exe

On Windows (or CI with Electron Builder):

```bash
npm install
npm run pack:win
```

Outputs under `dist/`:

- `CutterStudio-Pro-1.0.0-win-x64.exe` (NSIS)
- portable build for USB / no-install use

## Verify

```bash
npm test
```

See `WINDOWS-READINESS.md` for the full test report and what is (and is not) plotter-complete.
