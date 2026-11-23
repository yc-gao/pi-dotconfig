---
name: yt-dlp
description: >
  Download video, audio, subtitles, live chat, and live streams from YouTube, Bilibili, TikTok, X, Instagram, and more than 1,800 other sites with yt-dlp.
  Use this skill when the user gives a media page URL and wants to: inspect formats or playlist entries before downloading; download video, using a size ceiling or codec preference instead of a guessed format ID; extract audio, lossless or as MP3; fetch, select by language, or embed subtitles and live chat; download a whole or partial playlist/channel, incrementally; record a live stream, including from the start of the DVR buffer; use cookies for members-only, private, or login-required content; resume, retry, or rate-limit a download that stalled or failed with HTTP 403/429; or update yt-dlp when a site stops working.
  This skill is not intended for converting, trimming, remuxing, or re-encoding media that already exists on disk; use the ffmpeg skill for those.
---

# yt-dlp

Download video, audio, subtitles, live chat, and live streams from YouTube, Bilibili, TikTok, X, Instagram, and 1,800+ other sites with `yt-dlp` — including whole playlists and channels, live capture from the start of the DVR buffer, and content that needs a logged-in session — while leaving conversion, trimming, and remuxing of media already on disk to the `ffmpeg` skill.

## When to use

Trigger this skill when the request starts from a **media page URL** and the user wants to:

- Inspect available formats, or list playlist/channel entries, before downloading
- Download video, with a quality, codec, or size preference
- Extract audio, either lossless or converted to MP3/M4A/Opus
- Fetch subtitles or live chat, optionally embedding them in the file
- Download a whole or partial playlist or channel, incrementally across runs
- Record a live stream, including from the start of the DVR buffer
- Access members-only, private, or login-required content with cookies
- Recover a download that stalled or failed with HTTP 403/429
- Update `yt-dlp` when a site suddenly stops working

**Out of scope:** converting, trimming, remuxing, or re-encoding media that already exists on disk, and inspecting local files. Point those to the `ffmpeg` skill; `yt-dlp` uses FFmpeg only as its merge and post-processing backend.

## Core Workflow

### 1. Classify the request

Identify what to deliver (video, audio, subtitles, live chat, live stream, or a collection) and the constraints the user named (quality or codec, audio format, subtitle languages, output location). Ask a follow-up only when an unclear choice would materially change the result — for example a URL that could mean either the whole playlist or a single entry.

### 2. Check prerequisites

Before any operation, check that both `yt-dlp` and `ffmpeg` are available:

```bash
which yt-dlp && which ffmpeg || exit 1
```

If either command is missing, stop immediately without inspecting or downloading media.

### 3. Inspect only when the answer depends on it

When a quality or format is named, or the available options are unclear, look up the source's real capabilities first. Prefer stating a preference over pinning an exact option, keep the tool's default when nothing was requested, and bound a large collection before extracting everything in it.

### 4. Build the command

Start from the matching operation in **Common Operations**, then apply the site-specific preferences in **Best Practices by Use Case** when the request targets one of those sites: repeatability, scope, robustness, politeness, and authentication. A playlist or channel is downloaded in full only when the user asks for it, and cookie data is treated as a secret.

### 5. Execute

Run a single invocation, keeping the requested output location and options. If a requested choice turns out to be unavailable, report the alternatives instead of silently substituting one, and do not widen the scope of the run.

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
  -f "bv*+ba/b" \
  "URL"
```

Rank formats by preference instead of pinning a format ID, so the run still yields the closest match when the top choice is missing:

```bash
yt-dlp -o "%(title)s.%(ext)s" \
  -S "res:1080,codec:avc,ext:mp4" \
  "URL"
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

If the language codes are unknown, list the available tracks first:

```bash
yt-dlp --list-subs "URL"
```

`--list-subs` is a preview only: it prints the creator and automatic tracks with their language codes, formats, and names, and downloads nothing. Use the codes it prints in `--sub-langs`; run it again after changing `--sub-langs` or the site options if the output looks incomplete.

Download all available creator-provided subtitles as separate files without downloading the media:

```bash
yt-dlp -o "%(title)s.%(ext)s" \
  --write-auto-subs --write-subs --sub-langs all --skip-download \
  "URL"
```

**Options**

- `--list-subs` — print the available subtitle tracks and exit without downloading anything; a preview step, not a download.
- `--write-subs` — save creator-provided subtitle tracks; add `--write-auto-subs` to include machine-generated ones.
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
  --write-subs --sub-langs live_chat \
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

Some content only resolves inside an authenticated session, and yt-dlp can only see that session through cookies. There are two ways to hand them over; which one to use is the user's decision, not yours.

| Method | What yt-dlp receives | Use it when |
| --- | --- | --- |
| A. Paste the `Cookie` header | The cookies the user copied out, for one site | Default. The user wants to expose nothing beyond that site |
| B. `--cookies-from-browser` | Every cookie in the browser profile the user names | The user cannot copy a header, or one run spans several sites |

**Ask before touching any cookie source.** Cookies are the user's live session and unlock everything the account can reach, so state which error made authentication necessary and use `ask_user` (type `single`) to let the user pick A or B. Never choose for them, never open a browser profile or request a header before their answer, and never switch methods on your own when the chosen one fails — stop and ask again. Whatever the method, treat cookie data as a secret: never echo it into a command line or a log.

#### A. Paste the `Cookie` header

The narrowest option: only what the user copies is exposed, and only for the site they copied from.

1. **Collect the header.** Use `generate_file_from_input` to save the site's `Cookie` request header to a private temporary file such as `cookie-header.txt`. Ask the user to confirm the cookie domain if it is unclear.
2. **Convert it to Netscape format.** Feed the header file to the converter on standard input, replacing `.example.com` with the real cookie domain rather than a placeholder, and write the result to a private location:

```bash
# Run the converter shipped with this skill (scripts/cookies_from_string.py, resolved against this SKILL.md's directory).
python3 scripts/cookies_from_string.py \
  --domain .example.com \
  --output cookies.txt \
  < cookie-header.txt
```

3. **Pass the file to yt-dlp:**

```bash
yt-dlp --cookies cookies.txt "URL"
```

4. **Delete the files the moment the run ends.** This is mandatory, not optional cleanup. Once yt-dlp exits — success or failure — remove every cookie file this procedure created in the same turn, delete the exact paths if they differ from the ones below, and confirm the deletion to the user. Never display either file's contents, and never keep them around for a retry: a retry means repeating the whole procedure with a freshly copied `Cookie` header.

```bash
rm -f cookies.txt cookie-header.txt
```

**Options**

- `--cookies FILE` — read cookies from a Netscape-format file and write the refreshed jar back to that same file, so the file is both input and state. It carries only the cookies the user pasted, which is why this path stays scoped to one site.

#### B. Use `--cookies-from-browser`

Here yt-dlp decrypts the cookies directly from a browser profile, so nothing is written to disk and there is nothing to clean up afterwards. The trade-off is scope: the whole profile's cookie jar is read, not just one site's. State that before running it, and when the user has a profile they keep only for this site, use that one instead of their everyday browsing profile.

1. **Confirm the source.** Ask which browser, and which profile or container, then pass exactly what the user names. Do not guess a profile and do not read a browser they did not choose.
2. **Make sure that profile is signed in.** The session must already exist in that browser; a logged-out profile yields an empty jar and the same login wall as before.
3. **Run yt-dlp with the browser specified:**

```bash
yt-dlp --cookies-from-browser firefox "URL"
```

```bash
# Named Chromium profile, Firefox container, Chromium keyring on Linux
yt-dlp --cookies-from-browser "chrome:Profile 2" "URL"
yt-dlp --cookies-from-browser "firefox::work" "URL"
yt-dlp --cookies-from-browser "chrome+gnomekeyring" "URL"
```

4. **Report what was used** — browser, profile, and container — so the user knows where the session came from. If the run still hits a login wall, report that the profile lacks access; do not quietly fall back to method A.

**Options**

- `--cookies-from-browser BROWSER[+KEYRING][:PROFILE][::CONTAINER]` — `BROWSER` is one of `brave`, `chrome`, `chromium`, `edge`, `firefox`, `opera`, `safari`, `vivaldi`, `whale`; `:PROFILE` names or paths a profile; `::CONTAINER` selects a Firefox container (`::none` for the default one); `+KEYRING` picks the Linux keyring used to decrypt Chromium cookies. Do not combine it with `--cookies` in the same command.
- Chromium-family browsers may raise an OS Keychain or password prompt while decrypting. The user has to approve it — never work around the prompt or ask for the password.
- If yt-dlp reports that the cookie database is locked or cannot be copied, quit the browser completely, background processes included, and retry.
- Safari on macOS requires Full Disk Access for the terminal running yt-dlp. Report that requirement instead of attempting a workaround.

## Best Practices by Use Case

Field-tested flag combinations for the sites where yt-dlp's defaults are not enough. Adapt the URL and output path; keep the pattern.

| Site | Pattern | Why it works |
| --- | --- | --- |
| Bilibili live | `-f "best[ext=flv]/best"` | Live endpoints often expose one container; pinning FLV avoids a bad pick, `/best` keeps it working when FLV is absent |
| YouTube live / long stream | `--live-from-start --download-archive archive.txt` | Records the DVR buffer from the beginning and makes a restart resume instead of duplicating |

## Troubleshooting

Match the error line yt-dlp printed to one entry below, apply that entry's fix, and retry the original command once. Fix only what the error names, and work through the entries in order instead of jumping to cookies or a different format.

- **`HTTP Error 403: Forbidden`** — stale signature, missing `Referer`, or an expired session. Update yt-dlp and retry once, then add `--referer "URL"`, then use **Download with cookies** (ask the user which method first). Clear leftovers from the failed attempt first: `rm -f *.part *.ytdl`.
- **`Sign in to confirm you're not a bot` / `Sign in to confirm your age`** — bot or age gate. Use **Download with cookies** once (ask the user which method first); repeated anonymous retries make it worse.
- **`Private video` / `Login required` / members-only message** — the content needs an authenticated session. Use **Download with cookies**; if it still fails, report that the account lacks access instead of retrying.
- **`HTTP Error 429: Too Many Requests`** — rate limited. Slow the run down with `--sleep-requests 1 --sleep-interval 5 -N 2` and retry later rather than immediately.
- **`Requested format is not available`** — that ID does not exist for this video. Re-run `yt-dlp -F "URL"` and pick from the real list, or drop to `-f "bv*+ba/b"`; never invent a format ID.
- **Stalls, `Read timed out`, `Unable to download fragment`** — network instability or throttling. Retry with `--retries 10 --fragment-retries 10 --socket-timeout 30 --concurrent-fragments 1`, and lower `-N` when the site throttles parallel requests.
- **Destination already exists** — a stale or partial file is in the way. Remove it and retry; `--force-overwrites` overwrites, `--no-overwrites` keeps the existing file and skips the item.
- **Playlist stops after a few entries** — one entry failed while others succeeded. Re-run the same command with `--download-archive archive.txt` to skip finished items, retry only the failures, and list the entries that still fail.
- **Live: `This live event will begin in ...` / `Premieres in ...`** — the room is not live yet. Add `--wait-for-video 30-300`; if `--live-from-start` printed a fallback warning, the recording starts from the current moment, so report that.
- **Interrupted recording (Ctrl-C) or leftover `.part` file** — a live capture cannot be resumed. Delete the `.part` file and start a new recording, stating how much was lost.


### When no entry fixes it

Stop and report the failure instead of trying more commands: the exact command, the error line yt-dlp printed, the `yt-dlp --version` output, and which entries above were already tried. Never claim a download succeeded unless the expected files exist and are complete, and never substitute a different site, a lower quality, or a partial playlist without saying so.
