# assets

Drop the official Dolmen logo files here. The app looks for them by these exact names:

| File | Used for | Notes |
|------|----------|-------|
| `logo-dolmen.png` (or `.svg`) | light theme header / sign-in | required |
| `logo-dolmen-dark.png` (or `.svg`) | dark theme header (optional) | falls back to the light one if absent |

Recommended: SVG if available, otherwise a PNG with transparent background,
at least 240px wide (it renders small — ~28px tall in the header).

Until a file is present the header shows a plain "LM" placeholder tile.
