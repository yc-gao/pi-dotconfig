---
name: yt-dlp
description: >
  Download video, audio, subtitles, live chat, and live streams from YouTube, Bilibili, TikTok, X, Instagram, and more than 1,800 other sites with yt-dlp.
  Use this skill when the user gives a media page URL and wants to: inspect formats or playlist entries before downloading; download video, using a size ceiling or codec preference instead of a guessed format ID; extract audio, lossless or as MP3; fetch, select by language, or embed subtitles and live chat; download a whole or partial playlist/channel, incrementally; record a live stream, including from the start of the DVR buffer; use cookies for members-only, private, or login-required content; resume, retry, or rate-limit a download that stalled or failed with HTTP 403/429; or update yt-dlp when a site stops working.
  This skill is not intended for converting, trimming, remuxing, or re-encoding media that already exists on disk; use the ffmpeg skill for those.
---

# yt-dlp

Use yt-dlp to download and inspect network media from more than 1,800 supported sites. This skill covers format selection and sorting, audio extraction, subtitle and live-chat download, playlist scope, live DVR recording, authentication, and recovery from common download failures.

Keep each operation to one `yt-dlp` invocation with the media URL quoted. Prefer explicit constraints and yt-dlp's sorting options over assumed format IDs; a format list or flat playlist list is the source of truth when exact choices matter. Commands that merge streams, embed subtitles, or extract audio require FFmpeg on `PATH`, so run `ffmpeg -version` first. This skill does not process media already on disk; use the `ffmpeg` skill for conversion, trimming, remuxing, or re-encoding.

## When to use

Trigger this skill when the request involves a **network media URL** — YouTube, Bilibili, TikTok, X, Instagram, or any of the other ~1,800 supported sites. Each row names a request pattern and where it is answered, so triggers and commands never drift apart (**bold** = section, *italic* = row in **Best Practices by Use Case**).

| Request | Typical phrasing | Covered by |
| --- | --- | --- |
| Inspect before downloading | "what resolutions exist", "how many parts in this playlist" | **Inspect available formats** |
| Fetch a single video | "download this video", "save this clip" | **Download video** |
| Fetch audio only | "rip the audio", "get the MP3", "keep the original codec" | **Extract audio**, *Lossless / Compatible audio* |
| Fetch subtitles or chat | "grab the subtitles", "embed zh and en subs", "save the chat log" | **Download subtitles**, *Bilingual subtitles*, **Record a live stream** |
| Batch-download a collection | "get the whole playlist/channel", "just the first 50, skip what I have" | **Download an entire playlist**, *Playlist / channel, incremental* |
| Record a live stream | "record this live stream", "save it from the beginning", "it hasn't started yet" | **Record a live stream**, *Bilibili live* |
| Authenticate a source | "it says login required", "use my cookies" | **Download with cookies**, **Authenticated sources** |
| Recover a broken download | "it fails with 403", "it stalls", "429 too many requests" | **Troubleshooting**, *Flaky network / long file* |
| Site suddenly stops working | "it worked last week", "no video formats found" | **Tool is out of date** |
<!-- gogoga-table: {"w":[null,286],"wide":1} -->
Also use it when a download must be scoped, resumed, or rate-limited rather than run naively — `--playlist-items`, `-c`, `--retries`, `--sleep-interval`, and `-N` are covered under **Best Practices by Use Case**.

**Out of scope:** media that already exists on disk (converting, trimming, re-encoding, remuxing). Point those requests to the `ffmpeg` skill instead.

## Core Workflow

### 1. Classify the request

Map the request onto one row of **When to use** and one operation in **Common Operations**. Pin down, before running anything:

- **Deliverable** — video, audio, subtitles, live chat, live stream, or a whole playlist.
- **Constraints the user named** — resolution or codec ceiling, audio codec and bitrate, subtitle languages, output directory.

Ask a follow-up only when an unclear choice would materially change the result — for example, which resolution to use when the user said "best quality" but the source offers several, or whether a URL that holds both a playlist and a video ID means the whole list or just that entry.

### 2. Check prerequisites first

Verify what the operation depends on **before** fetching anything, so a missing tool fails in a second instead of after a large transfer:

- `ffmpeg -version` whenever the command merges streams, embeds subtitles, or extracts audio (`-f "bv*+ba/b"`, `--embed-subs`, `-x`).
- `yt-dlp --version`, then `yt-dlp -U`, when a site is reported broken or the failure looks like extractor breakage.

### 3. Inspect only when the answer depends on it

- Run `yt-dlp -F "URL"` when the user names a quality or format, or when the available options are unclear.
- Run `yt-dlp --flat-playlist -F "URL"` first for playlists, so a large collection is counted without full extraction.
- Prefer `-S` over `-f`: sorting states a preference and still yields a file, while an exact ID fails when the stream is absent. Use `-f` only with an ID copied from `-F` output or a pattern already vetted in **Best Practices by Use Case** (e.g. `bv*+ba/b`, `best[ext=flv]/best`).
- Keep yt-dlp's default selection when no format is requested rather than guessing at one.

### 4. Build the command

Start from the matching command in **Common Operations**, then overlay the rows of **Best Practices by Use Case** that the request needs and nothing more:

- **Repeatability** — `--download-archive archive.txt` for playlists, channels, and restarted live recordings.
- **Scope** — `--playlist-items` to bound a run; a playlist or channel is downloaded in full **only** when the user asks for it.
- **Robustness** — `-c --retries 10 --fragment-retries 10 --socket-timeout 30` for flaky networks and long files.
- **Politeness** — `--sleep-interval`, `--sleep-requests`, and a lower `-N` when a site throttles.
- **Authentication** — follow the cookie procedure, treat the cookie data as a secret, and delete the cookie files in the same turn the download ends.

### 5. Execute

Run the command with the URL quoted, preserving the requested output location and options. If a requested format turns out to be unavailable, report the alternatives from the `-F` list instead of silently substituting a different one, and do not widen the scope of the run.

### 6. Verify and report

Confirm the expected files exist and match the request in name, container, resolution, and subtitles — including sidecar files for subtitles or live chat. Treat leftover `.part`/`.ytdl` files as an incomplete download, not a success, and note whether `--download-archive` recorded the finished items so a re-run resumes rather than repeats. Report the output location plus anything yt-dlp printed as an error. Never claim success when the download failed or only part of a playlist was retrieved.

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

To download only selected playlist entries, use `--playlist-items`. Separate individual positions with commas and specify inclusive ranges with a hyphen:

```bash
yt-dlp -o "%(playlist)s/%(title)s.%(ext)s" \
  --yes-playlist \
  --download-archive archive.txt \
  --playlist-items 1,3,5:7 \
  "URL"
```

### Record a live stream

The live URL is recorded immediately:

```bash
yt-dlp -o "%(title)s.%(ext)s" \
  "URL"
```

If the stream has not started yet, poll it periodically until it becomes available. The range `30-300` means to wait 30 seconds for the first poll and then increase the interval up to 300 seconds:

```bash
yt-dlp -o "%(title)s.%(ext)s" \
  --wait-for-video 30-300 \
  "URL"
```

When the platform provides the stream's replay/DVR buffer, combine `--live-from-start` with `--wait-for-video` to begin waiting before the stream starts and keep the recording from the beginning. This is only supported by extractors that expose live DVR data:

```bash
yt-dlp -o "%(title)s.%(ext)s" \
  --wait-for-video 30-300 \
  --live-from-start \
  "URL"
```

To keep a separate live-chat log alongside the recording, use YouTube's `live_chat` subtitle track. Downloaded chat data is stored as a subtitle file:

```bash
yt-dlp -o "%(title)s.%(ext)s" \
  --live-from-start \
  --write-subs \
  --sub-langs live_chat \
  "URL"
```

For longer recordings, add `--download-archive archive.txt` to avoid recording the same live video again if the command is restarted:

```bash
yt-dlp -o "%(title)s.%(ext)s" \
  --download-archive archive.txt \
  --live-from-start \
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

## Best Practices by Use Case

Field-tested flag combinations, one row per recurring request. Adapt the URL and output path; keep the pattern.

| Use case | Pattern | Why it works |
| --- | --- | --- |
| Bilibili live | `-f "best[ext=flv]/best"` | Live endpoints often expose one container; pinning FLV avoids a bad pick, `/best` keeps it working when FLV is absent |
| YouTube live / long stream | `--live-from-start --download-archive archive.txt` | Records the DVR buffer from the beginning and makes a restart resume instead of duplicating |
| Quality ceiling without guessing | `-S "res:1080,codec:avc" -f "bv*+ba/b"` | Sorting downgrades gracefully instead of failing on a missing format ID |
| Playlist / channel, incremental | `--download-archive archive.txt --playlist-items 1:50 --sleep-interval 2` | Archive skips finished items, `--playlist-items` bounds the run, sleep reduces throttling |
| Lossless audio | `-x --audio-format best` | Keeps the source codec, no re-encode, fastest |
| Compatible audio | `-x --audio-format mp3 --audio-quality 0` | One broadly playable file, highest quality yt-dlp can produce for that codec |
| Bilingual subtitles | `--write-subs --write-auto-subs --sub-langs "zh.*,en.*" --embed-subs` | Explicit languages avoid downloading all 40+ tracks; embedding needs FFmpeg |
| Flaky network / long file | `-c --retries 10 --fragment-retries 10 --socket-timeout 30` | Resumes partial files and retries fragments instead of starting over |

### Live stream example

The canonical form for a Bilibili live room:

```bash
yt-dlp -f "best[ext=flv]/best" -o "%(title)s.%(ext)s" \
  "https://live.bilibili.com/4629447"
```

Add `--wait-for-video 30-300` when the room is offline, and `--download-archive archive.txt` when the command may be restarted mid-recording. See **Record a live stream** for the full option set.

### Sort instead of pinning

`-f "best[height<=1080]"` fails when no stream matches. `-S` expresses a preference and still yields a file:

```bash
yt-dlp -S "res:1080,codec:avc" -f "bv*+ba/b" \
  --merge-output-format mp4 -o "%(title)s.%(ext)s" "URL"
```

Use `-f` only when the user named an exact format ID from `-F` output.

### Authenticated sources

For X, Instagram, private or members-only videos, cookies replace the session only — keep the same format, subtitle, and output flags. Follow **Download with cookies**, then delete the cookie files as soon as the download exits.

## Troubleshooting

Diagnose before retrying. Read the error yt-dlp printed, match it in the table below, apply the fix, and retry the original command — do not escalate to cookies or format overrides that the error does not justify.

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `HTTP Error 403: Forbidden` | Stale signature/token, missing `Referer`, or expired session | Update yt-dlp, retry once, then add `--cookies cookies.txt` (see **Download with cookies**) |
| `Sign in to confirm you're not a bot` | YouTube bot check on the client | Retry with cookies from a logged-in browser |
| `Requested format is not available` | Format ID absent for this video or region | Re-run `yt-dlp -F "URL"` and pick from the list |
| `No video formats found` / `Unsupported URL` | Site changed, or URL is not a media page | Update yt-dlp; otherwise report the URL as unsupported |
| `ffmpeg not found` / postprocessing failed | FFmpeg missing, or wrong stream combined | Verify `ffmpeg -version`, re-run with `-f "bv*+ba/b"` |
| `HTTP Error 429` / `Too Many Requests` | Rate limiting or throttling | Add `--sleep-requests 1 --sleep-interval 5` and lower `-N` |
| `Private video` / `Login required` | Content needs an authenticated session | Use the cookie procedure; if it still fails, report that the account lacks access |
| Geo-restricted or `not available in your country` | Region lock | Report it; do not fake a location |
| Download stalls or times out | Network instability or slow fragments | Add `--retries 10 --fragment-retries 10` and `--socket-timeout 30` |
| Playlist stops early | One entry failed while others succeeded | Re-run with `--download-archive archive.txt` to skip finished items and retry only the failures |

### HTTP 403 Forbidden

1. **Confirm the URL itself works.** Re-run `yt-dlp -F "URL"`. A 403 on `-F` is an access problem, not a format problem.
2. **Add the referer** when the CDN rejects direct requests:

```bash
yt-dlp --referer "URL" -o "%(title)s.%(ext)s" "URL"
```

3. **Use a logged-in session** if steps 1–2 fail: follow **Download with cookies**, run the download, then delete the cookie files immediately as that procedure requires.

4. **Discard partial files** left by the failed attempt before retrying, so the retry does not resume a corrupt fragment:

```bash
rm -f *.part *.ytdl
```

### Format and merging problems

- Always resolve a format complaint from the actual `yt-dlp -F "URL"` output; never invent a format ID.
- When separate streams fail to merge, fall back to the best combined format:

```bash
-f "b"
```

- If FFmpeg is genuinely unavailable, download video and audio separately with `-f "bv"` and `-f "ba"`, or use `-f "b"` to skip merging, and tell the user the result is not the highest quality.

### Slow or throttled downloads

```bash
yt-dlp --concurrent-fragments 4 --limit-rate 5M \
  --sleep-requests 1 --retries 10 --fragment-retries 10 \
  -o "%(title)s.%(ext)s" "URL"
```

Lower `--concurrent-fragments` (or `-N`) when a site throttles parallel requests, and raise `--sleep-interval` between playlist entries.

### Tool is out of date

Most extractor breakage is fixed by an update. Check and update before deeper debugging:

```bash
yt-dlp -U
```

If `-U` is unavailable (package-managed install), update through the user's package manager instead and report which method was used.

### Reporting a failure

When none of the above works, report: the exact command used, the error line yt-dlp printed, the `yt-dlp --version` output, and what was already tried. Do not silently fall back to a lower quality, a different site, or a partial playlist, and never claim a download succeeded unless the expected files exist.

