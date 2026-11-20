---
name: ffmpeg
description: >
  Guide to using FFmpeg and ffprobe to inspect, convert, remux, encode, resize, and trim media; extract frames or audio; select streams; and adjust audio volume.
  Use when performing common video or audio processing tasks.
---

# ffmpeg

FFmpeg is an open-source multimedia framework for handling video, audio, and other media. Its command-line tools can inspect, convert, encode, and filter media, while `ffprobe` reports file and stream properties. This skill focuses on common file-based media operations.

## When to Use This Skill

Use this skill when:

- Inspecting media file properties and streams with `ffprobe`
- Converting between media containers or re-encoding video and audio
- Resizing or trimming video, or extracting a still frame
- Extracting audio, converting audio formats, or adjusting volume
- Selecting specific video or audio streams from a file

## Common Media Operations

Use `ffprobe` to inspect media files and `ffmpeg` to process them. Quote file paths and write results to a new output file. Prefer `-n` to prevent accidentally overwriting an existing file; use `-y` only when overwriting is intentional.

### Inspect Media Files

Print a human-readable summary of the input file, including its streams and format:

```bash
ffprobe -hide_banner -i "input.mp4"
```

For machine-readable output, print format and stream details as JSON:

```bash
ffprobe -v error -show_format -show_streams -of json "input.mp4"
```

### Convert or Re-encode Video

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

### Resize Video

Scale the video to 1280 pixels wide while preserving its aspect ratio. The `-2` makes the calculated height an even number, as required by many video encoders:

```bash
ffmpeg -n -i "input.mp4" \
  -vf "scale=1280:-2" \
  -c:v libx264 -crf 23 \
  -c:a aac -b:a 128k \
  "resized.mp4"
```

### Extract or Convert Audio

Remove the video stream and save the audio as MP3:

```bash
ffmpeg -n -i "input.mp4" -vn "audio.mp3"
```

Convert a WAV file to AAC audio in an M4A container at 192 kb/s:

```bash
ffmpeg -n -i "input.wav" -vn -c:a aac -b:a 192k "audio.m4a"
```

### Adjust Audio Volume

Increase the audio volume by a factor of 1.5. Copy the video stream without re-encoding and encode the audio as AAC:

```bash
ffmpeg -n -i "input.mp4" \
  -c:v copy -af "volume=1.5" \
  -c:a aac -b:a 192k \
  "louder.mp4"
```

### Trim Video and Extract a Frame

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

### Select Specific Streams

Use `-map` to select the first video stream and the second audio stream. The `?` makes the audio mapping optional if that stream is not present:

```bash
ffmpeg -n -i "input.mkv" \
  -map 0:v:0 -c:v libx264 -crf 23 \
  -map "0:a:1?" -c:a aac -b:a 128k \
  "selected-tracks.mp4"
```