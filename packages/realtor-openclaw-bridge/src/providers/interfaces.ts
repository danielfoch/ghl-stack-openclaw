import {
  BridgeProviderName,
  OpenClawBridgeEvent,
  ProviderPullResult,
  ProviderPushResult,
  PullRequest
} from "../types.js";

export type ProviderHealth = {
  provider: BridgeProviderName;
  ok: boolean;
  detail: string;
};

export interface ProviderAdapter {
  readonly name: BridgeProviderName;
  healthCheck(): Promise<ProviderHealth>;
  pull(input: PullRequest): Promise<ProviderPullResult>;
  push(event: OpenClawBridgeEvent): Promise<ProviderPushResult>;
}
