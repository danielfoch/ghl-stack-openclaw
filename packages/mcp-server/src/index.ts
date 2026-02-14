import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "node:path";
import { z } from "zod";
import { actionInputSchema } from "@fub/core";
import { createEngine, makeRequest } from "./runtime.js";
import { synthesizeSpeechToFile } from "@fub/adapters-elevenlabs";

const { engine, config } = createEngine();

const server = new McpServer({
  name: "fub-mcp-server",
  version: "0.1.0"
});

server.tool(
  "fub_action",
  "Execute one validated FUB action. Defaults to dry_run=true and confirm=false.",
  {
    input: actionInputSchema,
    dry_run: z.boolean().default(true),
    confirm: z.boolean().default(false),
    verbose: z.boolean().default(false),
    role: z.enum(["operator", "assistant", "automation", "readonly"]).default("assistant")
  },
  async ({ input, dry_run, confirm, verbose, role }) => {
    const result = await engine.run(
      makeRequest(input, {
        dryRun: dry_run,
        confirm,
        verbose,
        role
      })
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result)
        }
      ]
    };
  }
);

server.tool(
  "slybroadcast_drop_voicemail",
  "Create a Slybroadcast voicemail drop campaign. Supports direct audio URL, existing Sly audio name, or ElevenLabs text-to-speech.",
  {
    phone_numbers: z.array(z.string().min(5)).min(1),
    audio_url: z.string().url().optional(),
    sly_audio_name: z.string().min(1).optional(),
    elevenlabs_text: z.string().min(1).optional(),
    elevenlabs_voice_id: z.string().optional(),
    campaign_name: z.string().optional(),
    caller_id: z.string().optional(),
    send_date: z.string().optional(),
    send_time: z.string().optional(),
    timezone: z.string().optional(),
    repeat_days: z.array(z.number().int().min(0).max(6)).optional(),
    dry_run: z.boolean().default(true),
    confirm: z.boolean().default(false)
  },
  async ({ phone_numbers, audio_url, sly_audio_name, elevenlabs_text, elevenlabs_voice_id, campaign_name, caller_id, send_date, send_time, timezone, repeat_days, dry_run, confirm }) => {
    const audio = await resolveMcpAudioInput({
      audioUrl: audio_url,
      slyAudioName: sly_audio_name,
      elevenlabsText: elevenlabs_text,
      elevenlabsVoiceId: elevenlabs_voice_id
    });

    const result = await engine.run(
      makeRequest(
        {
          action: "voicemail.drop",
          phoneNumbers: phone_numbers,
          audio,
          campaignName: campaign_name,
          callerId: caller_id,
          sendDate: send_date,
          sendTime: send_time,
          timezone,
          repeatDays: repeat_days
        },
        { dryRun: dry_run, confirm, verbose: true }
      )
    );

    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

server.tool(
  "slybroadcast_get_audio_list",
  "List existing uploaded recordings in Slybroadcast.",
  {
    dry_run: z.boolean().default(false),
    confirm: z.boolean().default(true)
  },
  async ({ dry_run, confirm }) => {
    const result = await engine.run(
      makeRequest(
        { action: "voicemail.audio.list" },
        { dryRun: dry_run, confirm, verbose: true }
      )
    );
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

server.tool(
  "slybroadcast_get_campaign_status",
  "Get campaign status by Slybroadcast campaign id.",
  {
    campaign_id: z.string().min(1),
    dry_run: z.boolean().default(false),
    confirm: z.boolean().default(true)
  },
  async ({ campaign_id, dry_run, confirm }) => {
    const result = await engine.run(
      makeRequest(
        { action: "voicemail.campaign.status", campaignId: campaign_id },
        { dryRun: dry_run, confirm, verbose: true }
      )
    );
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

server.tool(
  "workflow_text_and_task",
  "Workflow: text a contact and create a task for follow-up time.",
  {
    personQuery: z.string().min(1),
    message: z.string().min(1),
    dueAt: z.string().min(1),
    dry_run: z.boolean().default(true),
    confirm: z.boolean().default(false)
  },
  async ({ personQuery, message, dueAt, dry_run, confirm }) => {
    const find = await engine.run(
      makeRequest({ action: "person.find", query: personQuery }, { dryRun: false, confirm: true, verbose: true })
    );

    const person = Array.isArray(find.data) ? find.data[0] : undefined;
    if (!person || typeof person !== "object") {
      return { content: [{ type: "text", text: JSON.stringify({ ok: false, error: "person not found" }) }] };
    }

    const personRef = { personId: Number((person as { id: number }).id) };

    const sms = await engine.run(makeRequest({
      action: "message.send",
      channel: "sms",
      to: personQuery.startsWith("+") ? personQuery : "+14165550001",
      body: message,
      person: personRef,
      logToFub: true
    }, { dryRun: dry_run, confirm, verbose: true }));

    const task = await engine.run(makeRequest({
      action: "task.create",
      person: personRef,
      title: `Call follow-up: ${personQuery}`,
      dueAt
    }, { dryRun: dry_run, confirm, verbose: true }));

    return {
      content: [{ type: "text", text: JSON.stringify({ person: find.data, sms, task }) }]
    };
  }
);

server.tool(
  "workflow_listing_status",
  "Workflow: get listing status by address and optionally include CRM context.",
  {
    address: z.string().min(1),
    includeCrmContext: z.boolean().default(false)
  },
  async ({ address, includeCrmContext }) => {
    const listing = await engine.run(makeRequest({ action: "listing.get", address }, { dryRun: false, confirm: true, verbose: true }));

    let crm: unknown = null;
    if (includeCrmContext) {
      crm = await engine.run(makeRequest({ action: "person.find", query: address }, { dryRun: false, confirm: true, verbose: true }));
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: listing.data,
            crm
          })
        }
      ]
    };
  }
);

server.tool(
  "workflow_hotlead_task",
  "Workflow: add tag HotLead and create follow-up task in 2 days.",
  {
    personQuery: z.string().min(1),
    tag: z.string().default("HotLead"),
    dueAt: z.string().optional(),
    dry_run: z.boolean().default(true),
    confirm: z.boolean().default(false)
  },
  async ({ personQuery, tag, dueAt, dry_run, confirm }) => {
    const find = await engine.run(makeRequest({ action: "person.find", query: personQuery }, { dryRun: false, confirm: true, verbose: true }));
    const person = Array.isArray(find.data) ? find.data[0] : undefined;
    const personRef = person && typeof person === "object" ? { personId: Number((person as { id: number }).id) } : { name: personQuery };

    const tagResult = await engine.run(makeRequest({ action: "person.tag.add", person: personRef, tag }, { dryRun: dry_run, confirm, verbose: true }));
    const taskResult = await engine.run(makeRequest({
      action: "task.create",
      person: personRef,
      title: `Follow up with ${personQuery}`,
      dueAt: dueAt ?? new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString()
    }, { dryRun: dry_run, confirm, verbose: true }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ tagResult, taskResult })
        }
      ]
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

async function resolveMcpAudioInput(opts: {
  audioUrl?: string;
  slyAudioName?: string;
  elevenlabsText?: string;
  elevenlabsVoiceId?: string;
}): Promise<{ audioUrl?: string; slyAudioName?: string }> {
  if (opts.audioUrl || opts.slyAudioName) {
    return {
      audioUrl: opts.audioUrl,
      slyAudioName: opts.slyAudioName
    };
  }

  if (!opts.elevenlabsText) {
    throw new Error("Provide audio_url, sly_audio_name, or elevenlabs_text");
  }
  if (!config.ELEVENLABS_API_KEY || !(opts.elevenlabsVoiceId ?? config.ELEVENLABS_TTS_VOICE_ID)) {
    throw new Error("ELEVENLABS_API_KEY and an ElevenLabs voice id are required for elevenlabs_text");
  }
  if (!config.SLYBROADCAST_PUBLIC_AUDIO_BASE_URL) {
    throw new Error("SLYBROADCAST_PUBLIC_AUDIO_BASE_URL is required when using elevenlabs_text");
  }

  const filename = `tts-${Date.now()}.mp3`;
  const outputPath = path.join(config.SLYBROADCAST_AUDIO_STAGING_DIR, filename);
  await synthesizeSpeechToFile({
    apiKey: config.ELEVENLABS_API_KEY,
    baseUrl: config.ELEVENLABS_BASE_URL ?? "https://api.elevenlabs.io",
    voiceId: opts.elevenlabsVoiceId ?? config.ELEVENLABS_TTS_VOICE_ID!,
    modelId: config.ELEVENLABS_TTS_MODEL_ID,
    text: opts.elevenlabsText,
    outputPath
  });

  return {
    audioUrl: `${config.SLYBROADCAST_PUBLIC_AUDIO_BASE_URL.replace(/\/$/, "")}/${filename}`
  };
}
