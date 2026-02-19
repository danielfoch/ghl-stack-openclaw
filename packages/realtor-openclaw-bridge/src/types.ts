export type BridgeProviderName = "nexone" | "faltour" | "lonewolf";

export type BridgeDirection = "push" | "pull";

export type BridgeResource =
  | "offers"
  | "folders"
  | "documents"
  | "listings"
  | "contacts"
  | "custom";

export type OpenClawEntityType =
  | "contact"
  | "listing"
  | "offer"
  | "transaction"
  | "document"
  | "custom";

export type OpenClawBridgeEvent = {
  id: string;
  source: "openclaw";
  entityType: OpenClawEntityType;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type ProviderPushResult = {
  provider: BridgeProviderName;
  accepted: boolean;
  statusCode?: number;
  response: unknown;
};

export type ProviderPullResult = {
  provider: BridgeProviderName;
  resource: BridgeResource;
  records: unknown[];
  nextCursor?: string;
  raw?: unknown;
};

export type PullRequest = {
  resource: BridgeResource;
  userId?: string;
  filter?: string;
  cursor?: string;
  limit?: number;
};

export type BridgeEventLog = {
  id: string;
  source: string;
  provider: BridgeProviderName;
  direction: BridgeDirection;
  status: "ok" | "error";
  payload: unknown;
  response?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
};
