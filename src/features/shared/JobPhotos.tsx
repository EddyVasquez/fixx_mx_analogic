import { useEffect, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { config, type Lang } from "@/core/config/fixx.config";
import { formatDateTime } from "@/core/clock/clock";
import { localeFor } from "@/i18n";
import { Button } from "@/ui/Button";
import { DemoValue } from "@/ui/DemoBadge";
import { photoQueue, type PhotoPhase } from "./photoQueue";

export function usePhotoQueue() {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => photoQueue.subscribe(force), []);
  return photoQueue;
}

/** A photo with a time and a simulated place, plus its place in the upload queue. */
export function JobPhotos({ phase, label, addLabel, min, now, lang, onAdd, readOnly = false }: {
  phase: PhotoPhase; label: string; addLabel?: string; min?: number; now: Date; lang: Lang; onAdd?: () => void; readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const queue = usePhotoQueue();
  const photos = queue.items.filter((p) => p.phase === phase);
  const queued = photos.some((p) => p.status === "queued");
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="font-semibold">{label}</legend>
      {!queue.isOnline() && <p className="text-sm text-inkSoft">{t("photo.offline")}</p>}
      {photos.length === 0 ? <p className="text-sm text-inkSoft">{t("photo.empty")}</p> : (
        <ul className="flex flex-col gap-2">
          {photos.map((p) => (
            <li key={p.id} className="rounded-xl border border-line p-3 text-sm">
              <p className="font-semibold">{t("photo.stamp", { when: formatDateTime(new Date(p.takenAt), localeFor[lang]), place: p.location })}</p>
              <p><DemoValue>{t("photo.locationNote")}</DemoValue></p>
              <p>{p.status === "queued" ? t("photo.queued") : t("photo.uploaded")}</p>
              {p.attempts > 0 && <p className="text-inkSoft">{t("photo.attempts", { n: p.attempts })}</p>}
            </li>
          ))}
        </ul>
      )}
      {min != null && photos.length < min && <p className="text-sm text-inkSoft">{t("photo.needMore", { count: min })}</p>}
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => { queue.add(phase, now, config.completionCheck.demoLocation); onAdd?.(); }}>{addLabel}</Button>
          {queued && <Button variant="secondary" onClick={() => queue.retry()}>{t("btn.retryUploads")}</Button>}
        </div>
      )}
    </fieldset>
  );
}
