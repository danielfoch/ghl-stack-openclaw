import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { CampaignControlAction } from "./slybroadcast-client.js";
import { SendVoicemailInput, VoicemailService } from "./service.js";

const cfg = loadConfig();
const service = new VoicemailService(cfg);

const server = new McpServer({
  name: "slybroadcast-voicemail",
  version: "0.1.0"
});

function asText(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }]
  };
}

function mapSendInput(input: {
  to?: string[];
  listId?: string;
  callerId?: string;
  scheduleAt?: string;
  campaignName?: string;
  endTime?: string;
  dispositionUrl?: string;
  mobileOnly?: boolean;
  remainMessage?: boolean;
  recordAudioTitle?: string;
  sysAudioName?: string;
  audioUrl?: string;
  audioType?: "wav" | "mp3" | "m4a";
  audioFilePath?: string;
  aiText?: string;
  aiProvider?: "elevenlabs" | "http";
  voiceId?: string;
  modelId?: string;
}): SendVoicemailInput {
  const base = {
    to: input.to,
    listId: input.listId,
    callerId: input.callerId,
    scheduleAt: input.scheduleAt,
    campaignName: input.campaignName,
    endTime: input.endTime,
    dispositionUrl: input.dispositionUrl,
    mobileOnly: input.mobileOnly,
    remainMessage: input.remainMessage
  };

  const picks = [
    Boolean(input.recordAudioTitle),
    Boolean(input.sysAudioName),
    Boolean(input.audioUrl),
    Boolean(input.audioFilePath),
    Boolean(input.aiText)
  ].filter(Boolean).length;

  if (picks !== 1) {
    throw new Error(
      "Exactly one audio source required: recordAudioTitle, sysAudioName, audioUrl, audioFilePath, or aiText"
    );
  }

  if (input.recordAudioTitle) {
    return { ...base, recordAudioTitle: input.recordAudioTitle };
  }
  if (input.sysAudioName) {
    return { ...base, sysAudioName: input.sysAudioName };
  }
  if (input.audioUrl) {
    if (!input.audioType) {
      throw new Error("audioType is required with audioUrl");
    }
    return {
      ...base,
      audioUrl: input.audioUrl,
      audioType: input.audioType
    };
  }
  if (input.audioFilePath) {
    return {
      ...base,
      audioFilePath: input.audioFilePath,
      audioType: input.audioType
    };
  }
  return {
    ...base,
    aiText: input.aiText as string,
    aiProvider: input.aiProvider,
    voiceId: input.voiceId,
    modelId: input.modelId
  };
}

server.tool(
  "slybroadcast_voicemail_send",
  {
    to: z.array(z.string()).optional(),
    listId: z.string().optional(),
    callerId: z.string().optional(),
    scheduleAt: z.string().optional(),
    campaignName: z.string().optional(),
    endTime: z.string().optional(),
    dispositionUrl: z.string().url().optional(),
    mobileOnly: z.boolean().optional(),
    remainMessage: z.boolean().optional(),
    recordAudioTitle: z.string().optional(),
    sysAudioName: z.string().optional(),
    audioUrl: z.string().url().optional(),
    audioType: z.enum(["wav", "mp3", "m4a"]).optional(),
    audioFilePath: z.string().optional(),
    aiText: z.string().optional(),
    aiProvider: z.enum(["elevenlabs", "http"]).optional(),
    voiceId: z.string().optional(),
    modelId: z.string().optional()
  },
  async (input) => asText(await service.sendVoicemail(mapSendInput(input)))
);

server.tool(
  "slybroadcast_audio_list",
  {
    withDuration: z.boolean().optional()
  },
  async ({ withDuration }) => asText(await service.getAudioList(Boolean(withDuration)))
);

server.tool("slybroadcast_phone_list", {}, async () =>
  asText(await service.getPhoneList())
);

server.tool(
  "slybroadcast_campaign_status",
  {
    sessionId: z.string().min(1),
    phone: z.string().optional()
  },
  async ({ sessionId, phone }) =>
    asText(await service.getCampaignStatus(sessionId, phone))
);

server.tool(
  "slybroadcast_campaign_results",
  {
    sessionId: z.string().min(1)
  },
  async ({ sessionId }) => asText(await service.getCampaignResults(sessionId))
);

server.tool(
  "slybroadcast_campaign_control",
  {
    sessionId: z.string().min(1),
    action: z.enum(["pause", "run", "cancel", "stop"])
  },
  async ({ sessionId, action }) =>
    asText(
      await service.controlCampaign(sessionId, action as CampaignControlAction)
    )
);

server.tool(
  "slybroadcast_voice_generate",
  {
    text: z.string().min(1),
    provider: z.enum(["elevenlabs", "http"]).optional(),
    voiceId: z.string().optional(),
    modelId: z.string().optional()
  },
  async ({ text, provider, voiceId, modelId }) =>
    asText(
      await service.generateAiAudio({
        aiText: text,
        aiProvider: provider,
        voiceId,
        modelId
      })
    )
);

const transport = new StdioServerTransport();
await server.connect(transport);
