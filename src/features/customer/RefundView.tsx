import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Lang } from "@/core/config/fixx.config";
import { formatDateTime } from "@/core/clock/clock";
import { localeFor } from "@/i18n";
import type { RefundRecord } from "@/mocks/runtime/runtime";
import { Button } from "@/ui/Button";
import { ErrorText, Field, focusTargetClass, inputClass } from "@/ui/Field";
import { actionTiming, createSingleFlight, runTimed, sleep } from "./actionTiming";
import { formatCustomerMXN } from "./moneyFormat";
import { clabeDigits, type AutoResult, type ClabeResult } from "./refundActions";

type Phase = "idle" | "processing" | "success" | "failed";
type RefundError = "refund.clabeInvalid" | "refund.clabeRejected" | "common.network" | "refund.autoFailed";

/** Refunds: cards and wallets go back to the original method; cash and SPEI need a CLABE from the customer. */
export function RefundView({ refund, issued, onClabe, onAuto, onStartOver, hideStartOver }: {
  refund: RefundRecord;
  issued: boolean;
  onClabe: (clabe: string) => Promise<ClabeResult>;
  onAuto: () => Promise<AutoResult>;
  onStartOver: () => void;
  hideStartOver?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const [clabe, setClabe] = useState("");
  const [phase, setPhase] = useState<Phase>(refund.destination === "original" && !issued ? "processing" : "idle");
  const [errorKey, setErrorKey] = useState<RefundError | null>(null);
  const [slow, setSlow] = useState(false);
  const clabeRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const doneRef = useRef<HTMLParagraphElement>(null);
  const autoFlight = useRef(false);
  const onAutoRef = useRef(onAuto);
  const onClabeRef = useRef(onClabe);
  onAutoRef.current = onAuto;
  onClabeRef.current = onClabe;
  const once = useRef(createSingleFlight());
  const date = formatDateTime(new Date(refund.expectedBy), localeFor[lang]);
  const needsClabe = refund.destination === "clabe" && !refund.clabe;
  const fieldFault = errorKey === "refund.clabeInvalid" || errorKey === "refund.clabeRejected";

  const finishAuto = (result: AutoResult | "timeout") => {
    autoFlight.current = false;
    setSlow(false);
    if (result === "timeout" || !result.ok) {
      setPhase("failed");
      setErrorKey("refund.autoFailed");
      return;
    }
    setPhase("success");
    setErrorKey(null);
  };

  const runAuto = () => {
    if (autoFlight.current) return Promise.resolve();
    autoFlight.current = true;
    setPhase("processing");
    setErrorKey(null);
    setSlow(false);
    return (async () => {
      const timed = await runTimed(
        async () => {
          await sleep(actionTiming.latencyMs);
          return onAutoRef.current();
        },
        () => setSlow(true)
      );
      finishAuto(timed.ok ? timed.value : "timeout");
    })();
  };

  // Dependencies are the refund id and whether it was already issued.
  // A parent re-render must not start another refund. The in-flight flag covers a second pass before the first settles.
  useEffect(() => {
    if (refund.destination !== "original" || issued) return;
    runAuto();
    // onAuto is read through a ref so a new function identity does not re-run this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refund.id, issued]);

  useEffect(() => {
    if (phase !== "failed" || !errorKey) return;
    if (fieldFault) clabeRef.current?.focus();
    else errorRef.current?.focus();
  }, [phase, errorKey, fieldFault]);

  useEffect(() => {
    if (issued || phase === "success") doneRef.current?.focus();
  }, [issued, phase]);

  const send = () => once.current(async () => {
    const digits = clabeDigits(clabe);
    if (digits.length !== 18) {
      setPhase("failed");
      setErrorKey("refund.clabeInvalid");
      setSlow(false);
      return;
    }
    setPhase("processing");
    setErrorKey(null);
    setSlow(false);
    const timed = await runTimed(
      async () => {
        await sleep(actionTiming.latencyMs);
        return onClabeRef.current(digits);
      },
      () => setSlow(true)
    );
    setSlow(false);
    if (!timed.ok) {
      setPhase("failed");
      setErrorKey("common.network");
      return;
    }
    if (!timed.value.ok) {
      setPhase("failed");
      setErrorKey(timed.value.reason === "rejected" ? "refund.clabeRejected" : timed.value.reason === "network" ? "common.network" : "refund.clabeInvalid");
      return;
    }
    setPhase("success");
  });

  const amount = formatCustomerMXN(refund.amount);
  const showDone = !needsClabe || phase === "success";
  const doneKey = issued || phase === "success" || refund.destination === "clabe" ? "refund.done" : "refund.original";

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">{t("refund.title")}</h2>
      <p className="text-2xl font-bold">{t("refund.amount", { amount })}</p>
      {needsClabe && phase !== "success" ? (
        <>
          <p>{t("refund.clabeIntro")}</p>
          <Field label={t("payout.clabe")} hint={t("refund.clabeHint")} hintId="refund-clabe-hint">
            <input
              ref={clabeRef}
              id="refund-clabe"
              className={inputClass}
              inputMode="numeric"
              value={clabe}
              readOnly={phase === "processing"}
              aria-invalid={fieldFault || undefined}
              aria-describedby={errorKey ? "refund-error refund-clabe-hint" : "refund-clabe-hint"}
              onChange={(e) => setClabe(e.target.value)}
            />
          </Field>
          <div role="status" aria-live="polite" className="font-semibold">
            {phase === "processing" && <p>{t("refund.sending")}</p>}
            {slow && phase === "processing" && <p>{t("common.slow")}</p>}
          </div>
          {errorKey && <ErrorText ref={errorRef} id="refund-error">{t(errorKey)}</ErrorText>}
          <Button className="w-full" loading={phase === "processing"} onClick={() => send()}>
            {phase === "processing" ? t("btn.processing") : phase === "failed" ? t("btn.tryAgain") : t("btn.sendClabe")}
          </Button>
        </>
      ) : refund.destination === "original" && !issued && phase !== "success" ? (
        <>
          <div role="status" aria-live="polite" className="font-semibold">
            {phase === "processing" && <p>{t("refund.processing")}</p>}
            {slow && phase === "processing" && <p>{t("common.slow")}</p>}
          </div>
          {errorKey && <ErrorText ref={errorRef} id="refund-error">{t(errorKey)}</ErrorText>}
          {phase === "failed" ? (
            <Button className="w-full" onClick={() => runAuto()}>{t("btn.tryAgain")}</Button>
          ) : (
            <Button className="w-full" loading>{t("btn.processing")}</Button>
          )}
        </>
      ) : showDone ? (
        <p ref={doneRef} tabIndex={-1} role="status" className={`font-semibold ${focusTargetClass}`}>{t(doneKey, { date })}</p>
      ) : null}
      {issued && !hideStartOver && <Button variant="secondary" className="w-full" onClick={onStartOver}>{t("btn.startOver")}</Button>}
    </div>
  );
}
