# demo-media (offline fallback only)

This folder is a convenience for running the UI without Google credentials.

If `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` are **not** set in `server/.env`,
the streaming endpoint serves bytes from a local file here instead of Drive:

1. `<videoFileId>.mp4` — a file named after the lesson's `videoFileId`
2. `sample.mp4` — used for every lesson otherwise

The HTTP behaviour is identical (Range requests, `206 Partial Content`,
`Accept-Ranges`), only the byte source changes.

**As soon as Drive credentials are present in `.env`, this folder is ignored**
and every lesson streams from the private Google Drive folder — which is the
architecture the demo is meant to prove.
