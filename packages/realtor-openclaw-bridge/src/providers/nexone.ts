import { AppConfig } from "../config.js";
import { HttpJsonProvider } from "./http-json-provider.js";

export function createNexoneProvider(cfg: AppConfig): HttpJsonProvider {
  return new HttpJsonProvider({
    provider: "nexone",
    baseUrl: cfg.NEXONE_BASE_URL,
    apiKey: cfg.NEXONE_API_KEY,
    pullPath: cfg.NEXONE_PULL_PATH,
    pushPath: cfg.NEXONE_PUSH_PATH
  });
}
