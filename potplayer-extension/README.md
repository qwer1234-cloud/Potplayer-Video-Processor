# ProcessVideo PotPlayer Extension

This folder contains the thin PotPlayer bridge for ProcessVideo.

## Requirements

- PotPlayer with AngelScript extension support.
- ProcessVideo repository checkout or packaged companion.
- Node.js when `companion_path` points to `cli/processvideo-cli.js`.

## Install

Copy `potplayer-extension/Media` into the PotPlayer extension folder:

```text
C:\Program Files\DAUM\PotPlayer\Extension\
```

The target script path should be:

```text
C:\Program Files\DAUM\PotPlayer\Extension\Media\PlayParse\MediaPlayParse - ProcessVideo.as
```

Copy `ProcessVideo_default.ini` next to the script. Create `ProcessVideo.ini` next to it for local overrides. The installer should never overwrite `ProcessVideo.ini`.

## Development Configuration

Example `ProcessVideo.ini`:

```ini
[PROCESSVIDEO]
companion_path=D:\ProcessVideo-Beta\cli\processvideo-cli.js
node_path=node
mode=bookmark-gif
open_ui_after_start=0
report_path=D:\ProcessVideo-Beta\runtime\last-run.json
show_launch_message=1
cooldown_seconds=30
require_pbf_exists=1
async_launch=1
```

When PotPlayer parses a local video file, the extension launches:

```text
node "D:\ProcessVideo-Beta\cli\processvideo-cli.js" bookmark-gif --video "<current video>"
```

The companion reads the `.pbf`, generates GIFs, and writes `runtime/last-run.json`.

`cooldown_seconds` prevents repeated PlayParse calls for the same video from launching multiple companion processes.
`require_pbf_exists=1` keeps the extension quiet unless a same-directory, same-name `.pbf` exists.
`async_launch=1` launches the companion in the background so PotPlayer media parsing is not blocked by GIF generation.

## Packaged Configuration

For a future packaged companion executable, set:

```ini
[PROCESSVIDEO]
companion_path=C:\Path\To\ProcessVideoCompanion.exe
node_path=
mode=bookmark-gif
```

## Known Limits

- PotPlayer PlayParse extensions are triggered while parsing media items; they are not a general toolbar button.
- The first implementation infers the PBF path from the current video path.
- Make sure PotPlayer is configured to save bookmarks to an external `.pbf` file.
- If PotPlayer is installed under `Program Files`, installing the extension may require administrator permission.
