import crypto from "node:crypto";

const ALGO = "aes-256-gcm";

export function encryptText(plaintext: string, key: string): string {
  const iv = crypto.randomBytes(12);
  const secret = crypto.createHash("sha256").update(key).digest();
  const cipher = crypto.createCipheriv(ALGO, secret, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}
