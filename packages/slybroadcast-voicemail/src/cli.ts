#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "./config.js";
import { CampaignControlAction } from "./slybroadcast-client.js";
import { SendVoicemailInput, VoicemailService } from "./service.js";

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function csvToList(input?: string): string[] | undefined {
  if (!input) return undefined;
  return input
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function buildSendInput(opts: {
  to?: string;
  listId?: string;
  callerId?: string;
  scheduleAt?: string;
  campaignName?: string;
  endTime?: string;
  dispositionUrl?: string;
  mobileOnly?: boolean;
  remainMessage?: boolean;
  recordAudio?: string;
  sysAudioName?: string;
  audioUrl?: string;
  audioType?: "wav" | "mp3" | "m4a";
  audioFile?: string;
  aiText?: string;
  aiProvider?: "elevenlabs" | "http";
  voiceId?: string;
  modelId?: string;
}): SendVoicemailInput {
  const base = {
    to: csvToList(opts.to),
    listId: opts.listId,
    callerId: opts.callerId,
    scheduleAt: opts.scheduleAt,
    campaignName: opts.campaignName,
    endTime: opts.endTime,
    dispositionUrl: opts.dispositionUrl,
    mobileOnly: opts.mobileOnly,
    remainMessage: opts.remainMessage
  };

  const choices = [
    Boolean(opts.recordAudio),
    Boolean(opts.sysAudioName),
    Boolean(opts.audioUrl),
    Boolean(opts.audioFile),
    Boolean(opts.aiText)
  ].filter(Boolean).length;

  if (choices !== 1) {
    throw new Error(
      "Provide exactly one audio source: --record-audio, --sys-audio-name, --audio-url, --audio-file, or --ai-text"
    );
  }

  if (opts.recordAudio) {
    return { ...base, recordAudioTitle: opts.recordAudio };
  }

  if (opts.sysAudioName) {
    return { ...base, sysAudioName: opts.sysAudioName };
  }

  if (opts.audioUrl) {
    if (!opts.audioType) {
      throw new Error("--audio-type is required with --audio-url");
    }
    return {
      ...base,
      audioUrl: opts.audioUrl,
      audioType: opts.audioType
    };
  }

  if (opts.audioFile) {
    return {
      ...base,
      audioFilePath: opts.audioFile,
      audioType: opts.audioType
    };
  }

  return {
    ...base,
    aiText: opts.aiText as string,
    aiProvider: opts.aiProvider,
    voiceId: opts.voiceId,
    modelId: opts.modelId
  };
}

async function main() {
  let service: VoicemailService | undefined;
  const getService = () => {
    if (!service) {
      service = new VoicemailService(loadConfig());
    }
    return service;
  };
  const cli = new Command();

  cli
    .name("slybroadcast-voicemail")
    .description("Slybroadcast Voicemail CLI for OpenClaw and LLM-driven workflows");

  cli
    .command("send")
    .description("Send a voicemail campaign")
    .option("--to <csv>", "comma-separated phone numbers")
    .option("--list-id <id>", "Slybroadcast phone-list ID")
    .option("--caller-id <phone>", "caller ID number")
    .option(
      "--schedule-at <date>",
      'delivery time in ET: "YYYY-MM-DD HH:MM:SS" or "now"',
      "now"
    )
    .option("--campaign-name <name>")
    .option("--end-time <date>", "campaign cutoff in ET")
    .option("--disposition-url <url>")
    .option("--mobile-only", "mobile numbers only")
    .option("--remain-message", "request remaining credits in response")
    .option("--record-audio <title>", "existing account recording title")
    .option("--sys-audio-name <name>", "existing system audio filename")
    .option("--audio-url <url>", "public audio URL")
    .option("--audio-type <type>", "wav|mp3|m4a")
    .option(
      "--audio-file <path>",
      "local file to stage and expose via SLYBROADCAST_PUBLIC_AUDIO_BASE_URL"
    )
    .option("--ai-text <text>", "generate audio from text")
    .option("--ai-provider <provider>", "elevenlabs|http", "elevenlabs")
    .option("--voice-id <id>", "voice provider voice ID")
    .option("--model-id <id>", "voice provider model ID")
    .action(
      async (opts: {
        to?: string;
        listId?: string;
        callerId?: string;
        scheduleAt?: string;
        campaignName?: string;
        endTime?: string;
        dispositionUrl?: string;
        mobileOnly?: boolean;
        remainMessage?: boolean;
        recordAudio?: string;
        sysAudioName?: string;
        audioUrl?: string;
        audioType?: "wav" | "mp3" | "m4a";
        audioFile?: string;
        aiText?: string;
        aiProvider?: "elevenlabs" | "http";
        voiceId?: string;
        modelId?: string;
      }) => {
        const result = await getService().sendVoicemail(buildSendInput(opts));
        print(result);
      }
    );

  cli
    .command("audio-list")
    .option("--with-duration", "include duration in seconds")
    .action(async (opts: { withDuration?: boolean }) => {
      print(await getService().getAudioList(Boolean(opts.withDuration)));
    });

  cli.command("phone-list").action(async () => {
    print(await getService().getPhoneList());
  });

  cli
    .command("campaign-status")
    .requiredOption("--session-id <id>")
    .option("--phone <phone>")
    .action(async (opts: { sessionId: string; phone?: string }) => {
      print(await getService().getCampaignStatus(opts.sessionId, opts.phone));
    });

  cli
    .command("campaign-results")
    .requiredOption("--session-id <id>")
    .action(async (opts: { sessionId: string }) => {
      print(await getService().getCampaignResults(opts.sessionId));
    });

  cli
    .command("campaign-control")
    .requiredOption("--session-id <id>")
    .requiredOption("--action <action>", "pause|run|cancel|stop")
    .action(async (opts: { sessionId: string; action: CampaignControlAction }) => {
      print(await getService().controlCampaign(opts.sessionId, opts.action));
    });

  cli
    .command("delete-audio")
    .requiredOption("--sys-audio-name <name>")
    .action(async (opts: { sysAudioName: string }) => {
      print(await getService().deleteAudio(opts.sysAudioName));
    });

  cli
    .command("voice-generate")
    .requiredOption("--text <value>")
    .option("--provider <provider>", "elevenlabs|http", "elevenlabs")
    .option("--voice-id <id>")
    .option("--model-id <id>")
    .action(
      async (opts: {
        text: string;
        provider: "elevenlabs" | "http";
        voiceId?: string;
        modelId?: string;
      }) => {
        const out = await getService().generateAiAudio({
          aiText: opts.text,
          aiProvider: opts.provider,
          voiceId: opts.voiceId,
          modelId: opts.modelId
        });
        print(out);
      }
    );

  await cli.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
