import { Agent } from "@prisma/client";

declare global {
  namespace Express {
    type AuthMethod = "session" | "api_key";

    interface Request {
      agent?: Agent;
      authMethod?: AuthMethod;
      csrfToken?: () => string;
    }
  }
}

export {};
