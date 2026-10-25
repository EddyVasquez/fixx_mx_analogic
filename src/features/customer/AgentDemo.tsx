import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { CaseCtx, CaseState, WarrantyState } from "@/core/machines";
import type { DemoRuntime } from "@/mocks/runtime/runtime";
import { Button } from "@/ui/Button";

const Box = ({ children, title }: { children: ReactNode; title: string }) => (
  <div className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-ink p-3">
    <p className="text-sm font-semibold">{title}</p>
    {children}
  </div>
);

/** Demo-only stand-in for FIXX Agents until the Admin console (Step 11). */
export function CaseAgentDemo({ rt, jobId }: { rt: DemoRuntime; jobId: string }) {
  const { t } = useTranslation();
  const a = rt.get(`case:${jobId}`);
  if (!a) return null;
  const st = a.snap.state as CaseState;
  const c = a.snap.ctx as CaseCtx;
  const go = (e: { type: string } & Record<string, unknown>) => rt.dispatch(a.id, e);
  if (st === "reported") return <Box title={t("demo.agent.title")}><Button variant="secondary" onClick={() => go({ type: "START_REVIEW" })}>{t("demo.agent.start")}</Button></Box>;
  if (st === "underReview") {
    return (
      <Box title={t("demo.agent.title")}>
        <Button variant="secondary" onClick={() => go({ type: "DECIDE", decision: "refundCustomer" })}>{t("demo.agent.refund")}</Button>
        <Button variant="secondary" onClick={() => go({ type: "DECIDE", decision: "releaseProfessional" })}>{t("demo.agent.release")}</Button>
        <Button variant="secondary" onClick={() => go({ type: "DECIDE", decision: "split" })}>{t("demo.agent.split")}</Button>
      </Box>
    );
  }
  if (st === "inReview") return <Box title={t("demo.agent.title")}><Button variant="secondary" onClick={() => go({ type: "REVIEW_DECIDED", decision: c.decision ?? "split" })}>{t("demo.agent.reviewDecide")}</Button></Box>;
  return null;
}

export function WarrantyAgentDemo({ rt, jobId }: { rt: DemoRuntime; jobId: string }) {
  const { t } = useTranslation();
  const a = rt.get(`warranty:${jobId}`);
  if (!a) return null;
  const st = a.snap.state as WarrantyState;
  const go = (e: { type: string } & Record<string, unknown>) => rt.dispatch(a.id, e);
  if (st === "claimFiled") return <Box title={t("demo.agent.title")}><Button variant="secondary" onClick={() => go({ type: "START_REVIEW" })}>{t("demo.agent.claimStart")}</Button></Box>;
  if (st === "inReview") {
    return (
      <Box title={t("demo.agent.title")}>
        <Button variant="secondary" onClick={() => go({ type: "RESOLVE", outcome: "resolved" })}>{t("demo.agent.claimApprove")}</Button>
        <Button variant="secondary" onClick={() => go({ type: "RESOLVE", outcome: "rejected" })}>{t("demo.agent.claimReject")}</Button>
      </Box>
    );
  }
  return null;
}
