export type ScenarioNotice =
  | { kind: "handoff"; role: string }
  | { kind: "finished" }
  | { kind: "notStarted" }
  | { kind: "raw"; text: string };

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** The scenario note is stored as data so a later language change can translate it again. */
export function scenarioNoticeText(notice: ScenarioNotice, t: Translate): string {
  if (notice.kind === "handoff") return t("scenario.handoff", { role: t(`roles.${notice.role}`) });
  if (notice.kind === "finished") return t("scenario.finished");
  if (notice.kind === "notStarted") return t("scenario.notStarted");
  return notice.text;
}
