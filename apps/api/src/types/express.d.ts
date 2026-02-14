import { Agent } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      agent?: Agent;
      csrfToken?: () => string;
    }
  }
}

export {};
