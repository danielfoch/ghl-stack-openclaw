import { AppConfig } from "../config.js";
import { HttpJsonProvider } from "./http-json-provider.js";

export function createFaltourProvider(cfg: AppConfig): HttpJsonProvider {
  return new HttpJsonProvider({
    provider: "faltour",
    baseUrl: cfg.FALTOUR_BASE_URL,
    apiKey: cfg.FALTOUR_API_KEY,
    pullPath: cfg.FALTOUR_PULL_PATH,
    pushPath: cfg.FALTOUR_PUSH_PATH
  });
}
