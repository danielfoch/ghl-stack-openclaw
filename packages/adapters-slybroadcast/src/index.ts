import type {
  SlybroadcastAdapter,
  SlybroadcastCampaignRequest,
  SlybroadcastCampaignResult
} from "@fub/core";

type SlybroadcastResponse = {
  status?: string;
  error_message?: string;
  campaign_id?: string | number;
  [key: string]: unknown;
};

export class SlybroadcastApiAdapter implements SlybroadcastAdapter {
  constructor(
    private readonly opts: { baseUrl: string; email: string; password: string; defaultCallerId?: string }
  ) {}

  async createCampaign(request: SlybroadcastCampaignRequest): Promise<SlybroadcastCampaignResult> {
    const payload = new URLSearchParams();
    payload.set("c_phone", request.phoneNumbers.join(","));

    if (request.audio.audioUrl) {
      payload.set("c_url", request.audio.audioUrl);
    } else if (request.audio.slyAudioName) {
      payload.set("c_audio", request.audio.slyAudioName);
    }

    if (request.campaignName) payload.set("c_description", request.campaignName);
    if (request.callerId ?? this.opts.defaultCallerId) {
      payload.set("c_callerID", request.callerId ?? this.opts.defaultCallerId ?? "");
    }
    if (request.sendDate) payload.set("c_date", request.sendDate);
    if (request.sendTime) payload.set("c_time", request.sendTime);
    if (request.timezone) payload.set("c_timezone", request.timezone);
    if (request.repeatDays && request.repeatDays.length > 0) {
      payload.set("c_repeat", request.repeatDays.join(""));
    }

    const data = await this.call("new_campaign", payload);
    const campaignId = String(data.campaign_id ?? "").trim();
    if (!campaignId) {
      throw new Error(`Slybroadcast did not return a campaign_id: ${JSON.stringify(data)}`);
    }

    return {
      campaignId,
      raw: data
    };
  }

  async getAudioList(): Promise<unknown> {
    return this.call("get_audio_list", new URLSearchParams());
  }

  async getCampaignStatus(campaignId: string): Promise<unknown> {
    const payload = new URLSearchParams();
    payload.set("c_campaign", campaignId);
    return this.call("get_campaign_status", payload);
  }

  private async call(service: string, payload: URLSearchParams): Promise<SlybroadcastResponse> {
    payload.set("email", this.opts.email);
    payload.set("password", this.opts.password);

    const response = await fetch(`${this.opts.baseUrl.replace(/\/$/, "")}/${service}.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: payload.toString()
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Slybroadcast ${service} failed: ${response.status} ${text}`);
    }

    let data: SlybroadcastResponse;
    try {
      data = JSON.parse(text) as SlybroadcastResponse;
    } catch {
      throw new Error(`Slybroadcast ${service} returned non-JSON: ${text}`);
    }

    if (`${data.status ?? ""}`.toUpperCase() !== "SUCCESS") {
      throw new Error(`Slybroadcast ${service} failed: ${data.error_message ?? "unknown error"}`);
    }

    return data;
  }
}

export class MockSlybroadcastAdapter implements SlybroadcastAdapter {
  async createCampaign(request: SlybroadcastCampaignRequest): Promise<SlybroadcastCampaignResult> {
    return {
      campaignId: `mock-campaign-${Date.now()}`,
      raw: {
        status: "SUCCESS",
        request
      }
    };
  }

  async getAudioList(): Promise<unknown> {
    return {
      status: "SUCCESS",
      audios: [
        { c_audio: "mock_recording_1", duration: 12 },
        { c_audio: "mock_recording_2", duration: 21 }
      ]
    };
  }

  async getCampaignStatus(campaignId: string): Promise<unknown> {
    return {
      status: "SUCCESS",
      campaign_id: campaignId,
      c_status: "ACTIVE"
    };
  }
}
