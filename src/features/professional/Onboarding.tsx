import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { config } from "@/core/config/fixx.config";
import type { VerificationCtx, VerificationState } from "@/core/machines";
import { Button } from "@/ui/Button";
import { DemoValue } from "@/ui/DemoBadge";
import { ErrorText, Field, inputClass } from "@/ui/Field";
import { psession } from "./session";

type Send = (e: { type: string } & Record<string, unknown>) => void;

const Step = ({ title, done, children }: { title: string; done: boolean; children: ReactNode }) => {
  const { t } = useTranslation();
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-line bg-paper p-3">
      <p className="font-bold">{title}</p>
      {done ? <p className="font-semibold">{t("onboarding.added")}</p> : children}
    </li>
  );
};

function PhoneCode({ verified, onVerified }: { verified: boolean; onVerified: () => void }) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [wrong, setWrong] = useState(false);
  if (verified) return <p className="font-semibold">{t("onboarding.phoneVerified")}</p>;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm"><DemoValue>{t("signin.demoCode", { code: config.demoSignInCode })}</DemoValue></p>
      <Field label={t("onboarding.phoneCode")}>
        <input className={inputClass} inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} />
      </Field>
      {wrong && <ErrorText>{t("signin.wrongCode")}</ErrorText>}
      <Button variant="secondary" onClick={() => { if (code.trim() === config.demoSignInCode) { setWrong(false); onVerified(); } else setWrong(true); }}>{t("btn.verifyPhone")}</Button>
    </div>
  );
}

/** Identity verification (ID + selfie + phone), review status, and recovery after losing a number. */
export function Onboarding({ state, ctx, send, rerender }: { state: VerificationState; ctx: VerificationCtx; send: Send; rerender: () => void }) {
  const { t } = useTranslation();
  const [error, setError] = useState(false);
  const set = (p: Partial<typeof psession>) => { Object.assign(psession, p); rerender(); };

  if (state === "pending") {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold">{t("onboarding.title")}</h2>
        <p>{t("onboarding.pending")}</p>
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-ink p-3">
          <p className="text-sm font-semibold">{t("demo.adminActing")}</p>
          <Button variant="secondary" onClick={() => send({ type: "APPROVE" })}>{t("demo.verifyApprove")}</Button>
          <Button variant="secondary" onClick={() => send({ type: "REJECT", reason: "blurry" })}>{t("demo.verifyReject")}</Button>
        </div>
      </div>
    );
  }

  if (state === "recovery") {
    const ready = psession.recoverySelfie && psession.recoveryPhone;
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold">{t("recovery.title")}</h2>
        <p>{t("recovery.intro")}</p>
        <ul className="flex flex-col gap-3">
          <Step title={t("onboarding.selfie")} done={psession.recoverySelfie}>
            <Button variant="secondary" onClick={() => set({ recoverySelfie: true })}>{t("btn.addSelfie")}</Button>
          </Step>
          <Step title={t("onboarding.phone")} done={psession.recoveryPhone}>
            <PhoneCode verified={psession.recoveryPhone} onVerified={() => set({ recoveryPhone: true })} />
          </Step>
        </ul>
        {error && <ErrorText>{t("onboarding.missing")}</ErrorText>}
        <Button onClick={() => { if (!ready) return setError(true); setError(false); send({ type: "SUBMIT_RECOVERY", selfie: true, newPhoneVerified: true }); set({ recoverySelfie: false, recoveryPhone: false }); }}>{t("btn.sendRecovery")}</Button>
      </div>
    );
  }

  // notStarted or rejected
  const ready = psession.idDoc && psession.selfie && psession.phoneVerified;
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">{t("onboarding.title")}</h2>
      <p>{t("onboarding.intro")}</p>
      {state === "rejected" && ctx.reason && <ErrorText>{t("onboarding.rejected", { reason: t(`rejectReason.${ctx.reason}`) })}</ErrorText>}
      <ul className="flex flex-col gap-3">
        <Step title={t("onboarding.id")} done={psession.idDoc}><Button variant="secondary" onClick={() => set({ idDoc: true })}>{t("btn.addId")}</Button></Step>
        <Step title={t("onboarding.selfie")} done={psession.selfie}><Button variant="secondary" onClick={() => set({ selfie: true })}>{t("btn.addSelfie")}</Button></Step>
        <Step title={t("onboarding.phone")} done={psession.phoneVerified}><PhoneCode verified={psession.phoneVerified} onVerified={() => set({ phoneVerified: true })} /></Step>
      </ul>
      {error && <ErrorText>{t("onboarding.missing")}</ErrorText>}
      <Button onClick={() => { if (!ready) return setError(true); setError(false); send({ type: "SUBMIT", idDoc: true, selfie: true, phoneVerified: true }); }}>{t("btn.submitVerification")}</Button>
    </div>
  );
}
