---
name: yt-dlp
description: >
  Download video, audio, subtitles, and metadata from YouTube, Bilibili, TikTok, X, Instagram, and 1800+ other sites using yt-dlp. Use when the user provides a media URL and wants to download it, extract audio, fetch subtitles, probe available formats, or pull metadata. Also use for playlist/channel batch downloads, cookie-authenticated content, and fixing yt-dlp 403 errors. Not for local media file conversion.
---

yt-dlp is a command-line audio/video downloader supporting 1800+ sites. This skill guides the agent to pick the right format, run the download, handle authentication, and troubleshoot failures in priority order when the user provides a media URL.

# yt-dlp

## Overview

The failure mode to avoid is guessing. Almost every yt-dlp problem comes from one of three things: an invented format ID, a stale binary, or missing authentication. Probe first, download second, verify third.

## Core Loop

```
1. Identify   → what did the user actually ask for? (file? audio? subs? just metadata?)
2. Probe      → yt-dlp -F / -J / --list-subs   (never invent format IDs)
3. Download   → -f expression or -S sorting, plus the post-processing flags
4. Verify     → the file exists, has non-zero size, and ffprobe sees the expected streams
```

Skip step 2 only for trivial cases (`-f best` on a known-good site). Never skip step 4.

## Environment Check

Before a long or failing download, confirm what you are working with:

```bash
yt-dlp --version
which ffmpeg ffprobe        # required for merging, audio extraction, subtitles conversion
```

- Installing via Homebrew means `-U` will not self-update: use `brew upgrade yt-dlp`.
- pip/pipx installs: `python -m pip install -U yt-dlp` (or `pipx upgrade yt-dlp`).
- ffmpeg is required whenever you merge separate video+audio streams, use `-x`, `--embed-subs`, `--embed-thumbnail`, or `--download-sections`. Without it, use `-f b` (pre-muxed best) instead of `-f bv*+ba`.

## Probe Before Downloading

```bash
yt-dlp -F "$URL"                            # available formats, codecs, sizes
yt-dlp -J "$URL" | jq '.title, .duration, .formats | length'
yt-dlp --print "%(id)s %(title)s %(duration>%H:%M:%S)s" "$URL"
yt-dlp --list-subs "$URL"                    # manual + auto subtitle languages
yt-dlp --list-impersonate-targets            # clients available for --impersonate
```

`-F`/`-J` and `--print` simulate by default, so they download nothing. Add `--no-simulate` when you want the real file too.

## Format Selection

Prefer `-S` (sorting) over hard-coded IDs. Sorting survives format churn; an exact ID like `137+140` breaks the moment the site changes.

```bash
# Default: merged best video + best audio, falls back to pre-muxed
-f "bv*+ba/b"

# Cap resolution, prefer mp4-compatible codecs
-f "bv*[height<=1080]+ba/b[height<=1080]" -S "vcodec:h264,acodec:aac" --merge-output-format mp4

# Best quality regardless of size, prefer HDR-free, high fps
-S "res:2160,fps,hdr:12,codec:av01"

# Smallest acceptable file
-f "bv*[height<=720]+ba/b[height<=720]" -S "+size"

# Single pre-muxed file, no ffmpeg needed
-f b
```

Notes:
- `-f` grammar: `*` = best, `/` = fallback chain, `[]` = filter, `+` = merge. `bv*` = best video-only, `ba` = best audio-only, `b` = best pre-muxed.
- `-S` fields worth knowing: `res`, `fps`, `hdr`, `codec`, `vcodec`, `acodec`, `ext`, `br`, `size`, `lang`, `proto`. Prefix with `+` for ascending (smallest first) and `-` to demote.
- `--merge-output-format mp4` only chooses the container; if the codecs are incompatible the merge fails. Constrain codecs with `-S` instead of forcing the container.
- To confirm the pick without downloading: `-f "<expr>" --print "%(format_id)s %(ext)s %(vcodec)s %(acodec)s"`.
- `--check-formats` verifies the chosen formats are actually downloadable before committing to a big download.

## Recipes

### Video, sensible default

```bash
yt-dlp -f "bv*+ba/b" --merge-output-format mp4 \
  -o "%(uploader)s/%(upload_date>%Y-%m-%d)s - %(title).150B [%(id)s].%(ext)s" \
  "$URL"
```

### Audio only

```bash
yt-dlp -x --audio-format mp3 --audio-quality 0 --embed-metadata --embed-thumbnail "$URL"
```

`-x` extracts with ffmpeg; `--audio-quality 0` is best VBR (`5` is default, `128K` forces CBR). Use `--audio-format opus` for lossless-of-source quality with smaller files, `flac` only when the source is lossless.

### Subtitles

```bash
# Download + convert to srt
yt-dlp --write-subs --sub-langs "en.*,zh-Hans" --convert-subs srt --skip-download "$URL"

# Burn-in-ready muxed file
yt-dlp -f "bv*+ba/b" --write-subs --write-auto-subs --sub-langs "en.*" \
  --embed-subs --merge-output-format mkv "$URL"
```

- Auto-generated captions need `--write-auto-subs`; `--write-subs` alone returns only human-made ones.
- `--sub-langs` accepts regex and exclusions: `"all,-live_chat"`.
- `--embed-subs` only works in mp4/mkv/webm; prefer mkv when subtitle formats vary.

### Metadata only (no media)

```bash
yt-dlp -J "$URL" > meta.json
yt-dlp --skip-download --write-info-json --write-thumbnail --convert-thumbnails jpg "$URL"
```

### Clip a time range

```bash
yt-dlp --download-sections "*00:02:15-00:03:40" -f "bv*+ba/b" "$URL"
```

Multiple `--download-sections` are allowed; the format is `*START-END` and values accept `mm:ss`, `hh:mm:ss`, or `inf`.

### Playlist or channel

```bash
# List first, then decide
yt-dlp --flat-playlist --print "%(playlist_index)s %(id)s %(title)s" "$URL"

# Download a slice, resumable, skipping already-fetched items
yt-dlp -I "1:20" --lazy-playlist --download-archive archive.txt \
  -o "%(playlist_title)s/%(playlist_index)03d - %(title).120B [%(id)s].%(ext)s" "$URL"
```

- `--flat-playlist` reads the listing page only: fast, but titles may be truncated and no formats are resolved.
- `--lazy-playlist` processes entries as they arrive, so `-I`/`--playlist-end` avoid fetching the entire index of a 5000-video channel.
- `--download-archive` is the correct way to make a batch job re-runnable; it appends one ID per finished item.
- `--break-on-existing` stops the whole run at the first archived item (good for feeds ordered newest-first).
- `--no-playlist` forces a single video when a URL contains both a video and a playlist parameter.

## Output Naming

Templates use `%(field)s`; format specifiers work inside them (`%(playlist_index)03d`, `%(upload_date>%Y-%m-%d)s`, `%(title).100B` to truncate by bytes).

```bash
-o "%(extractor)s/%(uploader)s/%(title)s [%(id)s].%(ext)s"
-P "home:~/Downloads/yt" -P "temp:/tmp/yt"      # final destination vs. intermediate files
--restrict-filenames                             # ASCII-safe: no spaces or unicode
--windows-filenames                              # portable across filesystems
```

Keep `[%(id)s]` in the template. Almost every duplicate-overwrite or "which file was that" problem disappears once the site ID is in the filename.

## Authentication

Try these in order when a site demands a login:

```bash
yt-dlp --cookies-from-browser chrome "$URL"          # most reliable; browser must be closed on some OSes
yt-dlp --cookies-from-browser firefox:default "$URL"
yt-dlp --cookies cookies.txt "$URL"                  # Netscape-format export
yt-dlp --username U --password P "$URL"              # sites with native login
yt-dlp --netrc "$URL"
```

- Prefer `--cookies-from-browser` over exporting a cookies file: no stale file to leak or forget.
- Never print cookie contents, and never commit `cookies.txt`.
- Age-restricted or members-only content usually needs cookies plus a logged-in account with access.

## Politeness and Reliability

```bash
-N 4                          # parallel fragments (default 1); 4 is a safe ceiling
-r 5M                         # cap bandwidth
--sleep-requests 1.5          # gap between metadata requests
--sleep-interval 3            # gap between video downloads
--retries 10 --fragment-retries 10 --extractor-retries 3
```

Higher `-N` speeds up DASH/HLS downloads but raises the chance of 403s and rate limits. If a download starts failing partway through, drop `-N` to 1 before trying anything else.

## Troubleshooting

Work top-down. Most rows are fixed by the first two actions.

| Symptom | Action |
| --- | --- |
| `HTTP Error 403`, `Sign in to confirm you're not a bot` | Update yt-dlp first (`brew upgrade yt-dlp` / pip). Then `--cookies-from-browser chrome`. Then `--impersonate chrome`. Then reduce `-N 1`. |
| `Requested format is not available` | Re-run `-F` and use what exists. Replace exact IDs with `-S "res:1080"`. |
| `Unable to extract ...` / extractor broken | Update yt-dlp; the site changed. If still broken, report it rather than patching regexes blindly. |
| `HTTP Error 429` / throttling | `-N 1 -r 2M --sleep-requests 3 --sleep-interval 5`. Retry later. |
| Download stalls at 100% of a fragment | `--concurrent-fragments 1`, `--fragment-retries 10`, then `--no-part`. |
| `ffmpeg not found` / merge fails | Install ffmpeg, or avoid merging with `-f b`. |
| `DRM protected` / encrypted streams | Not supported. Stop and tell the user; do not attempt to work around it. |
| Geo-restricted | `--xff US` (or the relevant country code), or a proxy via `--proxy`. |
| Certificate/SSL errors | Check proxy and system time; `--no-check-certificates` only as a last resort. |
| Livestream not starting | `--live-from-start`, or `--wait-for-video 30` for scheduled streams. |
| Whole channel queued unexpectedly | Add `--no-playlist`, or `-I 1`. |

For YouTube's ever-changing bot checks and PO tokens, the authoritative source is the yt-dlp wiki (YouTube PO Token Guide and the extractor-args documentation). Read it rather than hard-coding a `player_client` value from memory — those values rot in weeks.

```bash
yt-dlp --extractor-args "youtube:player_client=default,web_safari" "$URL"   # example only; verify current advice
```

## Verify the Result

```bash
ls -lh out/...                                   # non-zero size, expected extension
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height \
  -of compact "$FILE"
```

State plainly what was produced: path, container, resolution, duration, and whether audio/subs are embedded. If the user asked for something that could not be delivered (DRM, missing language, region lock), say so explicitly instead of silently substituting.

## Rules

- Do not invent format IDs, output templates, or flag names. If unsure, run `yt-dlp -h` or `yt-dlp -F`.
- Do not claim to bypass DRM, paywalls, or access controls. Cookies for accounts the user legitimately owns are fine; credential theft is not.
- Do not download to a location the sandbox forbids. Default to the current project directory or a user-specified path.
- Respect site terms and copyright; flag clearly when a request looks like bulk redistribution.
- Report the exact failing command and error text when escalating, not a paraphrase.
