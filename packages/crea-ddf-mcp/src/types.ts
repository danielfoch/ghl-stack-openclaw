export type HttpMethod = "GET" | "POST";

export type DdfConfig = {
  baseUrl: string;
  authUrl: string;
  tokenGrant: "password" | "client_credentials";
  authUseBasic: boolean;
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  scope?: string;
  propertyKeyStyle: "quoted" | "unquoted";
  defaultTop: number;
  maxTop: number;
  timeoutMs: number;
  retries: number;
  concurrency: number;
  rps: number;
  burst: number;
  userAgent?: string;
  mediaEntity: string;
  mediaRecordKeyField: string;
  mediaOrderField: string;
};

export type PropertyFilters = {
  city?: string;
  province?: string;
  postalCode?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  minBaths?: number;
  status?: string;
  updatedSince?: string;
};
