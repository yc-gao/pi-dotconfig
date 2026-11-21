---
name: ffmpeg
description: >
  Guide to using FFmpeg and ffprobe to inspect, convert, remux, encode, resize, trim, and concatenate media; extract frames or audio; select streams; and adjust audio volume.
  Use when performing common video or audio processing tasks.
  This skill is not intended for downloading media from a URL; use the yt-dlp skill for that.
---

# ffmpeg

Inspect, convert, remux, encode, resize, trim, concatenate, and filter media files with FFmpeg and `ffprobe` — reading real stream properties before choosing options, copying streams instead of re-encoding when the container allows it, and writing every result to a new file — running one `ffmpeg` invocation per operation with quoted paths, preferring `-n` over silent overwrites, and leaving network downloads to the `yt-dlp` skill.

## When to use

Trigger this skill when the request targets a **media file that already exists on disk** and the user wants to:

- Inspect a file's containers, streams, codecs, or duration
- Convert to another container, or re-encode video and audio
- Resize, trim, or concatenate clips, or grab a still frame
- Extract, convert, or remaster audio, including volume changes
- Pick specific video or audio tracks from a file

**Out of scope:** fetching media from a URL, subtitles, playlists, and live capture. Point those to the `yt-dlp` skill; FFmpeg is only needed there as its merge and post-processing backend.

## Core Workflow

1. **Classify** — inspection (`ffprobe`) or processing (`ffmpeg`), and what the result must be: container swap, re-encode, extracted track, frame, or clip. Ask only when the answer would change the command, like remux versus re-encode.
2. **Inspect first** — run `ffprobe` for codecs, resolution, and track layout before writing a command that depends on them.
3. **Prefer `-c copy`** — remux when the container supports the input codecs, and re-encode only what was asked; keep untouched streams.
4. **Build one command** — adapt the matching operation in **Common Operations**, quote paths, write a new output file, and keep `-n` unless overwriting is intended.
5. **Verify and report** — re-probe the output when duration or tracks matter, report its path and any error FFmpeg printed, and never call a re-encode lossless.

## Common Operations

Each operation below is a single `ffmpeg` invocation to adapt: keep the paths quoted, keep the output a new file, and add options only when the request needs them. Options are introduced once, under the command that uses them first, and are not described again in later operations.

Options are written here as `-name`; FFmpeg option names are single-dash, and a few short aliases exist, such as `-c` for `-codec` and `-vf` for `-filter:v`.

### Inspect media files

Print a human-readable summary of the input file, including its streams and format:

```bash
ffprobe -hide_banner -i "input.mp4"
```

For machine-readable output, print format and stream details as JSON:

```bash
ffprobe -v error -show_format -show_streams -of json "input.mp4"
```

**Options**

- `-i "input.mp4"` — declares an input file. The same option names inputs for `ffmpeg`, and may be repeated for multiple inputs.
- `-hide_banner` — suppress the build configuration and library version banner, so only the report is printed.
- `-v error` — set the log level to errors only (`-loglevel error` is equivalent), keeping warnings out of the output.
- `-show_format` — print container-level fields such as format name, duration, bit rate, and file size.
- `-show_streams` — print one block per stream with its codec, resolution, sample rate, frame rate, and so on.
- `-of json` — select the output writer; `csv`, `flat`, and `default` produce other machine-readable layouts.

### Check supported codecs and encoders

List codecs recognized by this FFmpeg build, including whether each is available for decoding, encoding, or both:

```bash
ffmpeg -hide_banner -codecs
```

To see only available encoders or decoders, use:

```bash
ffmpeg -hide_banner -encoders
ffmpeg -hide_banner -decoders
```

Filter the encoder list to check for common video codec names:

```bash
ffmpeg -hide_banner -encoders | grep -Ei '264|265|av1|vp9'
```

**Options**

- `-codecs` — list codecs with capability flags: `D` for decoding, `E` for encoding, and `V`/`A`/`S` for video, audio, and subtitle.
- `-encoders`, `-decoders` — list what this build can actually encode or decode, with the encoder name to pass to `-c:v` or `-c:a`.

The lists depend on how FFmpeg was built. An encoder being listed does not guarantee that the required hardware or runtime support is available.

### Convert or re-encode video

Convert the input to MP4 using FFmpeg's default stream selection and codec settings:

```bash
ffmpeg -n -i "input.mov" "output.mp4"
```

When the output container supports the input's codecs, copy all streams to a new container without re-encoding. This is faster and preserves the original quality:

```bash
ffmpeg -n -i "input.mp4" -c copy "output.mkv"
```

To control the encoding settings, use H.264 video at CRF 23 and AAC audio at 128 kb/s:

```bash
ffmpeg -n -i "input.mov" \
  -c:v libx264 -crf 23 \
  -c:a aac -b:a 128k \
  "output.mp4"
```

**Options**

- `-c copy` — set the codec for every stream to `copy`, remuxing packets as-is instead of decoding and re-encoding them.
- `-c:v`, `-c:a` — stream-specific forms of `-c` that select the video or audio encoder, leaving other stream types untouched.
- `-crf 23` — constant rate factor for a quality-targeted encode; lower means higher quality and larger files, and 18–28 is the usual range for H.264.
- `-b:a 128k` — a 128 kb/s audio bit-rate target instead of the encoder default.

### Resize video

Scale the video to 1280 pixels wide while preserving its aspect ratio. The `-2` makes the calculated height an even number, as required by many video encoders:

```bash
ffmpeg -n -i "input.mp4" \
  -vf "scale=1280:-2" \
  -c:v libx264 -crf 23 \
  -c:a aac -b:a 128k \
  "resized.mp4"
```

**Options**

- `-vf` — apply a video filter chain to the output; filters are comma-separated and run left to right, as in `-vf "scale=1280:-2,fps=30"`.
- `scale=WIDTH:HEIGHT` — the filter itself: a fixed width with a computed height, where `-1` rounds and `-2` rounds to an even number.

### Extract or convert audio

Remove the video stream and save the audio as MP3:

```bash
ffmpeg -n -i "input.mp4" -vn "audio.mp3"
```

Convert a WAV file to AAC audio in an M4A container at 192 kb/s:

```bash
ffmpeg -n -i "input.wav" -vn -c:a aac -b:a 192k "audio.m4a"
```

**Options**

- `-vn` — disable video recording, dropping all video streams from the output.
- With no `-c:a`, the audio encoder is inferred from the output extension: `audio.mp3` selects the MP3 encoder.

### Adjust audio volume

Increase the audio volume by a factor of 1.5. Copy the video stream without re-encoding and encode the audio as AAC:

```bash
ffmpeg -n -i "input.mp4" \
  -c:v copy -af "volume=1.5" \
  -c:a aac -b:a 192k \
  "louder.mp4"
```

**Options**

- `-af` — apply an audio filter chain to the output, the audio counterpart of `-vf`; `volume=1.5` multiplies the level by 1.5, about +3.5 dB.
- `-c:v copy` — keep the video untouched so the filter only affects the re-encoded audio.

### Trim video and extract a frame

Create a 30-second clip starting one minute into the input:

```bash
ffmpeg -n -i "input.mp4" \
  -ss 00:01:00 -t 30 \
  "output.mp4"
```

Alternatively, specify the clip's end time instead of its duration:

```bash
ffmpeg -n -i "input.mp4" \
  -ss 00:01:00 -to 00:02:30 \
  "output.mp4"
```

Extract a single frame at 1 minute and 23 seconds as a JPEG image:

```bash
ffmpeg -n -i "input.mp4" \
  -ss 00:01:23.000 -frames:v 1 \
  "output.jpg"
```

**Options**

- `-ss` — start time, given as `HH:MM:SS.mmm` or plain seconds. After `-i` it decodes and discards everything up to that point; before `-i` it seeks inside the input first, which is much faster on large files and is the usual choice for trimming.
- `-t` — limit the output duration, counted from the start time.
- `-to` — absolute stop time on the output timeline; it is an alternative to `-t`, and `-t` wins if both are given.
- `-frames:v 1` — write exactly one video frame; the `:v` suffix scopes the limit to video streams, and the image encoder is chosen from the `.jpg` extension.

### Concatenate videos

Create a text file named `inputs.txt` with one relative path per clip, in the order they should appear:

```text
file 'clip1.mp4'
file 'clip2.mp4'
```

Concatenate the clips by copying their streams without re-encoding:

```bash
ffmpeg -n -f concat -i "inputs.txt" -c copy "combined.mp4"
```

**Options**

- `-f concat` — force the `concat` demuxer for the next input, which reads the list file instead of treating it as media.

For stream copying to work, the clips must have matching stream layouts, codecs, and compatible codec parameters. If they differ, re-encode them to matching settings before concatenating.

### Select specific streams

Use `-map` to select the first video stream and the second audio stream. The `?` makes the audio mapping optional if that stream is not present:

```bash
ffmpeg -n -i "input.mkv" \
  -map 0:v:0 -c:v libx264 -crf 23 \
  -map "0:a:1?" -c:a aac -b:a 128k \
  "selected-tracks.mp4"
```

**Options**

- `-map SPEC` — select streams with `input:type:index`, where `input` is the zero-based input number, `type` is `v`, `a`, or `s`, and `index` counts streams of that type within that input. A trailing `?` makes the mapping optional instead of failing.
- Once any `-map` is given, only the mapped streams are written; `-map 0` selects every stream of the first input.

## Best Practices by Use Case

Field-tested combinations for the situations where FFmpeg's defaults are not enough. Adapt the paths; keep the pattern.

| Goal | Pattern | Why it works |
| --- | --- | --- |
| Container change only | `-c copy` | Lossless and fast; fails loudly if the target container rejects a codec, which is the correct signal to re-encode |
| Archive or intermediate master | `-c:v libx264 -crf 18 -c:a aac -b:a 192k` | Near-visually-lossless at sane size, and the result is a normal H.264/AAC file that plays anywhere |
| Web or message-sized clip | `-vf "scale=1280:-2" -c:v libx264 -crf 28 -c:a aac -b:a 96k` | A smaller frame is the cheapest quality cut, and a high CRF keeps the bit rate down where it is least visible |
| Thumbnail or poster frame | `-ss 00:00:05 -frames:v 1` | One decoded frame instead of a full encode, so it is essentially instant |
| Joining clips of different origins | Re-encode all clips to the same codec, size, and rate first, then `-f concat -c copy` | The concat demuxer copies packets and does not reconcile mismatched parameters |

## Troubleshooting

Match the line FFmpeg printed to one entry below, apply that entry's fix, and retry the original command once. Fix only what the error names, and work through the entries in order.

1. **`ffmpeg: command not found` / `ffprobe: command not found`** — not installed or not on `PATH`. `brew install ffmpeg`, then confirm with `ffmpeg -version`.
2. **`Unknown encoder 'libx264'` / `Encoder (codec ...) not found`** — this build lacks that encoder, often because it is a stripped or GPL-disabled build. Run `ffmpeg -hide_banner -encoders` and use a name that is actually listed; do not invent one.
3. **`Invalid data found when processing input`** — the file is not media, is truncated, or is the wrong input for the chosen demuxer, as when a list file is read without `-f concat`. Re-probe with `ffprobe` before changing options.
4. **`moov atom not found`** — a truncated or partially downloaded MP4. Do not try to repair it here; re-fetch the source with the `yt-dlp` skill and process the complete file.
5. **`[...] does not contain any stream` / mapping fails** — a `-map` specifier matched nothing, usually because the input has fewer streams than assumed or is the wrong input index. Check `ffprobe -show_streams` and add `?` only for genuinely optional tracks.
6. **`Height not divisible by 2` / `width not divisible by 2`** — the scale result is odd. Use `-2` instead of `-1` for the computed dimension.
7. **`Codec ... not currently supported in container` / `Could not write header`** — the container cannot carry that codec, for example MP4 with some subtitle or audio codecs. Choose a container that accepts it, or re-encode to one the container supports; `-c copy` into the wrong container will never work.
8. **`File 'output.mp4' already exists. Exiting.`** — `-n` did its job. Confirm the user wants the old file replaced, then use `-y`, or write to a new name.
9. **`Non-monotonous DTS in output stream` / audio drifting after a trim with `-c copy`** — stream copy cut at a keyframe boundary. Re-encode the affected stream (drop `-c copy`) or accept it only when the output plays correctly.
10. **`Conversion failed!` with no clearer line above it** — the real error is earlier in the output. Re-read the log from the first `Error` or `Invalid` line instead of the final one.
11. **`No such file or directory` / `Permission denied` on the output path** — the directory does not exist or is not writable. FFmpeg does not create missing directories; create them or pick a writable path.

### When no entry fixes it

Stop and report the failure instead of trying more commands: the exact command, the error line FFmpeg printed, the `ffmpeg -version` and `ffprobe -version` output, and the `ffprobe` summary of the input. Never claim success without confirming the output file exists, and never silently fall back to a different container, codec, or lossy re-encode the user did not ask for.
