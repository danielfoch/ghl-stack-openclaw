import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { AppConfig } from "./config.js";
import {
  CampaignControlAction,
  CampaignSendInput,
  ParsedGatewayResponse,
  SlybroadcastClient
} from "./slybroadcast-client.js";
import { generateVoiceWithElevenLabs } from "./voice/elevenlabs.js";
import { generateVoiceWithHttpProvider } from "./voice/http-provider.js";

export type AiProvider = "elevenlabs" | "http";

type BaseSendInput = {
  callerId?: string;
  to?: string[];
  listId?: string;
  scheduleAt?: string;
  campaignName?: string;
  endTime?: string;
  dispositionUrl?: string;
  mobileOnly?: boolean;
  remainMessage?: boolean;
};

type AudioRecordInput = BaseSendInput & {
  recordAudioTitle: string;
};

type AudioSysNameInput = BaseSendInput & {
  sysAudioName: string;
};

type AudioUrlInput = BaseSendInput & {
  audioUrl: string;
  audioType: "wav" | "mp3" | "m4a";
};

type AudioFileInput = BaseSendInput & {
  audioFilePath: string;
  audioType?: "wav" | "mp3" | "m4a";
};

type AiTextInput = BaseSendInput & {
  aiText: string;
  aiProvider?: AiProvider;
  voiceId?: string;
  modelId?: string;
};

export type SendVoicemailInput =
  | AudioRecordInput
  | AudioSysNameInput
  | AudioUrlInput
  | AudioFileInput
  | AiTextInput;

export class VoicemailService {
  readonly client: SlybroadcastClient;

  constructor(readonly cfg: AppConfig) {
    this.client = new SlybroadcastClient(cfg.SLYBROADCAST_BASE_URL, {
      uid: cfg.SLYBROADCAST_UID,
      password: cfg.SLYBROADCAST_PASSWORD
    });
  }

  async sendVoicemail(input: SendVoicemailInput): Promise<
    ParsedGatewayResponse & {
      request: CampaignSendInput;
      preparedAudio?: {
        filePath: string;
        publicUrl?: string;
      };
    }
  > {
    const request: CampaignSendInput = {
      callerId: input.callerId ?? this.cfg.SLYBROADCAST_DEFAULT_CALLER_ID ?? "",
      date: input.scheduleAt ?? "now",
      title: input.campaignName,
      endTime: input.endTime,
      dispositionUrl: input.dispositionUrl,
      mobileOnly: input.mobileOnly,
      remainMessage: input.remainMessage,
      phonesCsv: input.to?.join(","),
      listId: input.listId
    };

    if (!request.callerId) {
      throw new Error(
        "callerId is required (pass --caller-id or set SLYBROADCAST_DEFAULT_CALLER_ID)"
      );
    }

    const preparedAudio: { filePath: string; publicUrl?: string } | undefined =
      undefined;

    if ("recordAudioTitle" in input) {
      request.recordAudioTitle = input.recordAudioTitle;
    } else if ("sysAudioName" in input) {
      request.sysAudioName = input.sysAudioName;
    } else if ("audioUrl" in input) {
      request.audioUrl = input.audioUrl;
      request.audioType = input.audioType;
    } else if ("audioFilePath" in input) {
      const staged = await this.stageAudioFile(input.audioFilePath);
      request.audioUrl = staged.publicUrl;
      request.audioType =
        input.audioType ?? (staged.extension as "wav" | "mp3" | "m4a");
      return {
        ...(await this.client.sendCampaign(request)),
        request,
        preparedAudio: {
          filePath: staged.filePath,
          publicUrl: staged.publicUrl
        }
      };
    } else if ("aiText" in input) {
      const aiAudio = await this.generateAiAudio(input);
      request.audioUrl = aiAudio.publicUrl;
      request.audioType = aiAudio.extension;
      return {
        ...(await this.client.sendCampaign(request)),
        request,
        preparedAudio: {
          filePath: aiAudio.filePath,
          publicUrl: aiAudio.publicUrl
        }
      };
    }

    return {
      ...(await this.client.sendCampaign(request)),
      request,
      preparedAudio
    };
  }

  async generateAiAudio(input: {
    aiText: string;
    aiProvider?: AiProvider;
    voiceId?: string;
    modelId?: string;
  }): Promise<{ filePath: string; publicUrl: string; extension: "mp3" | "wav" | "m4a" }> {
    const provider = input.aiProvider ?? "elevenlabs";

    let generated: { filePath: string; extension: "mp3" | "wav" | "m4a" };
    if (provider === "elevenlabs") {
      if (!this.cfg.ELEVENLABS_API_KEY) {
        throw new Error("ELEVENLABS_API_KEY is required for aiProvider=elevenlabs");
      }
      const voiceId = input.voiceId ?? this.cfg.ELEVENLABS_TTS_VOICE_ID;
      if (!voiceId) {
        throw new Error("voiceId is required (or ELEVENLABS_TTS_VOICE_ID env)");
      }
      generated = await generateVoiceWithElevenLabs({
        apiKey: this.cfg.ELEVENLABS_API_KEY,
        baseUrl: this.cfg.ELEVENLABS_BASE_URL,
        voiceId,
        modelId: input.modelId ?? this.cfg.ELEVENLABS_TTS_MODEL_ID,
        text: input.aiText,
        outputDir: this.cfg.SLYBROADCAST_AUDIO_STAGING_DIR
      });
    } else {
      if (!this.cfg.VOICE_HTTP_BASE_URL) {
        throw new Error("VOICE_HTTP_BASE_URL is required for aiProvider=http");
      }
      generated = await generateVoiceWithHttpProvider({
        baseUrl: this.cfg.VOICE_HTTP_BASE_URL,
        apiKey: this.cfg.VOICE_HTTP_API_KEY,
        text: input.aiText,
        voiceId: input.voiceId,
        modelId: input.modelId,
        outputDir: this.cfg.SLYBROADCAST_AUDIO_STAGING_DIR
      });
    }

    const publicUrl = this.toPublicAudioUrl(generated.filePath);
    return {
      ...generated,
      publicUrl
    };
  }

  async stageAudioFile(filePath: string): Promise<{
    filePath: string;
    extension: "wav" | "mp3" | "m4a";
    publicUrl: string;
  }> {
    const extension = inferAudioType(filePath);
    const stagedDir = this.cfg.SLYBROADCAST_AUDIO_STAGING_DIR;
    await mkdir(stagedDir, { recursive: true });

    const target = path.join(
      stagedDir,
      `upload-${Date.now()}-${Math.random().toString(16).slice(2, 8)}.${extension}`
    );
    await cp(filePath, target);

    return {
      filePath: target,
      extension,
      publicUrl: this.toPublicAudioUrl(target)
    };
  }

  async getAudioList(withDuration = false) {
    return this.client.getAudioList(withDuration);
  }

  async getPhoneList() {
    return this.client.getPhoneList();
  }

  async getCampaignStatus(sessionId: string, phone?: string) {
    return this.client.campaignStatus(sessionId, phone);
  }

  async getCampaignResults(sessionId: string) {
    return this.client.campaignResults(sessionId);
  }

  async controlCampaign(sessionId: string, action: CampaignControlAction) {
    return this.client.controlCampaign(sessionId, action);
  }

  async deleteAudio(sysAudioName: string) {
    return this.client.deleteAudio(sysAudioName);
  }

  toPublicAudioUrl(filePath: string): string {
    const base = this.cfg.SLYBROADCAST_PUBLIC_AUDIO_BASE_URL;
    if (!base) {
      throw new Error(
        "SLYBROADCAST_PUBLIC_AUDIO_BASE_URL is required when using local/AI-generated audio"
      );
    }
    return `${base.replace(/\/$/, "")}/${encodeURIComponent(path.basename(filePath))}`;
  }
}

function inferAudioType(filePath: string): "wav" | "mp3" | "m4a" {
  const ext = path.extname(filePath).replace(/^\./, "").toLowerCase();
  if (ext === "wav" || ext === "mp3" || ext === "m4a") return ext;
  throw new Error("Audio file extension must be .wav, .mp3, or .m4a");
}
