---
name: ffmpeg
description: >
  Guide to using ffmpeg and ffprobe to inspect, convert, remux, encode, resize, trim, and concatenate media; extract frames or audio; select streams; and adjust audio volume.
  Use when performing common video or audio processing tasks.
  This skill is not intended for downloading media from a URL; use the yt-dlp skill for that.
---

# ffmpeg

Inspect, convert, remux, encode, resize, trim, and concatenate media with the `ffmpeg` command-line tool, and read its stream and format metadata with the companion `ffprobe` — covering video, audio, subtitles, and still frames in any container the local FFmpeg build supports. The skill supplies one ready-to-adapt command per common task, explains each option where it appears, and leaves the choice of codec, quality level, and file layout to the request rather than pinning defaults.

## When to use

Trigger this skill when the request concerns media **that already exists** — on disk, or after another tool has downloaded it — and the user wants to:

- Inspect a file's streams, codecs, resolution, frame rate, duration, or bit rate before deciding what to do
- Check which codecs and encoders the installed FFmpeg build actually provides
- Convert a file to another container or re-encode it with different codec or quality settings
- Remux streams into a new container without re-encoding, to keep the original quality
- Extract or convert the audio track of a video, or adjust its volume
- Resize, rescale, or otherwise filter the video, alone or as a chain with other filters
- Trim a clip by start time and duration or end time, or grab a single frame as an image
- Join several clips into one file, re-encoding first only if their stream layouts differ
- Pick specific video, audio, or subtitle tracks out of a file that holds several

**Out of scope:** downloading media from a URL, and fetching subtitles or live chat — that is the `yt-dlp` skill's job, with FFmpeg used only as its merge and post-processing backend. Also out of scope are interactive editing, subtitle authoring, and streaming or broadcast setup.

## Common Operations

Each operation below provides a reusable ffmpeg command. Quote all paths, keep the output in a new file, and add options only when necessary. Every invocation must begin with `-hide_banner` and `-n`: `-hide_banner` suppresses the build/version banner, while `-n` prevents overwriting an existing output file. Explain options on their first use, beneath the corresponding command, and do not repeat those explanations in later operations.

Options are written here as `-name`; ffmpeg option names are single-dash, and a few short aliases exist, such as `-c` for `-codec` and `-vf` for `-filter:v`.

### Inspect media files

Print a human-readable summary of the input file, including its streams and format:

```bash
ffprobe -hide_banner -i "input.mp4"
```

For machine-readable output, print format and stream details as JSON:

```bash
ffprobe -v error -show_format -show_streams -of json -i "input.mp4"
```

**Options**

- `-hide_banner` — suppress the build configuration and library version banner, so only the report is printed.
- `-i "input.mp4"` — declares an input file. The same option names inputs for `ffmpeg`, and may be repeated for multiple inputs.
- `-v error` — set the log level to errors only (`-loglevel error` is equivalent), keeping warnings out of the output.
- `-show_format` — print container-level fields such as format name, duration, bit rate, and file size.
- `-show_streams` — print one block per stream with its codec, resolution, sample rate, frame rate, and so on.
- `-of json` — select the output writer; `csv`, `flat`, and `default` produce other machine-readable layouts.

### Check supported codecs and encoders

List codecs recognized by this FFmpeg build, including whether each is available for decoding, encoding, or both:

```bash
ffmpeg -hide_banner -codecs    # encoders and decoders
ffmpeg -hide_banner -encoders  # only encoders
ffmpeg -hide_banner -decoders  # only decoders
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
ffmpeg -i "input.mov" \
  "output.mp4"
```

When the output container supports the input's codecs, copy all streams to a new container without re-encoding. This is faster and preserves the original quality:

```bash
ffmpeg -i "input.mp4" \
  -c copy \
  "output.mkv"
```

To control the encoding settings, use H.264 video at CRF 23 and AAC audio at 128 kb/s:

```bash
ffmpeg -i "input.mov" \
  -c:v libx264 -crf 23 \
  -c:a aac -b:a 128k \
  "output.mp4"
```

**Options**

- `-c copy` — set the codec for every stream to `copy`, remuxing packets as-is instead of decoding and re-encoding them.
- `-c:v`, `-c:a` — stream-specific forms of `-c` that select the video or audio encoder, leaving other stream types untouched.
- `-crf 23` — constant rate factor for a quality-targeted encode; lower means higher quality and larger files, and 18–28 is the usual range for H.264.
- `-b:a 128k` — a 128 kb/s audio bit-rate target instead of the encoder default.

### Extract or convert audio

Remove the video stream and save the audio as MP3:

```bash
ffmpeg -i "input.mp4" \
  -vn \
  "audio.mp3"
```

Convert a WAV file to AAC audio in an M4A container at 192 kb/s:

```bash
ffmpeg -i "input.wav" \
  -vn -c:a aac -b:a 192k \
  "audio.m4a"
```

**Options**

- `-vn` — disable video recording, dropping all video streams from the output.
- With no `-c:a`, the audio encoder is inferred from the output extension: `audio.mp3` selects the MP3 encoder.

### Resize video

Scale the video to 1280 pixels wide while preserving its aspect ratio. The `-2` makes the calculated height an even number, as required by many video encoders:

```bash
ffmpeg -i "input.mp4" \
  -vf "scale=1280:-2" \
  "resized.mp4"
```

**Options**

- `-vf` — apply a video filter chain to the output; filters are comma-separated and run left to right, as in `-vf "scale=1280:-2,fps=30"`.
- `scale=WIDTH:HEIGHT` — the filter itself: a fixed width with a computed height, where `-1` rounds and `-2` rounds to an even number.

### Adjust audio volume

Increase the audio volume by a factor of 1.5. Copy the video stream without re-encoding and encode the audio as AAC:

```bash
ffmpeg -i "input.mp4" \
  -af "volume=1.5" \
  "louder.mp4"
```

**Options**

- `-af` — apply an audio filter chain to the output, the audio counterpart of `-vf`; `volume=1.5` multiplies the level by 1.5, about +3.5 dB.

### Trim video and extract a frame

Create a 30-second clip starting one minute into the input:

```bash
ffmpeg -i "input.mp4" \
  -ss 00:01:00 -t 30 \
  "output.mp4"
```

Alternatively, specify the clip's end time instead of its duration:

```bash
ffmpeg -i "input.mp4" \
  -ss 00:01:00 -to 00:02:30 \
  "output.mp4"
```

Extract a single frame at 1 minute and 23 seconds as a JPEG image:

```bash
ffmpeg -i "input.mp4" \
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
ffmpeg -f concat -i "inputs.txt" \
  "combined.mp4"
```

**Options**

- `-f concat` — force the `concat` demuxer for the next input, which reads the list file instead of treating it as media.

For stream copying to work, the clips must have matching stream layouts, codecs, and compatible codec parameters. If they differ, re-encode them to matching settings before concatenating.

### Select specific streams

Use `-map` to select the first video stream and the second audio stream. The `?` makes the audio mapping optional if that stream is not present:

```bash
ffmpeg -i "input.mkv" \
  -map 0:v:0 -c:v libx264 -crf 23 \
  -map "0:a:1?" -c:a aac -b:a 128k \
  "selected-tracks.mp4"
```

**Options**

- `-map SPEC` — select streams with `input:type:index`, where `input` is the zero-based input number, `type` is `v`, `a`, or `s`, and `index` counts streams of that type within that input. A trailing `?` makes the mapping optional instead of failing.
- Once any `-map` is given, only the mapped streams are written; `-map 0` selects every stream of the first input.
