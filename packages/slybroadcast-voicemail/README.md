# slybroadcast-voicemail

CLI + MCP server for Slybroadcast voicemail campaigns, designed for OpenClaw and LLM tool use.

## What it supports

- Send a voicemail campaign with:
  - existing Slybroadcast account recording title (`c_record_audio`)
  - existing Slybroadcast system audio name (`c_sys_audio_name`)
  - public audio URL (`c_url` + `c_audio`)
  - local audio file staging (`.wav/.mp3/.m4a`) mapped to public URL
  - AI-generated voice from ElevenLabs (or a generic HTTP voice provider)
- Campaign parameters:
  - caller ID (`c_callerID`)
  - delivery time (`c_date`, Eastern Time)
  - campaign title (`c_title`)
  - end time (`c_endtime`)
  - destination numbers (`c_phone`) or uploaded phone list id (`c_listid`)
- Utility API calls:
  - audio list
  - phone list IDs
  - campaign status/results
  - campaign control (pause/run/cancel/stop)

## Install/build

```bash
npm install
npm --workspace @fub/slybroadcast-voicemail run build
```

## Environment

Required:

- `SLYBROADCAST_UID` (or `SLYBROADCAST_EMAIL` fallback)
- `SLYBROADCAST_PASSWORD`

Usually needed:

- `SLYBROADCAST_DEFAULT_CALLER_ID`
- `SLYBROADCAST_PUBLIC_AUDIO_BASE_URL` (required for local file staging and AI-generated voice)
- `SLYBROADCAST_AUDIO_STAGING_DIR` (default `./tmp/slybroadcast-audio`)

ElevenLabs plugin:

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_TTS_VOICE_ID`
- `ELEVENLABS_TTS_MODEL_ID` (optional, default `eleven_multilingual_v2`)

Generic voice HTTP plugin:

- `VOICE_HTTP_BASE_URL`
- `VOICE_HTTP_API_KEY` (optional)

## CLI examples

Send with account recording title:

```bash
npm --workspace @fub/slybroadcast-voicemail run dev:cli -- send \
  --to "16173999981,16173999982" \
  --record-audio "My First Voice Message" \
  --caller-id "16173999980" \
  --campaign-name "Open House Follow-up" \
  --schedule-at "now"
```

Send with public audio URL:

```bash
npm --workspace @fub/slybroadcast-voicemail run dev:cli -- send \
  --to "16173999981" \
  --audio-url "https://example.com/voicemail.mp3" \
  --audio-type mp3 \
  --caller-id "16173999980" \
  --schedule-at "2026-02-18 13:30:00"
```

Generate ElevenLabs voice + send:

```bash
npm --workspace @fub/slybroadcast-voicemail run dev:cli -- send \
  --to "16173999981" \
  --ai-text "Hi, this is a reminder about your appointment tomorrow at 3 PM." \
  --ai-provider elevenlabs \
  --caller-id "16173999980" \
  --campaign-name "Appointment Reminder"
```

Use uploaded phone list from Slybroadcast platform:

```bash
npm --workspace @fub/slybroadcast-voicemail run dev:cli -- send \
  --list-id 94454 \
  --record-audio "My First Voice Message" \
  --caller-id "16173999980"
```

Inspect account audio and list IDs:

```bash
npm --workspace @fub/slybroadcast-voicemail run dev:cli -- audio-list --with-duration
npm --workspace @fub/slybroadcast-voicemail run dev:cli -- phone-list
```

## MCP server

Run:

```bash
npm --workspace @fub/slybroadcast-voicemail run dev:mcp
```

Tools:

- `slybroadcast_voicemail_send`
- `slybroadcast_audio_list`
- `slybroadcast_phone_list`
- `slybroadcast_campaign_status`
- `slybroadcast_campaign_results`
- `slybroadcast_campaign_control`
- `slybroadcast_voice_generate`

## Slybroadcast API notes

This package targets the documented gateway endpoint:

- `https://www.slybroadcast.com/gateway/vmb.json.php`

Per docs (last updated Jan 7, 2026), campaign send uses `c_method=new_campaign` and supports `c_record_audio`, `c_sys_audio_name`, and `c_url`/`c_audio` for audio source selection.

If you use local/AI-generated audio, your generated file must be reachable at a public URL for Slybroadcast to fetch.
