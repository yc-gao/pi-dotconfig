---
name: yt-dlp
description: >
  Download video, audio, subtitles, live chat, and live streams from YouTube, Bilibili, TikTok, X, Instagram, and more than 1,800 other sites with yt-dlp.
  Use this skill when the user gives a media page URL and wants to: inspect formats or playlist entries before downloading; download video, using a size ceiling or codec preference instead of a guessed format ID; extract audio, lossless or as MP3; fetch, select by language, or embed subtitles and live chat; download a whole or partial playlist/channel, incrementally; record a live stream, including from the start of the DVR buffer; use cookies for members-only, private, or login-required content; resume, retry, or rate-limit a download that stalled or failed with HTTP 403/429; or update yt-dlp when a site stops working.
  This skill is not intended for converting, trimming, remuxing, or re-encoding media that already exists on disk; use the ffmpeg skill for those.
---

# yt-dlp

Download and inspect network media from 1,800+ sites with yt-dlp — formats and sorting, audio extraction, subtitles and live chat, playlists, live DVR, cookies, and failure recovery — running one invocation per operation with the URL quoted, stating preferences instead of guessing format IDs, requiring FFmpeg for merging, embedding, and audio extraction, and leaving media already on disk to the `ffmpeg` skill.

## When to use

Trigger this skill when the request involves a **network media URL** — YouTube, Bilibili, TikTok, X, Instagram, or any of the other ~1,800 supported sites — and the user wants to:

- Inspect formats or playlist contents before downloading
- Download a video, or extract its audio
- Fetch subtitles or a live-chat log
- Download part or all of a playlist, channel, or other collection
- Record a live stream, including one that has not started yet
- Reach content behind a login, using cookies
- Recover a download that failed or was throttled
- Investigate a site that suddenly stopped working

**Out of scope:** media that already exists on disk (converting, trimming, re-encoding, remuxing). Point those requests to the `ffmpeg` skill instead.

## Core Workflow

### 1. Classify the request

Identify what to deliver (video, audio, subtitles, live chat, live stream, or a collection) and the constraints the user named (quality or codec, audio format, subtitle languages, output location). Ask a follow-up only when an unclear choice would materially change the result — for example a URL that could mean either the whole playlist or a single entry.

### 2. Check prerequisites

Verify what the operation depends on before transferring anything, so a missing tool fails immediately instead of after a large download.

### 3. Inspect only when the answer depends on it

When a quality or format is named, or the available options are unclear, look up the source's real capabilities first. Prefer stating a preference over pinning an exact option, keep the tool's default when nothing was requested, and bound a large collection before extracting everything in it.

### 4. Build the command

Start from the matching operation in **Common Operations**, then apply the site-specific preferences in **Best Practices by Use Case** when the request targets one of those sites: repeatability, scope, robustness, politeness, and authentication. A playlist or channel is downloaded in full only when the user asks for it, and cookie data is treated as a secret.

### 5. Execute

Run a single invocation with the URL quoted, keeping the requested output location and options. If a requested choice turns out to be unavailable, report the alternatives instead of silently substituting one, and do not widen the scope of the run.

### 6. Verify and report

Confirm the expected files exist and match the request, and treat leftover partial files as an incomplete download rather than a success. Report the output location plus anything the tool printed as an error. Never claim success when the download failed or only part of a collection was retrieved.

## Common Operations

Each operation below is a single command to adapt to the request: keep the URL quoted, keep `-o` pointing at the location the user asked for, and add options only when the request needs them.

Options are introduced under each command as `-s, --long-name`. Both spellings are equivalent, and most boolean flags have a `--no-` form that restores the default. Text inside square brackets after an option name is an optional part of its argument, not literal input.

### Inspect available formats

List a video's available formats, including format IDs, resolutions, and codecs, before choosing one with `-f`:

```bash
yt-dlp -F "URL"
```

For a playlist, list entries in flat mode without fully extracting metadata for each video:

```bash
yt-dlp --flat-playlist -F "URL"
```

**Options**

- `-F, --list-formats` — print the format table (ID, extension, resolution, codecs, bitrate, size) and exit without downloading. Format IDs taken from this table are the only safe input for `-f`.
- `--flat-playlist` — list entries without extracting each video's metadata, which is fast on large collections, but some fields are missing and no media is downloaded. The default, `--no-flat-playlist`, fully extracts every entry.

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

Rank formats by preference instead of pinning a format ID, so the run still yields the closest match when the top choice is missing:

```bash
yt-dlp -o "%(title)s.%(ext)s" \
  -S "res:1080,codec:avc,ext:mp4" "URL"
```

Download all available automatically generated subtitles and embed them in the media file:

```bash
yt-dlp -o "%(title)s.%(ext)s" \
  --write-auto-subs --sub-langs all --embed-subs \
  "URL"
```

**Options**

- `-o, --output [TYPES:]TEMPLATE` — filename template. Fields such as `%(title)s`, `%(id)s`, `%(ext)s`, `%(playlist)s`, and `%(upload_date)s` are filled from metadata; keep `%(ext)s` last so the real extension wins. Missing directories are created.
- `-f, --format FORMAT` — selection expression, not a single ID. `bv*` is the best video that may include audio, `ba` the best audio, `+` merges the pair with FFmpeg, `/` provides a fallback, and `b` alone means the best combined stream.
- `-S, --format-sort SORTORDER` — ordered sort keys, optionally capped (`res:1080`, `codec:avc`, `ext:mp4`). Sorting is a preference, so it still produces a file when the top choice is absent.
- `--write-auto-subs` — write the auto-generated subtitle tracks; this does not include the creator's own tracks.
- `--sub-langs LANGS` — languages to fetch: `all`, a comma-separated list, or patterns such as `zh.*,en.*`.
- `--embed-subs` — mux the subtitle tracks into the media file, which only works for mp4, webm, and mkv output and requires FFmpeg.

### Download subtitles

Download all available creator-provided subtitles as separate files without downloading the media:

```bash
yt-dlp -o "%(title)s.%(ext)s" \
  --write-subs --sub-langs all --skip-download \
  "URL"
```

**Options**

- `--write-subs` — save creator-provided subtitle tracks; add `--write-auto-subs` to include machine-generated ones.
- `--sub-langs` — `all`, a comma-separated list, or patterns like `en.*,ja` to narrow what is fetched.
- `--skip-download` — skip the media file and write only the auxiliary files such as subtitles, thumbnails, and metadata.

### Extract audio

Extract the audio, convert it to MP3, and use yt-dlp's highest-quality setting (`0`):

```bash
yt-dlp -o "%(title)s.%(ext)s" \
  -x --audio-format mp3 --audio-quality 0 \
  "URL"
```

**Options**

- `-x, --extract-audio` — post-process the download into an audio-only file; requires FFmpeg and ffprobe.
- `--audio-format FORMAT` — target codec: `best` keeps the source codec without re-encoding, while `mp3`, `m4a`, `opus`, `flac`, and `wav` re-encode.
- `--audio-quality QUALITY` — `0` is best and `10` worst for VBR targets, or give an explicit bitrate such as `192K`; the default is `5`.

### Download an entire playlist

Download all videos in the playlist, even if the URL also identifies an individual video. Save each file in a subdirectory named after the playlist, and record downloaded items in `archive.txt` so later runs can skip them:

```bash
yt-dlp -o "%(playlist)s/%(title)s.%(ext)s" \
  --yes-playlist \
  --download-archive archive.txt \
  "URL"
```

To download only selected playlist entries, use `--playlist-items`. Separate individual positions with commas and specify inclusive ranges with a hyphen:

```bash
yt-dlp -o "%(playlist)s/%(title)s.%(ext)s" \
  --yes-playlist \
  --download-archive archive.txt \
  --playlist-items 1,3,5:7 \
  "URL"
```

**Options**

- `--yes-playlist` / `--no-playlist` — decide which scope applies when a URL refers to both a video and a playlist.
- `--download-archive FILE` — record the IDs of finished items and skip them on later runs; deleting the file allows a re-download.
- `-I, --playlist-items ITEM_SPEC` — comma-separated positions and ranges written `START:STOP:STEP`, with negative indices counting from the end (for example `1:3,7,-5::2`).

### Record a live stream

Capture a live stream into a single file until it ends, polling every 30–300 seconds for a scheduled stream to start, and keeping the run restartable through `archive.txt`. The first command also saves the live chat as a subtitle file next to the recording, so drop `--write-subs --sub-langs live_chat` when the chat is not wanted:

```bash
yt-dlp -o "%(title)s.%(ext)s" \
  --download-archive archive.txt \
  --wait-for-video 30-300 \
  --write-subs \
  --sub-langs live_chat \
  "URL"
```

Record a stream that is already in flight from the beginning of the platform's DVR buffer:

```bash
yt-dlp -o "%(title)s.%(ext)s" \
  --download-archive archive.txt \
  --live-from-start \
  "URL"
```

**Options**

- `--wait-for-video MIN[-MAX]` — poll for a scheduled stream, waiting `MIN` seconds between attempts and backing off to `MAX`; a single value fixes the interval. The command otherwise gives up immediately on a room that is offline. Leave it out when the stream is already live, or the command waits unnecessarily.
- `--live-from-start` — record from the beginning of the platform's DVR buffer instead of the current moment. It is experimental and limited to a few extractors (YouTube, Twitch, TVer, mellow-fan); on any other site yt-dlp warns and falls back to recording from the current moment, so check the log line before trusting the output.
- `--write-subs` with `--sub-langs live_chat` — save the live chat as a subtitle file next to the recording; on busy streams it grows continuously and can outgrow the video.
- `--download-archive FILE` — keep long recordings restartable by skipping a video that is already recorded.
- Stopping with Ctrl-C ends the recording: a live capture cannot be resumed, so the file is complete only when yt-dlp exits on its own. Delete any leftover `.part` file before starting over.

The recording runs in the foreground and prints progress until the stream ends. Announce the output path before starting it, and report the resulting file size and duration when it exits.

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

**Options**

- `--cookies FILE` — read cookies from a Netscape-format file and write the updated jar back to it, so the file is both input and state.

## Best Practices by Use Case

Field-tested flag combinations for the sites where yt-dlp's defaults are not enough. Adapt the URL and output path; keep the pattern.

| Site | Pattern | Why it works |
| --- | --- | --- |
| Bilibili live | `-f "best[ext=flv]/best"` | Live endpoints often expose one container; pinning FLV avoids a bad pick, `/best` keeps it working when FLV is absent |
| YouTube live / long stream | `--live-from-start --download-archive archive.txt` | Records the DVR buffer from the beginning and makes a restart resume instead of duplicating |

## Troubleshooting

Match the error line yt-dlp printed to one entry below, apply that entry's fix, and retry the original command once. Fix only what the error names, and work through the entries in order instead of jumping to cookies or a different format.

1. **`yt-dlp: command not found`** — not installed. `brew install yt-dlp`, or `python3 -m pip install -U yt-dlp`; confirm with `yt-dlp --version`.
2. **`ffmpeg is not installed` / postprocessing failed** — merging, embedding, or audio extraction needs FFmpeg. Install it (`brew install ffmpeg`), confirm with `ffmpeg -version`, and retry; if it stays unavailable, use `-f "b"` to skip merging and tell the user the result is not the highest quality.
3. **Anything else on a site that used to work** — the extractor is usually stale. Run `yt-dlp -U` first; if the install is package-managed and `-U` refuses, update through `brew` or `pip` and say which was used, then retry.
4. **`HTTP Error 403: Forbidden`** — stale signature, missing `Referer`, or an expired session. Update yt-dlp and retry once, then add `--referer "URL"`, then fall back to **Download with cookies**. Clear leftovers from the failed attempt first: `rm -f *.part *.ytdl`.
5. **`HTTP Error 429: Too Many Requests`** — rate limited. Slow the run down with `--sleep-requests 1 --sleep-interval 5 -N 2` and retry later rather than immediately.
6. **`Sign in to confirm you're not a bot` / `Sign in to confirm your age`** — bot or age gate. Use **Download with cookies** once; repeated anonymous retries make it worse.
7. **`Private video` / `Login required` / members-only message** — the content needs an authenticated session. Use **Download with cookies**; if it still fails, report that the account lacks access instead of retrying.
8. **`This video is not available in your country`** — region lock. Report it; never fake a location or reach for a proxy to work around it.
9. **`Video unavailable` / `has been removed` / `Unsupported URL` / `No video formats found`** — the content is gone, or the URL is not a media page. Update yt-dlp once, then report the URL as unsupported; no command fixes this.
10. **`Requested format is not available`** — that ID does not exist for this video. Re-run `yt-dlp -F "URL"` and pick from the real list, or drop to `-f "bv*+ba/b"`; never invent a format ID.
11. **Stalls, `Read timed out`, `Unable to download fragment`** — network instability or throttling. Retry with `--retries 10 --fragment-retries 10 --socket-timeout 30 --concurrent-fragments 1`, and lower `-N` when the site throttles parallel requests.
12. **`SSL: CERTIFICATE_VERIFY_FAILED` / DNS or proxy errors** — the network path is broken. Re-run through the user's proxy with `--proxy URL`; use `--no-check-certificates` only if the user accepts the risk.
13. **`[Errno 28] No space left on device`** — the target volume is full. Free space or point `-o` at another volume, and report the shortfall; never present a truncated file as a complete download.
14. **Destination already exists** — a stale or partial file is in the way. Remove it and retry; `--force-overwrites` overwrites, `--no-overwrites` keeps the existing file and skips the item.
15. **Playlist stops after a few entries** — one entry failed while others succeeded. Re-run the same command with `--download-archive archive.txt` to skip finished items, retry only the failures, and list the entries that still fail.
16. **Live: `This live event will begin in ...` / `Premieres in ...`** — the room is not live yet. Add `--wait-for-video 30-300`; if `--live-from-start` printed a fallback warning, the recording starts from the current moment, so report that.
17. **Interrupted recording (Ctrl-C) or leftover `.part` file** — a live capture cannot be resumed. Delete the `.part` file and start a new recording, stating how much was lost.
18. **Cookie loading fails (`Failed to decrypt`, empty cookie jar)** — the browser profile is locked or the header was rejected. Re-copy the `Cookie` header and repeat **Download with cookies**; delete the cookie files afterwards as that procedure requires.

### When no entry fixes it

Stop and report the failure instead of trying more commands: the exact command, the error line yt-dlp printed, the `yt-dlp --version` output, and which entries above were already tried. Never claim a download succeeded unless the expected files exist and are complete, and never substitute a different site, a lower quality, or a partial playlist without saying so.
