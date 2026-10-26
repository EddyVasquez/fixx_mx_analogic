import { config } from "@/core/config/fixx.config";
import { actionTiming, sleep } from "./actionTiming";

/** Owner decision: the "Send a new code" control stays locked for 60 seconds after each send. */
export const RESEND_LOCK_SEC = 60;

export type SendResult =
  | { ok: true }
  | { ok: false; reason: "phoneInvalid" | "sendFailed" | "network" }
  | { ok: false; reason: "tooMany"; minutes: number };

export type VerifyResult = { ok: true } | { ok: false; reason: "wrongCode" | "expired" | "network" };
export type EmailResult = { ok: true } | { ok: false; reason: "emailInvalid" | "network" };

export const phoneDigits = (phone: string): string => phone.replace(/\D/g, "");

export function phoneProblem(phone: string): "phoneInvalid" | null {
  return phoneDigits(phone).length < 10 ? "phoneInvalid" : null;
}

export function emailProblem(email: string): "emailInvalid" | null {
  return /^\S+@\S+\.\S+$/.test(email.trim()) ? null : "emailInvalid";
}

/** Seconds left before a new code can be requested. */
export function resendRemaining(until: number | null, now: number): number {
  if (until == null) return 0;
  return Math.max(0, Math.ceil((until - now) / 1000));
}

export function formatLock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function nextResendAt(now: number): number {
  return now + RESEND_LOCK_SEC * 1000;
}

/**
 * Demo failures, so each error state can be seen:
 * a number ending in 0000 fails to send, 0001 means too many tries, 0002 drops the connection.
 */
export async function sendSignInCode(phone: string): Promise<SendResult> {
  const digits = phoneDigits(phone);
  if (digits.length < 10) return { ok: false, reason: "phoneInvalid" };
  await sleep(actionTiming.latencyMs);
  if (digits.endsWith("0000")) return { ok: false, reason: "sendFailed" };
  if (digits.endsWith("0001")) return { ok: false, reason: "tooMany", minutes: Math.max(1, Math.round(config.signIn.lockoutSec / 60)) };
  if (digits.endsWith("0002")) return { ok: false, reason: "network" };
  return { ok: true };
}

/** Code 000000 is expired. Code 111111 drops the connection. Anything else must match the demo code. */
export async function verifySignInCode(code: string, sentAt: number, now = Date.now()): Promise<VerifyResult> {
  await sleep(actionTiming.latencyMs);
  const trimmed = code.trim();
  if (trimmed === "000000" || now - sentAt > config.signIn.codeValiditySec * 1000) return { ok: false, reason: "expired" };
  if (trimmed === "111111") return { ok: false, reason: "network" };
  if (trimmed !== config.demoSignInCode) return { ok: false, reason: "wrongCode" };
  return { ok: true };
}

/** An email that starts with fail@ drops the connection. The address itself is kept on screen. */
export async function saveSignInEmail(email: string): Promise<EmailResult> {
  if (emailProblem(email)) return { ok: false, reason: "emailInvalid" };
  await sleep(actionTiming.latencyMs);
  if (email.trim().toLowerCase().startsWith("fail@")) return { ok: false, reason: "network" };
  return { ok: true };
}
