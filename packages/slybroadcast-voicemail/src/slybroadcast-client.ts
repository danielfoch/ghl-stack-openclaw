export type CampaignControlAction = "pause" | "run" | "cancel" | "stop";

type Primitive = string | number | boolean | undefined | null;

export interface CampaignSendInput {
  callerId: string;
  date?: string;
  title?: string;
  endTime?: string;
  dispositionUrl?: string;
  mobileOnly?: boolean;
  remainMessage?: boolean;
  phonesCsv?: string;
  listId?: string;
  recordAudioTitle?: string;
  sysAudioName?: string;
  audioUrl?: string;
  audioType?: "wav" | "mp3" | "m4a";
}

export interface ParsedGatewayResponse {
  ok: boolean;
  sessionId?: string;
  raw: unknown;
  rawText: string;
}

interface Credentials {
  uid: string;
  password: string;
}

export class SlybroadcastClient {
  constructor(
    private readonly baseUrl: string,
    private readonly credentials: Credentials
  ) {}

  async sendCampaign(input: CampaignSendInput): Promise<ParsedGatewayResponse> {
    if (!input.phonesCsv && !input.listId) {
      throw new Error("Provide phonesCsv or listId");
    }
    if (!input.recordAudioTitle && !input.sysAudioName && !input.audioUrl) {
      throw new Error(
        "Provide one audio source: recordAudioTitle, sysAudioName, or audioUrl"
      );
    }
    if (input.audioUrl && !input.audioType) {
      throw new Error("audioType is required when audioUrl is provided");
    }

    return this.postForm({
      c_method: "new_campaign",
      c_callerID: input.callerId,
      c_phone: input.phonesCsv,
      c_listid: input.listId,
      c_date: input.date ?? "now",
      c_title: input.title,
      c_endtime: input.endTime,
      c_dispo_url: input.dispositionUrl,
      mobile_only: input.mobileOnly ? 1 : undefined,
      remain_message: input.remainMessage ? 1 : undefined,
      c_record_audio: input.recordAudioTitle,
      c_sys_audio_name: input.sysAudioName,
      c_url: input.audioUrl,
      c_audio: input.audioType
    });
  }

  async getAudioList(withDuration = false): Promise<ParsedGatewayResponse> {
    return this.postForm({
      c_method: withDuration ? "get_audio_list_with_duration" : "get_audio_list"
    });
  }

  async getPhoneList(): Promise<ParsedGatewayResponse> {
    return this.postForm({ c_method: "get_phone_list" });
  }

  async deleteAudio(sysAudioName: string): Promise<ParsedGatewayResponse> {
    return this.postForm({
      c_method: "delete_audio",
      c_sys_audio_name: sysAudioName
    });
  }

  async campaignStatus(
    sessionId: string,
    phone?: string
  ): Promise<ParsedGatewayResponse> {
    return this.postForm({
      c_option: "callstatus",
      session_id: sessionId,
      c_phone: phone
    });
  }

  async campaignResults(sessionId: string): Promise<ParsedGatewayResponse> {
    return this.postForm({
      c_option: "campaign_result",
      session_id: sessionId
    });
  }

  async controlCampaign(
    sessionId: string,
    action: CampaignControlAction
  ): Promise<ParsedGatewayResponse> {
    return this.postForm({
      c_option: action,
      session_id: sessionId
    });
  }

  private async postForm(
    fields: Record<string, Primitive>
  ): Promise<ParsedGatewayResponse> {
    const form = new URLSearchParams();
    form.set("c_uid", this.credentials.uid);
    form.set("c_password", this.credentials.password);

    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined || value === null || value === "") continue;
      form.set(key, String(value));
    }

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form.toString()
    });

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(
        `Slybroadcast HTTP ${response.status}: ${rawText.slice(0, 500)}`
      );
    }

    const raw = parseMaybeJson(rawText);
    const sessionId = extractSessionId(rawText, raw);
    const ok = looksSuccessful(rawText, raw);

    return {
      ok,
      sessionId,
      raw,
      rawText
    };
  }
}

function parseMaybeJson(rawText: string): unknown {
  const trimmed = rawText.trim();
  if (!trimmed) return "";
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function extractSessionId(rawText: string, raw: unknown): string | undefined {
  if (raw && typeof raw === "object") {
    for (const key of ["session_id", "sessionId", "id"]) {
      const value = (raw as Record<string, unknown>)[key];
      if (typeof value === "string" || typeof value === "number") {
        return String(value);
      }
    }
  }

  const direct = rawText.match(/session[_ ]?id[^\d]*(\d{6,})/i)?.[1];
  if (direct) return direct;

  const loose = rawText.match(/\b(\d{6,})\b/)?.[1];
  return loose;
}

function looksSuccessful(rawText: string, raw: unknown): boolean {
  if (typeof raw === "object" && raw && "error" in (raw as object)) {
    return false;
  }
  if (typeof raw === "string") {
    const t = raw.trim().toLowerCase();
    if (!t) return false;
    if (t.startsWith("ok") || t.includes("success")) return true;
    if (t.includes("error") || t.includes("missing") || t.includes("invalid")) {
      return false;
    }
  }
  return true;
}
