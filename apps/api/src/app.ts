import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import csurf from "csurf";
import { config } from "./config";
import { attachAgent } from "./middleware/auth";
import { botOnlyGate } from "./middleware/agentGate";
import { authRouter } from "./routes/auth";
import { listingsRouter } from "./routes/listings";
import { adminRouter } from "./routes/admin";
import { parcelsRouter } from "./routes/parcels";
import { realtorRouter } from "./routes/realtors";
import { ugcRouter } from "./routes/ugc";

export function createApp() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", config.appOrigin],
          imgSrc: ["'self'", "https:", "data:"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    })
  );

  app.use(
    cors({
      origin: config.appOrigin,
      credentials: true,
    })
  );

  app.use(cookieParser(config.csrfSecret));
  app.use(express.json({ limit: "1mb" }));
  app.use(attachAgent);

  const csrfProtection = csurf({ cookie: { httpOnly: true, sameSite: "lax", secure: config.nodeEnv === "production" } });
  const csrfIfNeeded: express.RequestHandler = (req, res, next) => {
    if (req.authMethod === "api_key") return next();
    return csrfProtection(req, res, next);
  };

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/security/csrf", csrfProtection, (req, res) => res.json({ csrfToken: req.csrfToken?.() }));

  app.use("/auth", authRouter);
  app.use(botOnlyGate);

  app.use("/listings", csrfIfNeeded, listingsRouter);
  app.use("/admin", csrfIfNeeded, adminRouter);
  app.use("/parcels", csrfIfNeeded, parcelsRouter);
  app.use("/realtors", csrfIfNeeded, realtorRouter);
  app.use("/ugc", csrfIfNeeded, ugcRouter);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err.code === "EBADCSRFTOKEN") {
      return res.status(403).json({ error: "Invalid CSRF token" });
    }
    return res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
