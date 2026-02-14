import pino from "pino";

export function createLogger(level: string) {
  return pino({
    level,
    redact: {
      paths: [
        "req.headers.authorization",
        "config.FUB_API_KEY",
        "config.SENDHUB_API_KEY",
        "config.SMTP_PASS",
        "config.SENDGRID_API_KEY",
        "config.MAILGUN_API_KEY",
        "config.GMAIL_CLIENT_SECRET",
        "config.GMAIL_REFRESH_TOKEN",
        "config.ELEVENLABS_API_KEY"
      ],
      censor: "[REDACTED]"
    }
  });
}
