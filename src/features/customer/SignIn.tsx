import { useState } from "react";
import { useTranslation } from "react-i18next";
import { config } from "@/core/config/fixx.config";
import { Button } from "@/ui/Button";
import { DemoValue } from "@/ui/DemoBadge";
import { ErrorText, Field, inputClass } from "@/ui/Field";

type Phase = "phone" | "code" | "email";

/** Phone sign-in (code by SMS or WhatsApp), then email capture. Codes are simulated; the demo code is shown on screen. */
export function SignIn({ onDone }: { onDone: (email: string) => void }) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>("phone");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sendCode = () => {
    if (phone.replace(/\D/g, "").length < 10) return setError("signin.phoneInvalid");
    setError(null); setPhase("code");
  };
  const verify = () => {
    if (code.trim() !== config.demoSignInCode) return setError("signin.wrongCode");
    setError(null); setPhase("email");
  };
  const saveEmail = () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("signin.emailInvalid");
    onDone(email.trim());
  };

  return (
    <div className="flex flex-col gap-4">
      {phase !== "email" && <h2 className="text-2xl font-bold">{t("signin.title")}</h2>}
      {phase === "phone" && (
        <>
          <Field label={t("signin.phone")}>
            <div className="flex gap-2">
              <span className="flex min-h-touch items-center rounded-lg border-2 border-ink bg-paper px-3 font-bold">+52</span>
              <input className={inputClass} type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </Field>
          <fieldset className="flex flex-col gap-2">
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
          {error && <ErrorText>{t(error)}</ErrorText>}
          <Button onClick={sendCode}>{t("btn.sendCode")}</Button>
        </>
      )}
      {phase === "code" && (
        <>
          <p>{t("signin.codeSent", { channel: t(`signin.${channel}`), phone: `+52 ${phone}`, minutes: Math.round(config.signIn.codeValiditySec / 60) })}</p>
          <p><DemoValue>{t("signin.demoCode", { code: config.demoSignInCode })}</DemoValue></p>
          <Field label={t("signin.code")}>
            <input className={inputClass} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          {error && <ErrorText>{t(error)}</ErrorText>}
          <Button onClick={verify}>{t("btn.verify")}</Button>
        </>
      )}
      {phase === "email" && (
        <>
          <h2 className="text-2xl font-bold">{t("signin.email.title")}</h2>
          <Field label={t("signin.email")} hint={t("signin.emailWhy")}>
            <input className={inputClass} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {error && <ErrorText>{t(error)}</ErrorText>}
          <Button onClick={saveEmail}>{t("btn.continue")}</Button>
        </>
      )}
    </div>
  );
}
