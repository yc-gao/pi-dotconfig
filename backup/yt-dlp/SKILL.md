---
name: yt-dlp
description: >
  Download video, audio, subtitles, and metadata from YouTube, Bilibili, TikTok, X, Instagram, and 1800+ other sites using yt-dlp. Use when the user provides a media URL and wants to download it, extract audio, fetch subtitles, probe available formats, or pull metadata. Also use for playlist/channel batch downloads, cookie-authenticated content, and fixing yt-dlp 403 errors. Not for local media file conversion.
---

# yt-dlp

yt-dlp is a command-line audio/video downloader supporting 1800+ sites. This skill guides the agent to pick the right format, run the download, handle authentication, and troubleshoot failures in priority order when the user provides a media URL.

## When to use

Use this skill when the user wants to:

- inspect available streams, quality options, and metadata before downloading
- download a video or audio file from a supported URL
- extract only audio from a video
- fetch subtitles or closed captions
- download a playlist, channel, or series in bulk
- use browser cookies or authenticated sessions for protected content
- diagnose common yt-dlp failures such as 403 errors, extraction issues, or format constraints

Do not use this skill for local media conversion or for downloading content from an unsupported site or a URL without a clear target media resource.

## Core workflow

Use this workflow in order. Do not jump to a download command before checking the content and the target format.

### 1. Confirm the URL and the output goal

Start by clarifying what the user wants:

- full video or audio only
- best quality, specific resolution, or exact format
- subtitles included or separate
- single video vs playlist/channel
- download to a particular folder or file naming pattern

If the URL is a playlist or channel, ask whether the user wants the entire listing or only specific entries.

### 2. Probe streams and formats before downloading

Inspect the site and available formats first:

```bash
yt-dlp -F "URL"
```

For a playlist or channel:

```bash
yt-dlp --flat-playlist -F "URL"
```

Interpret the output carefully:

- `video` entries are stream variants
- `audio` entries are separate audio tracks
- `format code` values are used with `-f`
- some sites separate video and audio tracks; best quality often requires combining both

When in doubt, prefer `-F` before every actual download.

### 3. Choose the correct format

Use the narrowest safe command for the user's goal.

#### Best video + audio

```bash
yt-dlp -f "bv*+ba/b" "URL"
```

This chooses the best video stream and merges it with the best compatible audio stream; it is the default choice for a high-quality single download.

#### Best quality video only

```bash
yt-dlp -f "bv" "URL"
```

#### Audio only

```bash
yt-dlp -x --audio-format mp3 --audio-quality 0 "URL"
```

This extracts the best available audio and encodes it into MP3. Use `m4a` if the user wants a lossless or near-lossless container.

#### Subtitles only

```bash
yt-dlp --write-subs --sub-langs all --skip-download "URL"
```

#### Download with subtitles embedded

```bash
yt-dlp --write-auto-subs --sub-langs all --embed-subs "URL"
```

#### Download metadata and thumbnail

```bash
yt-dlp --write-info-json --write-thumbnail "URL"
```

#### Download a whole playlist

```bash
yt-dlp -o "%(playlist)s/%(autonumber)s-%(title)s.%(ext)s" "URL"
```

Add `--limit-rate`, `--retries`, or `--sleep-requests` when rate limiting or intermittent failures are present.

### 4. Use authentication only when needed

Some sites require cookies or logged-in access. Prefer a minimal, site-specific session approach.

#### Cookie file

```bash
yt-dlp --cookies /path/to/cookies.txt "URL"
```

Before running any command with `--cookies`, ask the user to provide the relevant `Cookie: ...` header and wait for their reply. Do not proceed with `--cookies` until they provide it. Cookies grant access to the user's account, so treat the value as secret and do not repeat it in responses or logs.

After the user provides the header, use the site's cookie domain (ask if it is unclear) and pass the header to the converter through stdin, not as a command-line argument:

```bash
python3 scripts/cookies_from_string.py \
  --domain .example.com \
  --output cookies.txt
```

Feed the user's Cookie header to this command on stdin. The converter writes Netscape HTTP Cookie File format; then use the generated file:

```bash
yt-dlp --cookies cookies.txt "URL"
```

Keep `cookies.txt` in a private location and do not display its contents. Do not use a placeholder domain: the cookie domain must match the site.

### 5. Export and verify the result

After the download completes:

- confirm the filename and location
- confirm the extension and quality match the request
- verify the file is playable and not corrupted
- if the user requested subtitles, confirm the subtitle files exist and match the language

For a quick verification of downloaded metadata:

```bash
yt-dlp --list-thumbnails "URL"
```

or inspect the generated `.info.json` file when one was requested.

## Recommended defaults

Keep the following defaults in mind when no explicit preference is given:

- use `-f "bv*+ba/b"` for a high-quality video download
- use `-x --audio-format mp3` for audio-only extraction
- use `--write-auto-subs --sub-langs all` when subtitles are relevant
- use `--write-info-json --write-thumbnail` when the user wants metadata-rich results
- use `--restrict-filenames` when file names may contain unsafe characters
- use `--merge-output-format mp4` when the site produces separate streams and the user expects a standard video container

## Troubleshooting

Handle problems in this order: format, authentication, network, site compatibility.

### 403 or access denied

Common causes:

- bot detection or anti-bot restrictions
- missing cookies or age gate
- blocked geolocation
- rate limits or temporary bans

Try:

```bash
yt-dlp --cookies /path/to/cookies.txt --add-header "Referer: <site>" "URL"
```

Only run this command after following the cookie-file consent and conversion steps above. If the site is still blocked, verify whether the user has a valid account and whether the content is region-locked. Some sites require a user agent or a browser session that mirrors a real client.

### No formats available or extraction fails

Check the site and stream status:

```bash
yt-dlp -F "URL"
```

If the uploader restricts access or the site changes its extraction logic, the fix may be to re-run with updated yt-dlp, use site-specific extractor arguments, or use a logged-in browser session.

### Playlist downloads skip entries

Use a more explicit naming scheme and check if the site limits entries:

```bash
yt-dlp --flat-playlist -F "URL"
```

Then download using the right output template and, if needed, add `--yes-playlist` to force playlist handling.

### Network or connection issues

Use conservative retry and rate settings:

```bash
yt-dlp --retries 10 --limit-rate 2M --sleep-requests 1 "URL"
```

This helps with intermittent throttling and slow network conditions. If the remote server is unstable, a smaller file set is often more reliable than a large batch.

## Safety and scope

- Only download media the user is explicitly authorized to access.
- Do not download copyrighted material or private content beyond the user's intended scope.
- Keep the download directory controlled and avoid writing to unrelated locations without the user's permission.
- Treat cookies and session data as sensitive; do not expose them in chat logs or comments.
- Prefer the simplest correct command that matches the user's requested output.

## Example requests

### Download a best-quality MP4

```bash
yt-dlp -f "bv*+ba/b" "https://example.com/watch?v=abc123"
```

### Download only the audio as MP3

```bash
yt-dlp -x --audio-format mp3 --audio-quality 0 "https://example.com/watch?v=abc123"
```

### Download only subtitles

```bash
yt-dlp --write-subs --sub-langs all --skip-download "https://example.com/watch?v=abc123"
```

### Download a playlist with numbered filenames

```bash
yt-dlp -o "%(playlist)s/%(autonumber)s-%(title)s.%(ext)s" "https://example.com/playlist"
```

## Final rule

When a user provides a media URL, the agent's job is to identify the actual objective, probe the available formats, choose the most direct command, and only then run the download. The correct resolution is not to guess the file type; it is to inspect the source, choose the format intentionally, and verify the result.

