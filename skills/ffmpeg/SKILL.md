---
name: ffmpeg
description: >
  Guide for using FFmpeg - a comprehensive multimedia framework for video/audio encoding, conversion, streaming, and filtering. Use when processing media files, converting formats, extracting audio, creating streams, applying filters, or optimizing video/audio quality.
---

# ffmpeg

FFmpeg is a comprehensive open-source multimedia framework that handles video, audio, and other multimedia files and streams. It provides command-line tools and libraries for recording, converting, and streaming audio and video.

## When to Use This Skill

Use this skill when:

- Analyzing media file properties
- Converting media files between formats (MP4, MKV, WebM, AVI, etc.)
- Encoding/decoding video with different codecs (H.264, H.265, VP9, AV1)
- Extracting audio from video files
- Processing audio files (AAC, MP3, FLAC, Opus)
- Applying video/audio filters (scale, crop, denoise, volume)
- Screen recording and capture
- Optimizing video quality and file size
- Batch processing media files
- Creating HLS/DASH adaptive streams
- Live streaming to platforms (Twitch, YouTube, RTMP servers)

## Basic Operations

Use `ffmpeg` for media operations and `ffprobe` to inspect files. Quote file
paths, write to a new output file, and prefer `-n` so an existing file is not
silently overwritten. Use `-y` only when overwriting is explicitly intended.

### Inspect a Media File

```bash
ffprobe -hide_banner -i "input.mp4"
```

For machine-readable stream and format details:

```bash
ffprobe -v error -show_format -show_streams -of json "input.mp4"
```

Check the duration, resolution, frame rate, codecs, audio channels, and
subtitle streams before choosing output settings. List encoders available in
the current build with `ffmpeg -encoders`.

### Convert or Re-encode Video

For a broadly compatible H.264 MP4:

```bash
ffmpeg -n -i "input.mov" \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 128k \
  "output.mp4"
```

`-crf` controls quality for x264: lower values generally mean higher quality
and larger files. The preset trades encoding speed for compression efficiency;
it does not directly set quality. Adjust these values to suit the source and
the user's size or quality target rather than applying one setting to every
file. For files with multiple streams, use explicit stream mapping to select
the intended video and audio tracks.

To re-encode only when necessary, first identify the target container and
playback requirements. A file extension change alone does not convert codecs.

### Remux Without Re-encoding

When the existing codecs are supported by the destination container, copy the
streams instead of re-encoding:

```bash
ffmpeg -n -i "input.mkv" -map 0 -c copy "output.mp4"
```

Stream copying is fast and preserves the encoded quality, but it can fail when
the destination container does not support a source stream or codec. If that
happens, inspect the streams and re-encode only the incompatible ones.

### Select Streams with `-map`

Use `-map` to choose exactly which input streams are written to the output.
Its basic form is `-map INPUT_INDEX:STREAM_TYPE:STREAM_INDEX`; input and stream
indexes start at `0`. For example, `0:v:0` means the first video stream from
the first input, while `0:a:1` means its second audio stream.

Select the first video stream and the second audio stream, if present:

```bash
ffmpeg -n -i "input.mkv" \
  -map 0:v:0 -map "0:a:1?" \
  -c:v libx264 -crf 23 -c:a aac -b:a 128k \
  "selected-tracks.mp4"
```

The `?` makes that mapping optional: if the input has no second audio stream,
FFmpeg still processes the video. Add another mapping such as `-map "0:s?"`
to include subtitle streams when the output container supports them.
Explicit mappings omit all streams that are not selected. In contrast,
`-map 0` selects all streams from the first input, which is useful for
remuxing but may include streams unsupported by the output container.

### Extract or Convert Audio

Extract audio as MP3:

```bash
ffmpeg -n -i "input.mp4" -vn -c:a libmp3lame -q:a 2 "audio.mp3"
```

Convert audio to AAC:

```bash
ffmpeg -n -i "input.wav" -vn -c:a aac -b:a 192k "audio.m4a"
```

Use `-vn` to exclude video. For lossless audio, select a lossless codec such
as FLAC and verify that the input itself is lossless; converting a lossy
source to a lossless format cannot restore discarded information.

### Trim or Extract a Frame

For accurate re-encoded trimming, place `-ss` after the input:

```bash
ffmpeg -n -i "input.mp4" -ss 00:00:10 -t 00:00:20 \
  -c:v libx264 -crf 23 -c:a aac "clip.mp4"
```

For a fast cut without re-encoding, place `-ss` before `-i` and use stream
copying. The cut may snap to a nearby keyframe:

```bash
ffmpeg -n -ss 00:00:10 -i "input.mp4" -t 00:00:20 \
  -c copy "clip.mp4"
```

Extract one frame:

```bash
ffmpeg -n -ss 00:00:05 -i "input.mp4" -frames:v 1 "frame.png"
```

### Resize or Apply Filters

Scale the video to at most 1280 pixels wide while preserving its aspect ratio:

```bash
ffmpeg -n -i "input.mp4" \
  -vf "scale='min(1280,iw)':-2" \
  -c:v libx264 -crf 23 -c:a aac -b:a 128k \
  "resized.mp4"
```

Common filters include `crop`, `fps`, `volume`, `loudnorm`, and `eq`.
Combine video filters in order with commas, for example
`-vf "scale=1280:-2,fps=30"`. Use `-af` for audio filters. Re-encoding is
required when a filter changes the media; do not pair a filtering option with
`-c copy` for the affected stream.

### Record the Screen on Linux and macOS

Screen capture inputs and permissions differ by operating system. These
examples record video without audio; add an audio input only after identifying
the desired microphone or system-audio source.

#### Linux with X11

`x11grab` works in an X11 session. Set `-video_size` to the display
dimensions, then record the display named by `$DISPLAY`:

```bash
ffmpeg -n \
  -f x11grab -framerate 30 -video_size 1920x1080 \
  -i "$DISPLAY" \
  -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p \
  "screen-recording.mp4"
```

Replace `1920x1080` with the actual capture dimensions. `x11grab` does not
provide native Wayland desktop capture; on Wayland, use a PipeWire/desktop
portal capture source supported by the installed FFmpeg build and compositor.
Do not assume the X11 command will work in a Wayland session.

#### macOS with AVFoundation

First list the available capture devices. FFmpeg may report an error after
printing the list; that is expected for this discovery command:

```bash
ffmpeg -f avfoundation -list_devices true -i ""
```

Use the listed screen device index in place of `1` in this video-only example:

```bash
ffmpeg -n \
  -f avfoundation -framerate 30 -i "1:none" \
  -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p \
  "screen-recording.mp4"
```

The AVFoundation input is written as `VIDEO_DEVICE:AUDIO_DEVICE`; `none`
disables audio. Device indexes vary by Mac and must come from the listing.
Grant the terminal or app Screen Recording permission in macOS Privacy &
Security settings, then restart it if capture is denied. Microphone capture
requires selecting an audio device; capturing system audio may require a
separately installed virtual audio device.

Press `q` or Ctrl+C to stop recording. Inspect the result with `ffprobe` and
play it back to confirm the expected duration and display content.

### Create an HLS Package

Create the destination directory first:

```bash
mkdir -p "hls-output"
ffmpeg -n -i "input.mp4" \
  -c:v libx264 -c:a aac \
  -hls_time 6 -hls_playlist_type vod \
  -hls_segment_filename "hls-output/segment_%03d.ts" \
  "hls-output/index.m3u8"
```

The playlist references the generated segments, so keep the playlist and its
segments together when moving or serving the package. For adaptive bitrate
output, define and validate each rendition and its master playlist rather
than assuming a single encode is adaptive.

### Batch Processing

For a simple Bash batch, preview the input and output names before running a
large job. This example converts `.mov` files in the current directory and
does not overwrite outputs:

```bash
for input in ./*.mov; do
  [ -f "$input" ] || continue
  output="${input%.*}.mp4"
  ffmpeg -n -i "$input" \
    -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k \
    "$output"
done
```

### Verify the Result

After processing, inspect the output and, when practical, play it back:

```bash
ffprobe -v error -show_format -show_streams -of json "output.mp4"
```

Confirm that the file exists, has the expected duration and streams, and
plays in the intended target environment. A zero exit status alone does not
prove that the output meets the user's playback or quality requirements.

### Troubleshooting

- **Unknown encoder:** Check `ffmpeg -encoders`; the installed build may not
  include that encoder. Choose an available alternative.
- **Output format or codec is unsupported:** Inspect the input streams with
  `ffprobe`, then remux compatible streams or re-encode incompatible ones.
- **Unexpectedly large output:** For H.264, increase `-crf` gradually or try
  a slower preset. Compare quality and size on a representative short sample.
- **Playback or synchronization issues:** Check frame rate, timestamps, and
  audio/video stream durations with `ffprobe`; avoid changing frame rate or
  timestamps without understanding the source.
- **Command fails:** Read the first meaningful FFmpeg error, verify input and
  output paths, and check that the destination directory exists and is
  writable. Do not hide errors or treat a partial output as successful.

### Practical Guidelines

- Preserve the original input and write results to a separate path.
- Do not assume a codec, pixel format, frame rate, or audio layout; inspect
  the source and clarify delivery requirements when they are not specified.
- Prefer stream copying for compatible container changes and re-encode only
  when the task requires a codec or media transformation.
- Use explicit stream mapping when files may contain multiple audio,
  subtitle, or video tracks.
- For long or batch jobs, test settings on a short representative section
  before processing the full collection.
- Treat URLs and live-stream endpoints as user-provided inputs. Confirm the
  intended source and destination before initiating network transfers or
  publishing a stream.
