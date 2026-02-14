#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { extractCommand, type ActionRequest } from "@fub/core";
import { createEngine, makeRequest } from "./runtime.js";
import { synthesizeSpeechToFile } from "@fub/adapters-elevenlabs";

const program = new Command();
const { engine, config } = createEngine();

program
  .name("fub")
  .description("Follow Up Boss screenless CLI")
  .option("--pretty", "pretty JSON output", false)
  .option("--trace", "include correlation ids", false);

program
  .command("who")
  .argument("<query>")
  .action(async (query: string) => run({
    permissionScope: "person:read",
    role: "assistant",
    dryRun: false,
    confirm: true,
    verbose: true,
    input: { action: "person.find", query }
  }));

program
  .command("note")
  .requiredOption("--person <person>")
  .requiredOption("--text <text>")
  .option("--confirm", "execute", false)
  .action(async (opts) => run({
    permissionScope: "person:write",
    role: "assistant",
    dryRun: !opts.confirm,
    confirm: Boolean(opts.confirm),
    verbose: true,
    input: {
      action: "note.create",
      person: personRef(opts.person),
      text: opts.text
    }
  }));

program
  .command("task")
  .command("create")
  .requiredOption("--person <person>")
  .requiredOption("--title <title>")
  .option("--due <due>")
  .option("--confirm", "execute", false)
  .action(async (opts) => run({
    permissionScope: "task:write",
    role: "assistant",
    dryRun: !opts.confirm,
    confirm: Boolean(opts.confirm),
    verbose: true,
    input: {
      action: "task.create",
      person: personRef(opts.person),
      title: opts.title,
      dueAt: opts.due
    }
  }));

program
  .command("sms")
  .command("send")
  .requiredOption("--to <to>")
  .requiredOption("--body <body>")
  .option("--person <person>")
  .option("--confirm", "execute", false)
  .action(async (opts) => run({
    permissionScope: "message:send",
    role: "assistant",
    dryRun: !opts.confirm,
    confirm: Boolean(opts.confirm),
    verbose: true,
    input: {
      action: "message.send",
      channel: "sms",
      to: opts.to,
      body: opts.body,
      person: opts.person ? personRef(opts.person) : undefined,
      logToFub: true
    }
  }));

program
  .command("idx")
  .command("search")
  .option("--city <city>")
  .option("--minBeds <minBeds>")
  .option("--maxPrice <maxPrice>")
  .action(async (opts) => {
    const query: Record<string, string | number | boolean> = {};
    if (opts.city) query.city = opts.city;
    if (opts.minBeds) query.minBeds = Number(opts.minBeds);
    if (opts.maxPrice) query.maxPrice = Number(opts.maxPrice);

    await run({
      permissionScope: "listing:read",
      role: "assistant",
      dryRun: false,
      confirm: true,
      verbose: true,
      input: { action: "listing.search", query }
    });
  });

program
  .command("plan")
  .requiredOption("--from-message <path>")
  .option("--dry-run", "dry run", false)
  .action(async (opts) => {
    const text = fs.readFileSync(opts.fromMessage, "utf8");
    const cmd = extractCommand(text);
    const req: ActionRequest = makeRequest({
      permissionScope: "instruction:execute",
      role: "assistant",
      dryRun: Boolean(opts.dryRun),
      confirm: !opts.dryRun,
      verbose: true,
      input: {
        action: cmd.action as never,
        ...(cmd.input as object)
      } as never,
      idempotencyKey: cmd.idempotencyKey
    });
    const result = await engine.run(req);
    print(result);
  });

const voicemail = program.command("voicemail").description("Slybroadcast voicemail tools");

voicemail
  .command("drop")
  .requiredOption("--to <phones>", "comma-separated phone numbers")
  .option("--audio-url <url>", "public URL to MP3/WAV file")
  .option("--sly-audio-name <name>", "existing Slybroadcast recording name")
  .option("--elevenlabs-text <text>", "generate audio with ElevenLabs and use it")
  .option("--campaign-name <name>")
  .option("--caller-id <callerId>")
  .option("--send-date <YYYY-MM-DD>", "optional schedule date")
  .option("--send-time <HH:mm>", "optional schedule time")
  .option("--timezone <tz>", "optional Slybroadcast timezone")
  .option("--repeat-days <days>", "optional repeat days string, e.g. 135")
  .option("--confirm", "execute", false)
  .action(async (opts) => {
    const numbers = parsePhoneList(opts.to);
    const audio = await resolveAudioInput({
      audioUrl: opts.audioUrl,
      slyAudioName: opts.slyAudioName,
      elevenlabsText: opts.elevenlabsText
    });
    const repeatDays = parseRepeatDays(opts.repeatDays);

    await run({
      permissionScope: "voicemail:drop",
      role: "assistant",
      dryRun: !opts.confirm,
      confirm: Boolean(opts.confirm),
      verbose: true,
      input: {
        action: "voicemail.drop",
        phoneNumbers: numbers,
        audio,
        campaignName: opts.campaignName,
        callerId: opts.callerId,
        sendDate: opts.sendDate,
        sendTime: opts.sendTime,
        timezone: opts.timezone,
        repeatDays
      }
    });
  });

voicemail
  .command("audio-list")
  .option("--dry-run", "preview only", false)
  .action(async (opts) => run({
      permissionScope: "voicemail:drop",
      role: "assistant",
      dryRun: Boolean(opts.dryRun),
      confirm: !opts.dryRun,
      verbose: true,
      input: {
        action: "voicemail.audio.list"
      }
    }));

voicemail
  .command("campaign-status")
  .requiredOption("--campaign-id <id>")
  .option("--dry-run", "preview only", false)
  .action(async (opts) => run({
    permissionScope: "voicemail:drop",
    role: "assistant",
    dryRun: Boolean(opts.dryRun),
    confirm: !opts.dryRun,
    verbose: true,
    input: {
      action: "voicemail.campaign.status",
      campaignId: opts.campaignId
    }
  }));

program.parseAsync(process.argv).catch((error) => {
  print({ ok: false, error: (error as Error).message });
  process.exitCode = 1;
});

async function run(request: Omit<ActionRequest, "audit" | "idempotencyKey"> & { idempotencyKey?: string }) {
  const result = await engine.run(makeRequest(request));
  print(result);
}

function personRef(value: string): { personId?: number; email?: string; phone?: string; name?: string } {
  if (value.startsWith("+")) return { phone: value };
  if (value.includes("@")) return { email: value };
  if (/^\d+$/.test(value)) return { personId: Number(value) };
  return { name: value };
}

function print(payload: unknown): void {
  const root = program.opts<{ pretty: boolean }>();
  if (root.pretty) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(JSON.stringify(payload));
  }
}

function parsePhoneList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function parseRepeatDays(value: string | undefined): number[] | undefined {
  if (!value) return undefined;
  return value.split("").map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

async function resolveAudioInput(opts: { audioUrl?: string; slyAudioName?: string; elevenlabsText?: string }): Promise<{ audioUrl?: string; slyAudioName?: string }> {
  if (opts.audioUrl || opts.slyAudioName) {
    return { audioUrl: opts.audioUrl, slyAudioName: opts.slyAudioName };
  }

  if (!opts.elevenlabsText) {
    throw new Error("Provide --audio-url, --sly-audio-name, or --elevenlabs-text");
  }

  if (!config.ELEVENLABS_API_KEY || !config.ELEVENLABS_TTS_VOICE_ID) {
    throw new Error("ELEVENLABS_API_KEY and ELEVENLABS_TTS_VOICE_ID are required for --elevenlabs-text");
  }
  if (!config.SLYBROADCAST_PUBLIC_AUDIO_BASE_URL) {
    throw new Error("SLYBROADCAST_PUBLIC_AUDIO_BASE_URL is required for --elevenlabs-text");
  }

  const filename = `tts-${Date.now()}.mp3`;
  const outputPath = path.join(config.SLYBROADCAST_AUDIO_STAGING_DIR, filename);
  await synthesizeSpeechToFile({
    apiKey: config.ELEVENLABS_API_KEY,
    baseUrl: config.ELEVENLABS_BASE_URL ?? "https://api.elevenlabs.io",
    voiceId: config.ELEVENLABS_TTS_VOICE_ID,
    modelId: config.ELEVENLABS_TTS_MODEL_ID,
    text: opts.elevenlabsText,
    outputPath
  });

  return {
    audioUrl: `${config.SLYBROADCAST_PUBLIC_AUDIO_BASE_URL.replace(/\/$/, "")}/${filename}`
  };
}
