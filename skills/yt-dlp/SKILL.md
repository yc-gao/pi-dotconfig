---
name: yt-dlp
description: >
  Download video, audio, subtitles, live chat, and live streams from YouTube, Bilibili, TikTok, X, Instagram, and more than 1,800 other sites with yt-dlp.
  Use this skill when the user gives a media page URL and wants to: inspect formats or playlist entries before downloading; download video, using a size ceiling or codec preference instead of a guessed format ID; extract audio, lossless or as MP3; fetch, select by language, or embed subtitles and live chat; download a whole or partial playlist/channel, incrementally; record a live stream, including from the start of the DVR buffer; use cookies for members-only, private, or login-required content; resume, retry, or rate-limit a download that stalled or failed with HTTP 403/429; or update yt-dlp when a site stops working.
  This skill is not intended for converting, trimming, remuxing, or re-encoding media that already exists on disk; use the ffmpeg skill for those.
---

# yt-dlp

Download media from 1,800+ sites, including whole playlists and channels, live capture from the DVR buffer, and content that needs a logged-in session. Converting, trimming, and remuxing files that already exist on disk belongs to the `ffmpeg` skill; yt-dlp calls FFmpeg only to merge and post-process.

## Workflow

1. **Check prerequisites.** `which yt-dlp && which ffmpeg || exit 1`. If either is missing, stop before inspecting or downloading anything.
2. **Classify.** Decide what to deliver (video, audio, subtitles, live chat, live stream, collection) and the constraints named (quality or codec, audio format, subtitle languages, output location). Ask only when an unclear choice changes the result — for example a URL that could mean either the playlist or a single entry.
3. **Inspect only when the answer depends on it.** For a named quality or format, or unclear options, look up the source's real capabilities first. Prefer stating a preference over pinning an option ID, keep the default when nothing was requested, and bound a large collection before extracting it.
4. **Build and run a single command** from **Common Operations**, applying **Best Practices by Use Case** where relevant. Keep the requested output path and options, download a full playlist or channel only when asked, and treat cookie data as a secret.
5. **Verify and report.** Confirm the expected files exist and are complete; leftover `.part` files mean an incomplete download. Report the output location and any error the tool printed, and never claim success for a failed or partial run. If a requested choice is unavailable, report the alternatives instead of silently substituting one.

## Common Operations

Each operation is a single command to adapt: keep the URL quoted, keep `-o` pointing at the requested location, and add options only when needed. Options appear as `-s, --long-name` (equivalent spellings; most boolean flags have a `--no-` form that restores the default), and text in square brackets after an option name is an optional part of its argument, not literal input.

### Inspect available formats

```bash
yt-dlp -F "URL"                        # format table for one video
yt-dlp --flat-playlist -F "URL"        # entries only, no per-video metadata
```

**Options**

- `-F, --list-formats` — print the format table (ID, extension, resolution, codecs, bitrate, size) and exit. IDs from this table are the only safe input for `-f`.
- `--flat-playlist` — list entries without extracting each video's metadata: fast on large collections, some fields missing, no media downloaded. The default `--no-flat-playlist` fully extracts every entry.

### Download video

The output filename is based on the video's title in every case.

```bash
yt-dlp -o "%(title)s.%(ext)s" "URL"                                    # default selection
yt-dlp -o "%(title)s.%(ext)s" -f "bv*+ba/b" "URL"                      # best video + best audio
yt-dlp -o "%(title)s.%(ext)s" -S "res:1080,codec:avc,ext:mp4" "URL"    # ranked preference
```

**Options**

- `-o, --output [TYPES:]TEMPLATE` — filename template filled from metadata (`%(title)s`, `%(id)s`, `%(ext)s`, `%(playlist)s`, `%(upload_date)s`); keep `%(ext)s` last so the real extension wins. Missing directories are created.
- `-f, --format FORMAT` — selection expression, not a single ID: `bv*` best video (may include audio), `ba` best audio, `+` merge with FFmpeg, `/` fallback, `b` best combined stream.
- `-S, --format-sort SORTORDER` — ordered sort keys, optionally capped (`res:1080`, `codec:avc`, `ext:mp4`). Sorting is a preference, so a file is still produced when the top choice is absent.

### Download subtitles

List the available tracks first when the language codes are unknown:

```bash
yt-dlp --list-subs "URL"
yt-dlp -o "%(title)s.%(ext)s" \
  --write-subs --write-auto-subs --sub-langs all --skip-download "URL"
```

**Options**

- `--list-subs` — print creator and automatic tracks with their codes, formats, and names, then exit; a preview only. Re-run it after changing `--sub-langs` or the site options if the output looks incomplete.
- `--write-subs` — save creator-provided tracks.
- `--write-auto-subs` — machine-generated tracks only.
- `--sub-langs LANGS` — `all`, a comma-separated list, or patterns such as `zh.*,en.*`.
- `--skip-download` — write only auxiliary files (subtitles, thumbnails, metadata), no media.

### Extract audio

```bash
yt-dlp -o "%(title)s.%(ext)s" -x --audio-format mp3 --audio-quality 0 "URL"
```

**Options**

- `-x, --extract-audio` — post-process into an audio-only file; requires FFmpeg and ffprobe.
- `--audio-format FORMAT` — `best` keeps the source codec without re-encoding; `mp3`, `m4a`, `opus`, `flac`, and `wav` re-encode.
- `--audio-quality QUALITY` — `0` best to `10` worst for VBR targets, or an explicit bitrate such as `192K`; default `5`.

### Download a playlist

Save each video under a subdirectory named after the playlist and record finished items in `archive.txt` so later runs skip them. Add `--playlist-items` when only some entries are wanted, separating positions with commas and using `START:STOP:STEP` ranges:

```bash
yt-dlp -o "%(playlist)s/%(title)s.%(ext)s" \
  --yes-playlist --download-archive archive.txt \
  "URL"

yt-dlp -o "%(playlist)s/%(title)s.%(ext)s" \
  --yes-playlist --download-archive archive.txt \
  --playlist-items 1,3,5:7 \
  "URL"
```

**Options**

- `--yes-playlist` / `--no-playlist` — decide the scope when a URL refers to both a video and a playlist.
- `--download-archive FILE` — record finished item IDs and skip them later; delete the file to allow a re-download.
- `-I, --playlist-items ITEM_SPEC` — comma-separated positions and `START:STOP:STEP` ranges, with negative indices counting from the end (for example `1:3,7,-5::2`).

### Record a live stream

Record until the stream ends, keeping the run restartable through `archive.txt`. Add `--write-subs --sub-langs live_chat` to save the chat next to the recording, and drop it when the chat is unwanted:

```bash
yt-dlp -o "%(title)s.%(ext)s" \
  --download-archive archive.txt --wait-for-video 30-300 \
  "URL"
```

Record a stream already in flight from the beginning of the platform's DVR buffer:

```bash
yt-dlp -o "%(title)s.%(ext)s" \
  --download-archive archive.txt --live-from-start \
  "URL"
```

**Options**

- `--wait-for-video MIN[-MAX]` — poll for a scheduled stream, waiting `MIN` seconds and backing off to `MAX` (a single value fixes the interval); without it the command gives up immediately on an offline room. Leave it out when the stream is already live.
- `--live-from-start` — start at the beginning of the DVR buffer. Experimental and limited to a few extractors (YouTube, Twitch, TVer, mellow-fan); elsewhere yt-dlp warns and records from the current moment, so check the log line before trusting the output.
- `--write-subs` with `--sub-langs live_chat` — save live chat as a subtitle file; on busy streams it grows continuously and can outgrow the video.
- `--download-archive FILE` — keep long recordings restartable by skipping a video already recorded.
- Ctrl-C ends the recording and a live capture cannot be resumed, so the file is complete only when yt-dlp exits on its own; delete leftover `.part` files before starting over.

The recording runs in the foreground and prints progress until the stream ends: announce the output path before starting, and report the file size and duration when it exits.

## Download with cookies

Some content resolves only inside an authenticated session, and yt-dlp sees that session only through cookies. There are two ways to hand them over; which one to use is the user's decision, not yours.

| Method | What yt-dlp receives | Use it when |
| --- | --- | --- |
| A. Paste the `Cookie` header | The cookies the user copied out, for one site | Default. The user wants to expose nothing beyond that site |
| B. `--cookies-from-browser` | Every cookie in the browser profile the user names | The user cannot copy a header, or one run spans several sites |

**Ask before touching any cookie source.** Cookies are the user's live session and unlock everything the account can reach, so state which error made authentication necessary and use `ask_user` (type `single`) to let the user pick A or B. Never choose for them, never open a browser profile or request a header before their answer, never switch methods on your own when the chosen one fails, and never echo cookie data into a command line or a log.

### A. Paste the `Cookie` header

The narrowest option: only what the user copies is exposed, and only for the site they copied from.

1. **Collect the header** with `generate_file_from_input` into a private temporary file such as `cookie-header.txt`, confirming the cookie domain with the user if it is unclear.
2. **Convert it to Netscape format**, passing the real cookie domain instead of a placeholder, and write the result to a private location:

```bash
# Converter shipped with this skill, resolved against this SKILL.md's directory.
python3 scripts/cookies_from_string.py \
  --domain .example.com --output cookies.txt \
  < cookie-header.txt
```

3. **Pass the file to yt-dlp:** `yt-dlp --cookies cookies.txt "URL"`
4. **Delete the files the moment the run ends** — mandatory, not optional cleanup. Once yt-dlp exits, success or failure, remove every cookie file this procedure created in the same turn (`rm -f cookies.txt cookie-header.txt`, adjusting for the exact paths), confirm the deletion to the user, and never display either file's contents or keep them for a retry. A retry means repeating the whole procedure with a freshly copied header.

**Options**

- `--cookies FILE` — read cookies from a Netscape-format file and write the refreshed jar back to the same file, so it is both input and state; it carries only the pasted cookies, which keeps this path scoped to one site.

### B. Use `--cookies-from-browser`

yt-dlp decrypts cookies directly from a browser profile, so nothing is written to disk and there is nothing to clean up — but the whole profile's jar is read, not just one site's. State that before running it, and prefer a profile the user keeps only for this site over their everyday one.

1. **Confirm the source:** which browser, and which profile or container, then pass exactly what the user names — do not guess a profile or read a browser they did not choose.
2. **Make sure that profile is signed in;** a logged-out profile yields an empty jar and the same login wall.
3. **Run yt-dlp with the browser specified:**

```bash
yt-dlp --cookies-from-browser firefox "URL"

# Named Chromium profile, Firefox container, Chromium keyring on Linux
yt-dlp --cookies-from-browser "chrome:Profile 2" "URL"
yt-dlp --cookies-from-browser "firefox::work" "URL"
yt-dlp --cookies-from-browser "chrome+gnomekeyring" "URL"
```

4. **Report what was used** — browser, profile, container. If the run still hits a login wall, report that the profile lacks access; do not fall back to method A.

**Options**

- `--cookies-from-browser BROWSER[+KEYRING][:PROFILE][::CONTAINER]` — `BROWSER` is one of `brave`, `chrome`, `chromium`, `edge`, `firefox`, `opera`, `safari`, `vivaldi`, `whale`; `:PROFILE` names or paths a profile; `::CONTAINER` selects a Firefox container (`::none` for the default); `+KEYRING` picks the Linux keyring used to decrypt Chromium cookies. Do not combine it with `--cookies` in one command.
- Chromium-family browsers may raise an OS Keychain or password prompt: the user has to approve it — never work around the prompt or ask for the password. If the cookie database is reported locked or uncopyable, quit the browser completely, background processes included, and retry. Safari on macOS needs Full Disk Access for the terminal running yt-dlp; report that requirement instead of working around it.

## Best Practices by Use Case

Field-tested combinations for sites where the defaults are not enough. Adapt the URL and output path; keep the pattern.

| Site | Pattern | Why it works |
| --- | --- | --- |
| Bilibili live | `-f "best[ext=flv]/best"` | Live endpoints often expose one container; pinning FLV avoids a bad pick, `/best` keeps it working when FLV is absent |
| YouTube live / long stream | `--live-from-start --download-archive archive.txt` | Records the DVR buffer from the beginning and makes a restart resume instead of duplicating |

## Troubleshooting

Match the error line yt-dlp printed to one entry, apply that entry's fix, and retry the original command once. Fix only what the error names, and work through the entries in order instead of jumping to cookies or another format.

- **`HTTP Error 403: Forbidden`** — stale signature, missing `Referer`, or expired session. Update yt-dlp and retry once, then add `--referer "URL"`, then use **Download with cookies** (ask which method first). Clear leftovers first: `rm -f *.part *.ytdl`.
- **`Sign in to confirm you're not a bot` / `... your age`** — bot or age gate. Use **Download with cookies** once (ask which method first); repeated anonymous retries make it worse.
- **`Private video` / `Login required` / members-only message** — needs an authenticated session. Use **Download with cookies**; if it still fails, report that the account lacks access instead of retrying.
- **`HTTP Error 429: Too Many Requests`** — rate limited. Slow down with `--sleep-requests 1 --sleep-interval 5 -N 2` and retry later.
- **`Requested format is not available`** — that ID does not exist for this video. Re-run `yt-dlp -F "URL"` and pick from the real list, or drop to `-f "bv*+ba/b"`; never invent a format ID.
- **Stalls, `Read timed out`, `Unable to download fragment`** — network instability or throttling. Retry with `--retries 10 --fragment-retries 10 --socket-timeout 30 --concurrent-fragments 1`, and lower `-N` when the site throttles parallel requests.
- **Destination already exists** — a stale or partial file is in the way. Remove it and retry; `--force-overwrites` overwrites, `--no-overwrites` keeps the existing file and skips the item.
- **Playlist stops after a few entries** — one entry failed while others succeeded. Re-run the same command with `--download-archive archive.txt` to skip finished items, and list the entries that still fail.
- **Live: `This live event will begin in ...` / `Premieres in ...`** — the room is not live yet. Add `--wait-for-video 30-300`; if `--live-from-start` printed a fallback warning, report that recording starts from the current moment.
- **Interrupted recording (Ctrl-C) or leftover `.part`** — a live capture cannot be resumed. Delete the `.part` file and start a new recording, stating how much was lost.

When no entry fixes it, stop and report instead of trying more commands: the exact command, the error line yt-dlp printed, `yt-dlp --version`, and which entries were already tried. Never claim success unless the expected files exist and are complete, and never substitute a different site, a lower quality, or a partial playlist without saying so.
