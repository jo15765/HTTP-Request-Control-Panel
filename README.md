# HTTP Client

Electron desktop app for building HTTP requests, inspecting responses, JSON filtering, saved requests, and run history.

## Source on GitHub

1. Create a new repository on GitHub (empty, no README if you already have one locally).
2. In this project folder:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

3. **Do not commit `node_modules/`** — it is listed in `.gitignore`. Anyone who clones runs `npm install` then `npm start`.

## Downloadable app (double-click)

Packaged installers are built with **electron-builder**. Outputs go to the `release/` folder (also gitignored).

### Build on your machine

```bash
npm install
npm run dist
```

| OS | What you get in `release/` |
|----|----------------------------|
| **macOS** | `.dmg` (drag-to-Install) and `.zip` containing `.app` |
| **Windows** | `.exe` installer (NSIS) and portable `.exe` |
| **Linux** | `.AppImage` (chmod +x, then run or integrate) |

- **macOS**: First open may show Gatekeeper (“can’t be opened”) unless the app is **code-signed and notarized** (Apple Developer Program). Users can right-click → Open once, or allow in System Settings → Privacy & Security.
- **Windows**: SmartScreen may warn for unsigned builds; “More info” → Run anyway.

### Publish downloads on GitHub

1. Run `npm run dist` on each OS you want to support (or use GitHub Actions — see below).
2. On GitHub: **Releases** → **Draft a new release** → choose a tag (e.g. `v1.0.0`).
3. Upload the files from `release/` (`*.dmg`, `*.exe`, `*.AppImage`, etc.) as **release assets**.
4. Users download those files; they do **not** need Node.js.

### Automated builds (optional)

Pushing a tag like `v1.0.0` can trigger `.github/workflows/release.yml` to build artifacts and attach them to a GitHub Release (requires workflow file in the repo).

## Development

```bash
npm install
npm start
```

## License

MIT
