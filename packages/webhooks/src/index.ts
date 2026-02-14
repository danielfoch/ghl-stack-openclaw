import express, { type Request, type Response } from "express";
import { extractActionFromInbound, SlidingWindowRateLimiter } from "@fub/core";
import { verifySendhubWebhook } from "@fub/adapters-sendhub";
import { createEngine, toActionRequest } from "./runtime.js";

const app = express();
const { engine, config, store } = createEngine();
const limiter = new SlidingWindowRateLimiter(20, 60_000);

app.use("/inbound/sendhub", express.text({ type: "*/*" }));
app.use(express.json());

app.post("/inbound/sendhub", async (req: Request, res: Response) => {
  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
  const signature = req.header("x-sendhub-signature");
  const eventId = req.header("x-event-id") ?? `evt-${Date.now()}`;

  if (!verifySendhubWebhook(signature, raw, config.SENDHUB_WEBHOOK_SECRET)) {
    return res.status(401).json({ ok: false, error: "invalid signature" });
  }

  if (store.hasWebhookEvent("sendhub", eventId)) {
    return res.status(200).json({ ok: true, replay: true });
  }

  const body = JSON.parse(raw) as { text: string; from: string };
  if (!limiter.allow(`sms:${body.from}`)) return res.status(429).json({ ok: false, error: "rate limited" });

  try {
    const action = extractActionFromInbound({
      source: {
        fromPhone: body.from,
        providedSecret: req.header("x-webhook-secret") ?? undefined
      },
      body: body.text,
      transport: "sms",
      receivedAt: new Date().toISOString()
    }, config);

    const result = await engine.run(toActionRequest(action.input as never, { idempotencyKey: action.idempotencyKey }));
    store.storeWebhookEvent("sendhub", eventId, body, new Date().toISOString());
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ ok: false, error: (error as Error).message });
  }
});

app.post("/inbound/email", async (req: Request, res: Response) => {
  const eventId = req.header("x-event-id") ?? `evt-${Date.now()}`;
  if (store.hasWebhookEvent("email", eventId)) return res.status(200).json({ ok: true, replay: true });

  const payload = req.body as { from: string; text: string };
  if (!limiter.allow(`email:${payload.from}`)) return res.status(429).json({ ok: false, error: "rate limited" });
  try {
    const action = extractActionFromInbound({
      source: {
        fromEmail: payload.from,
        providedSecret: req.header("x-webhook-secret") ?? undefined
      },
      body: payload.text,
      transport: "email",
      receivedAt: new Date().toISOString()
    }, config);

    const result = await engine.run(toActionRequest(action.input as never, { idempotencyKey: action.idempotencyKey }));
    store.storeWebhookEvent("email", eventId, payload, new Date().toISOString());
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ ok: false, error: (error as Error).message });
  }
});

app.post("/inbound/voice", async (req: Request, res: Response) => {
  const eventId = req.header("x-event-id") ?? `evt-${Date.now()}`;
  if (store.hasWebhookEvent("voice", eventId)) return res.status(200).json({ ok: true, replay: true });

  const payload = req.body as { caller: string; transcript: string };
  if (!limiter.allow(`voice:${payload.caller}`)) return res.status(429).json({ ok: false, error: "rate limited" });
  try {
    const action = extractActionFromInbound({
      source: {
        fromPhone: payload.caller,
        providedSecret: req.header("x-webhook-secret") ?? undefined
      },
      body: payload.transcript,
      transport: "voice",
      receivedAt: new Date().toISOString()
    }, config);

    const result = await engine.run(toActionRequest(action.input as never, { idempotencyKey: action.idempotencyKey }));
    store.storeWebhookEvent("voice", eventId, payload, new Date().toISOString());
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ ok: false, error: (error as Error).message });
  }
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "fub-webhooks" });
});

const port = process.env.PORT ? Number(process.env.PORT) : 8787;
app.listen(port, () => {
  console.log(JSON.stringify({ ok: true, port }));
});
