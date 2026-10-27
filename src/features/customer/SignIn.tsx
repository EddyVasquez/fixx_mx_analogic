import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { config } from "@/core/config/fixx.config";
import { Button } from "@/ui/Button";
import { DemoValue } from "@/ui/DemoBadge";
import { ErrorText, Field, inputClass } from "@/ui/Field";
import { actionTiming, createSingleFlight, runTimed } from "./actionTiming";
import { emailProblem, formatLock, nextResendAt, phoneProblem, resendRemaining, saveSignInEmail, sendSignInCode, verifySignInCode } from "./signInActions";

type Step = "phone" | "code" | "email";
type Phase = "idle" | "processing" | "failed";
type Busy = "send" | "verify" | "save" | "resend" | null;

/** Phone sign-in (code by SMS or WhatsApp), then email capture. Codes are simulated; the demo code is shown on screen. */
export function SignIn({ onDone }: { onDone: (email: string) => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("phone");
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState<Busy>(null);
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [errorVars, setErrorVars] = useState<Record<string, string | number>>({});
  const [slow, setSlow] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [resendUntil, setResendUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const phoneRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const once = useRef(createSingleFlight());
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const remaining = resendRemaining(resendUntil, now);
  const channelName = t(`signin.${channel}`);

  useEffect(() => {
    const el = step === "phone" ? phoneRef.current : step === "code" ? codeRef.current : emailRef.current;
    el?.focus();
  }, [step]);

  useEffect(() => {
    if (resendUntil == null || resendUntil <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [resendUntil]);

  useEffect(() => {
    if (!errorKey) return;
    if (errorKey === "signin.phoneInvalid" || errorKey === "signin.sendFailed") phoneRef.current?.focus();
    else if (errorKey === "signin.wrongCode") { codeRef.current?.focus(); codeRef.current?.select(); }
    else if (errorKey === "signin.emailInvalid") emailRef.current?.focus();
    else errorRef.current?.focus();
  }, [errorKey, errorVars]);

  const fail = (key: string, vars: Record<string, string | number> = {}) => {
    setPhase("failed");
    setBusy(null);
    setSlow(false);
    setErrorKey(key);
    setErrorVars(vars);
  };

  const send = (action: "send" | "resend") => once.current(async () => {
    if (action === "resend" && resendRemaining(resendUntil, Date.now()) > 0) return;
    const problem = phoneProblem(phone);
    if (problem) { fail("signin.phoneInvalid"); return; }
    setPhase("processing");
    setBusy(action);
    setErrorKey(null);
    setSlow(false);
    const timed = await runTimed(() => sendSignInCode(phone), () => setSlow(true));
    if (!timed.ok) { fail("common.network"); return; }
    if (!timed.value.ok) {
      fail(timed.value.reason === "tooMany" ? "signin.tooMany" : timed.value.reason === "sendFailed" ? "signin.sendFailed" : timed.value.reason === "phoneInvalid" ? "signin.phoneInvalid" : "common.network",
        timed.value.reason === "tooMany" ? { minutes: timed.value.minutes } : {});
      return;
    }
    const stamp = Date.now();
    setSentAt(stamp);
    setResendUntil(nextResendAt(stamp));
    setNow(stamp);
    setPhase("idle");
    setBusy(null);
    setSlow(false);
    setStep("code");
    if (action === "resend") codeRef.current?.focus();
  });

  const verify = () => once.current(async () => {
    setPhase("processing");
    setBusy("verify");
    setErrorKey(null);
    setSlow(false);
    const timed = await runTimed(() => verifySignInCode(code, sentAt ?? Date.now()), () => setSlow(true));
    if (!timed.ok) { fail("common.network"); return; }
    if (!timed.value.ok) {
      fail(timed.value.reason === "wrongCode" ? "signin.wrongCode" : timed.value.reason === "expired" ? "signin.expired" : "common.network");
      return;
    }
    setPhase("idle");
    setBusy(null);
    setErrorKey(null);
    setStep("email");
  });

  const save = () => once.current(async () => {
    if (emailProblem(email)) { fail("signin.emailInvalid"); return; }
    setPhase("processing");
    setBusy("save");
    setErrorKey(null);
    setSlow(false);
    const timed = await runTimed(() => saveSignInEmail(email), () => setSlow(true));
    if (!timed.ok) { fail("common.network"); return; }
    if (!timed.value.ok) { fail(timed.value.reason === "emailInvalid" ? "signin.emailInvalid" : "common.network"); return; }
    onDoneRef.current(email.trim());
  });

  const status = phase === "processing"
    ? busy === "verify" ? t("btn.checking") : busy === "save" ? t("btn.saving") : t("signin.sending", { channel: channelName })
    : "";
  const phoneFault = errorKey === "signin.phoneInvalid" || errorKey === "signin.sendFailed";
  const codeFault = errorKey === "signin.wrongCode";
  const emailFault = errorKey === "signin.emailInvalid";
  const locked = phase === "processing";

  return (
    <div className="flex flex-col gap-4">
      {step !== "email" && <h2 className="text-2xl font-bold">{t("signin.title")}</h2>}
      {step === "phone" && (
        <>
          <Field label={t("signin.phone")}>
            <div className="flex gap-2">
              <span className="flex min-h-touch items-center rounded-lg border-2 border-ink bg-paper px-3 font-bold">+52</span>
              <input
                ref={phoneRef}
                id="signin-phone"
                className={inputClass}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={phone}
                readOnly={locked}
                aria-invalid={phoneFault || undefined}
                aria-describedby={errorKey ? "signin-error" : undefined}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </Field>
          <fieldset className="flex flex-col gap-2" disabled={locked}>
            <legend className="font-semibold">{t("signin.sendBy")}</legend>
            <div className="flex gap-2">
              {(["sms", "whatsapp"] as const).map((c) => (
                <label key={c} className="flex min-h-touch flex-1 items-center gap-2 rounded-lg border-2 border-ink bg-paper px-3">
                  <input type="radio" name="channel" className="h-5 w-5" checked={channel === c} onChange={() => setChannel(c)} />
                  {t(`signin.${c}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-sm"><DemoValue>{t("signin.demoHints")}</DemoValue></p>
        </>
      )}
      {step === "code" && (
        <>
          <p>{t("signin.codeSent", { channel: channelName, phone: `+52 ${phone}`, minutes: Math.round(config.signIn.codeValiditySec / 60) })}</p>
          <p><DemoValue>{t("signin.demoCode", { code: config.demoSignInCode })}</DemoValue></p>
          <Field label={t("signin.code")}>
            <input
              ref={codeRef}
              id="signin-code"
              className={inputClass}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              readOnly={locked}
              aria-invalid={codeFault || undefined}
              aria-describedby={errorKey ? "signin-error" : undefined}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
        </>
      )}
      {step === "email" && (
        <>
          <h2 className="text-2xl font-bold">{t("signin.email.title")}</h2>
          <Field label={t("signin.email")} hint={t("signin.emailWhy")}>
            <input
              ref={emailRef}
              id="signin-email"
              className={inputClass}
              type="email"
              autoComplete="email"
              value={email}
              readOnly={locked}
              aria-invalid={emailFault || undefined}
              aria-describedby={errorKey ? "signin-error" : undefined}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
        </>
      )}
      <div role="status" aria-live="polite" className="font-semibold">
        {status && <p>{status}</p>}
        {slow && phase === "processing" && <p>{t("common.slow")}</p>}
      </div>
      {errorKey && <ErrorText ref={errorRef} id="signin-error">{t(errorKey, errorVars)}</ErrorText>}
      {step === "phone" && (
        <Button className="w-full" loading={busy === "send"} onClick={() => send("send")}>
          {busy === "send" ? t("btn.sending") : phase === "failed" ? t("btn.tryAgain") : t("btn.sendCode")}
        </Button>
      )}
      {step === "code" && (
        <>
          <Button className="w-full" loading={busy === "verify"} onClick={() => verify()}>
            {busy === "verify" ? t("btn.checking") : phase === "failed" && errorKey !== "signin.expired" ? t("btn.tryAgain") : t("btn.verify")}
          </Button>
          {remaining > 0 && <p id="signin-resend-wait">{t("signin.resendIn", { time: formatLock(remaining) })}</p>}
          <button
            type="button"
            className="inline-flex min-h-touch w-full items-center justify-center font-semibold underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
            disabled={remaining > 0 || locked}
            aria-disabled={remaining > 0 || locked ? "true" : undefined}
            aria-describedby={remaining > 0 ? "signin-resend-wait" : undefined}
            onClick={() => void send("resend")}
          >
            {busy === "resend" ? t("btn.sending") : t("btn.resendCode")}
          </button>
        </>
      )}
      {step === "email" && (
        <Button className="w-full" loading={busy === "save"} onClick={() => save()}>
          {busy === "save" ? t("btn.saving") : phase === "failed" ? t("btn.tryAgain") : t("btn.continue")}
        </Button>
      )}
    </div>
  );
}
