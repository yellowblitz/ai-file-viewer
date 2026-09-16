# AI File Viewer

A lightweight, browser-based viewer for Adobe Illustrator `.ai` files that contain a PDF-compatible representation.

## Features

- Open `.ai` files locally in the browser
- No file uploads and no server-side processing
- Drag-and-drop file opening
- Crisp PDF.js rendering with HiDPI support
- Zoom in/out and 100% view
- Fit artwork to the window
- Click-and-drag panning
- Multi-page / multi-artboard navigation when exposed as PDF pages
- Fullscreen mode
- PDF files can also be opened for testing

## Compatibility

This viewer targets Illustrator files saved with **Create PDF Compatible File** enabled. Those files contain a PDF representation that can be rendered by PDF.js.

Older Illustrator files or files saved without PDF compatibility are intentionally rejected in this first version instead of attempting an unreliable conversion in the browser.

## Keyboard and mouse controls

| Action | Control |
| --- | --- |
| Pan | Click + drag |
| Zoom | `Ctrl`/`Cmd` + mouse wheel |
| Zoom in | `+` |
| Zoom out | `-` |
| Fit to window | `0` |
| 100% | `1` |
| Previous page | `Left Arrow` / `Page Up` |
| Next page | `Right Arrow` / `Page Down` |

## Run locally

Because the app uses JavaScript modules, serve the folder with a small static web server instead of opening `index.html` directly from disk.

For example:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## GitHub Pages

The repository includes a Pages workflow. In GitHub, open **Settings → Pages**, set **Source** to **GitHub Actions**, and the site will deploy from `main`.

Expected project URL after Pages is enabled:

`https://yellowblitz.github.io/ai-file-viewer/`

## Technology

This is intentionally a small static application: HTML, CSS, JavaScript, and Mozilla PDF.js loaded from jsDelivr. There is no build step and no backend.

## Current scope

Version `0.1.0` is a viewer only. It does not edit Illustrator objects, inspect layers, parse native Illustrator private data, or convert legacy PostScript/EPS-style `.ai` files.
