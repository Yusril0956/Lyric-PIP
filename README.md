# Spotify Synced Lyrics PiP

A Chrome/Edge/Brave browser extension that shows synced lyrics from Spotify in a floating Picture-in-Picture window.

This project is designed for Spotify Web and uses the LRCLIB API to fetch synced lyrics, then displays them in a compact PiP window while the music continues.

## Features

- Displays synced lyrics from Spotify tracks
- Opens lyrics in a floating Picture-in-Picture window
- Tracks current playback time and syncs lyric highlighting
- Works with Spotify Web on supported Chromium browsers
- No backend required; the extension runs locally in the browser

## Screenshots

Add a screenshot here later if you want to showcase the UI on GitHub:

- Spotify tab with the PiP lyrics button
- Floating lyrics window with current line highlighted
- Playback controls and lyric sync indicator

## How it works

1. The extension injects a script into the Spotify page.
2. It reads metadata such as track title, artist, album, and playback state.
3. It sends the metadata to LRCLIB to look up synced lyrics.
4. The matched lyrics are parsed from LRC format and displayed in a floating PiP window.
5. The lyrics are updated as playback time changes.

## Requirements

- Google Chrome, Microsoft Edge, Brave, or another Chromium-based browser with Document Picture-in-Picture support
- Spotify Web player open in the browser
- Internet access to fetch lyrics from the LRCLIB API

## Installation

1. Download or clone this repository.
2. Open your browser's extension page:
   - Chrome: chrome://extensions
   - Edge: edge://extensions
   - Brave: brave://extensions
3. Enable Developer mode.
4. Click Load unpacked.
5. Select this project folder.
6. Open Spotify Web and play a track.
7. Click the button that appears on the page, or activate the extension flow as implemented in the project.

## Project structure

```text
.
├── manifest.json
├── background.js
├── content.js
├── main-world.js
├── README.md
└── LICENSE   (optional, add if you want to publish publicly)
```

## Privacy and security review

### What this extension does

- Reads track data from the visible Spotify page only while you are actively using Spotify
- Accesses the active tab and injects scripts for playback control
- Calls the LRCLIB API to look up lyrics for the current track
- Does not create a server, database, or cloud account for the project itself

### What it does not do

- Does not store your Spotify username, password, or account tokens in this repository
- Does not include a backend service or database
- Does not require API keys for the extension itself
- Does not persist lyrics to local storage or a custom server in the current code

### Important note about data flow

The extension sends metadata such as:

- track title
- artist name
- album name (if available)
- playback duration

to the external LRCLIB service via HTTPS. This is necessary for lyric lookup.

So the data is not stored inside the project itself, but it is sent to a third-party API when you request lyrics. If you are concerned about privacy, consider:

- using a self-hosted lyrics service instead of LRCLIB
- removing album/duration metadata if you want a minimal request
- reviewing the LRCLIB privacy policy before public use

### Security status

This project is relatively safe for personal use and for GitHub upload because:

- there are no secrets, credentials, or private tokens in the repository
- there is no backend or database to leak sensitive data
- permissions are limited to the active Spotify tab and the required LRC service host

However, it is still a browser extension that interacts with a third-party website and external API, so it should be treated as a local utility rather than a fully enterprise-grade secure app.

## Browser permissions used

From the manifest:

- activeTab: allows access to the active tab when the user interacts with the extension
- scripting: injects code into the page
- host permissions: limited to Spotify and the lyrics service domain

This scope is narrow and does not expose broad access to arbitrary sites.

## Limitations

- Only works on Spotify Web and browsers with Picture-in-Picture support
- Lyrics availability depends on the LRCLIB database
- Some tracks may not have synced lyrics
- The extension relies on webpage DOM structure, which can change if Spotify updates the UI

## Future improvements

- add a polished settings panel
- add support for custom lyrics sources
- add offline fallback handling
- improve compatibility with Spotify UI changes
- add a proper license file and release notes

## Suggested GitHub publishing steps

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

## License

No formal license has been added yet. If you plan to publish this to GitHub publicly, it is recommended to add a LICENSE file such as MIT before sharing it widely.

## Disclaimer

This project is a fan utility for Spotify Web and is not affiliated with, endorsed by, or sponsored by Spotify.
