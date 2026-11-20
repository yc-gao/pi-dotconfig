---
name: yt-dlp
description: >
  Download video, audio, subtitles, and metadata from YouTube, Bilibili, TikTok, X, Instagram, and more than 1,800 other sites with yt-dlp.
  Use this skill when a user provides a media URL and wants to download content, extract audio, retrieve subtitles or metadata, inspect available formats, or batch-download a playlist or channel. It also covers cookie-based authentication and troubleshooting HTTP 403 errors.
  This skill is not intended for converting local media files.
---

# yt-dlp

yt-dlp is a command-line downloader for audio and video from more than 1,800 sites. Use this skill to choose formats, download media, handle authentication, and troubleshoot common failures when given a media URL.

Every operation below is a single `yt-dlp` invocation with the URL quoted. Format selections that combine separate video and audio streams are merged with FFmpeg, so a working `ffmpeg` on `PATH` is needed for those commands; verifying it with `ffmpeg -version` before the first merged download avoids a failure after the streams have already been fetched.

## When to use

Trigger this skill when the request involves a **network media URL** — YouTube, Bilibili, TikTok, X, Instagram, or any of the other ~1,800 supported sites — and the user wants to:

| Goal | Typical phrasing |
| --- | --- |
| Fetch a single video | "download this video", "save this clip" |
| Fetch audio only | "rip the audio", "get the MP3" |
| Fetch subtitles | "grab the subtitles", "hardcode/embed subs" |
| Inspect before downloading | "what resolutions exist", "how many parts in this playlist" |
| Batch-download a collection | "get the whole playlist/channel" |
| Authenticate a source | "it says login required", "use my cookies" |
| Diagnose a failed download | "it fails with 403", "format not available" |

Also use it when a download must be scoped, resumed, or rate-limited rather than run naively.

**Out of scope:** media that already exists on disk (converting, trimming, re-encoding, remuxing). Point those requests to the `ffmpeg` skill instead.

## Core Workflow

### 1. Establish the target

Pin down, before running anything:

- **Deliverable** — video, audio, subtitles, metadata only, or a whole playlist.
- **Constraints the user named** — format, resolution, audio bitrate, subtitle language, output directory.

Ask a follow-up only when an unclear choice would materially change the result — for example, which resolution to use when the user said "best quality" but the source offers several, or whether a URL that holds both a playlist and a video ID means the whole list or just that entry.

### 2. Inspect before selecting

- Run `yt-dlp -F "URL"` when the user names a quality or format, or when the available options are unclear.
- Run `yt-dlp --flat-playlist -F "URL"` first for playlists, so a large collection is counted without full extraction.
- Keep yt-dlp's default selection when no format is requested rather than guessing at one.

### 3. Pick the operation

Choose the matching command from **Common Operations** and add only the options the request needs:

- A playlist or channel is downloaded in full **only** when the user asks for it.
- If the content needs a logged-in session, follow the cookie procedure and treat the cookie data as a secret.

### 4. Execute

Run the command with the URL quoted, preserving the requested output location and options. If a requested format turns out to be unavailable, report the alternatives from the format list instead of silently substituting a different one.

### 5. Verify and report

Confirm the expected files exist and match the request in name, container, resolution, and subtitles. Report the output location plus anything yt-dlp printed as an error. Never claim success when the download failed or only part of a playlist was retrieved.

## Common Operations

Each operation below is a single command to adapt to the request: keep the URL quoted, keep `-o` pointing at the location the user asked for, and add options only when the request needs them.

### Inspect available formats

List a video's available formats, including format IDs, resolutions, and codecs, before choosing one with `-f`:

```bash
yt-dlp -F "URL"
```

For a playlist, list entries in flat mode without fully extracting metadata for each video:

```bash
yt-dlp --flat-playlist -F "URL"
```

### Download video

Download a video using yt-dlp's default format selection. The output filename is based on the video's title:

```bash
yt-dlp -o "%(title)s.%(ext)s" \
  "URL"
```

Select the best available video and audio streams, falling back to the best combined format when separate streams are unavailable. The output filename is based on the video's title:

```bash
yt-dlp -o "%(title)s.%(ext)s" \
  -f "bv*+ba/b" "URL"
```

Download all available automatically generated subtitles and embed them in the media file:

```bash
yt-dlp -o "%(title)s.%(ext)s" \
  --write-auto-subs --sub-langs all --embed-subs \
  "URL"
```

### Download subtitles

Download all available creator-provided subtitles as separate files without downloading the media:

```bash
yt-dlp -o "%(title)s.%(ext)s" \
  --write-subs --sub-langs all --skip-download \
  "URL"
```

### Extract audio

Extract the audio, convert it to MP3, and use yt-dlp's highest-quality setting (`0`):

```bash
yt-dlp -o "%(title)s.%(ext)s" \
  -x --audio-format mp3 --audio-quality 0 \
  "URL"
```

### Download an entire playlist

Download all videos in the playlist, even if the URL also identifies an individual video. Save each file in a subdirectory named after the playlist, and record downloaded items in `archive.txt` so later runs can skip them:

```bash
yt-dlp -o "%(playlist)s/%(title)s.%(ext)s" \
  --yes-playlist \
  --download-archive archive.txt \
  "URL"
```

### Download with cookies

For content that requires authentication, handle the user's cookie data as a secret. Never echo it or place it directly in a command or log.

1. **Collect the cookie header.** Use `generate_file_from_input` to save `Cookie` request header to a private temporary file such as `cookie-header.txt`. If the cookie domain is unclear, ask the user to confirm it.
2. **Convert it to Netscape format.** Pass the header file to the converter on standard input. Replace `.example.com` with the actual cookie domain; do not use a placeholder domain. Store the generated file in a private location:

```bash
# Run the converter shipped with this skill (scripts/cookies_from_string.py, resolved against this SKILL.md's directory).
python3 scripts/cookies_from_string.py \
  --domain .example.com \
  --output cookies.txt \
  < cookie-header.txt
```

3. **Use the converted file with yt-dlp:**

```bash
yt-dlp --cookies cookies.txt "URL"
```

4. **Delete the cookie files as soon as the download ends.** This is mandatory, not optional cleanup. Once yt-dlp exits — success or failure — remove every cookie-related file this procedure created, in the same turn, and confirm the deletion to the user:

```bash
rm -f cookies.txt cookie-header.txt
```

If a different filename or location was used, delete those exact paths instead. Do not leave cookie files around for a retry: if a retry is needed, repeat the whole procedure with a freshly copied `Cookie` header. Never display either file's contents.

## Troubleshooting

Diagnose a failure from yt-dlp's own message before changing options, and re-run with `-v` when the cause is not obvious. Add `--no-warnings` only when warnings are burying the error.

An HTTP 403 Forbidden, or a note that the content is only available to logged-in users, means the session is missing or stale. Follow the cookie procedure with a freshly copied `Cookie` header; expired cookies reproduce the same 403.

"Requested format is not available" means the selector in `-f` matched nothing for this URL. Run `yt-dlp -F "URL"` and pick a format ID or selector that the list actually contains, then tell the user which alternative was used.

A merge error, or the output landing as separate `.f137.mp4` and `.f140.m4a` files, means FFmpeg is missing or not on `PATH`. Install it, or restrict the command to a single combined format such as `-f b` to avoid the merge step.

A download that stops partway can usually be resumed with the same output template by adding `--continue`. For repeated failures from one host, slow down the requests with `--sleep-requests 1 --retries 10` rather than re-running immediately.

When a URL expands to far more items than the user expected, stop and confirm the scope before downloading. Use `--flat-playlist -F "URL"` to count the entries and `--playlist-items 1-10` to bound a large collection.
