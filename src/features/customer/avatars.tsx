import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { colors } from "@/ui/tokens";
import { AVATARS, setAvatar, useAvatar, type AvatarId } from "./avatarChoice";

const INK = "#1A1A1A";
const RING = "#C8C8C8";

interface Look {
  skin: string;
  shade: string;
  blush: string;
}

const LOOKS: Record<AvatarId, Look> = {
  "young-man": { skin: "#E4E4E4", shade: "#CFCFCF", blush: "#C4C4C4" },
  "young-woman": { skin: "#D4D4D4", shade: "#BEBEBE", blush: "#B4B4B4" },
  "middle-man": { skin: "#B8B8B8", shade: "#A2A2A2", blush: "#989898" },
  "middle-woman": { skin: "#A6A6A6", shade: "#909090", blush: "#868686" },
  "bald-man": { skin: "#8C8C8C", shade: "#767676", blush: "#6C6C6C" },
  "beard-glasses": { skin: "#C8C8C8", shade: "#B2B2B2", blush: "#A0A0A0" },
  "long-hair": { skin: "#969696", shade: "#808080", blush: "#707070" },
  "cap-man": { skin: "#747474", shade: "#5E5E5E", blush: "#565656" }
};

function Frame({ fill, clip, children }: { fill: string; clip: string; children: ReactNode }) {
  return (
    <>
      <circle cx="60" cy="60" r="58" fill={RING} />
      <circle cx="60" cy="60" r="48" fill={fill} data-badge-fill="" />
      <defs>
        <clipPath id={clip}>
          <circle cx="60" cy="60" r="47.5" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>{children}</g>
    </>
  );
}

function Bust({ look, children }: { look: Look; children?: ReactNode }) {
  return (
    <>
      <path d="M16 112c0-24 18-38 44-38s44 14 44 38v16H16z" fill={INK} />
      <path d="M51 64h18v14H51z" fill={look.skin} stroke={INK} strokeWidth="2.4" />
      <circle cx="60" cy="48" r="20" fill={look.skin} stroke={INK} strokeWidth="2.6" />
      <ellipse cx="72" cy="54" rx="7" ry="9" fill={look.shade} />
      <ellipse cx="47" cy="56" rx="3.1" ry="2" fill={look.blush} />
      <ellipse cx="73" cy="56" rx="3.1" ry="2" fill={look.blush} />
      <circle cx="52" cy="48" r="1.7" fill={INK} />
      <circle cx="68" cy="48" r="1.7" fill={INK} />
      {children}
    </>
  );
}

function smile(y: number, dip: number) {
  return <path d={`M52 ${y}c2 ${dip} 14 ${dip} 16 0`} fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />;
}

function Portrait({ id }: { id: AvatarId }) {
  const look = LOOKS[id];
  if (id === "young-man") {
    return (
      <>
        <path d="M40 40c1-16 39-18 41 0-8-8-34-8-41 0z" fill={INK} />
        <Bust look={look}>{smile(57, 6)}</Bust>
      </>
    );
  }
  if (id === "young-woman") {
    return (
      <>
        <path d="M34 54c0-26 52-28 52 2v18c0 5-5 2-7-5l-2-12c-4-7-30-7-34 0l-2 12c-2 7-7 10-7 5z" fill={INK} />
        <Bust look={look}>{smile(58, 4)}</Bust>
      </>
    );
  }
  if (id === "middle-man") {
    return (
      <>
        <path d="M38 50c-4-14 10-18 14-6 1 4-2 10-6 12-6 1-8-1-8-6z" fill={INK} />
        <path d="M82 50c4-14-10-18-14-6-1 4 2 10 6 12 6 1 8-1 8-6z" fill={INK} />
        <Bust look={look}>
          <path d="M48 36h10M50 40h12" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M52 60h16" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
        </Bust>
      </>
    );
  }
  if (id === "middle-woman") {
    return (
      <>
        <path d="M40 46c2-18 38-18 40 2-10-8-30-8-40-2z" fill={INK} />
        <Bust look={look}>
          <circle cx="84" cy="48" r="8" fill={INK} />
          {smile(59, 3)}
        </Bust>
      </>
    );
  }
  if (id === "bald-man") {
    return (
      <Bust look={look}>
        <ellipse cx="39" cy="52" rx="3.2" ry="5" fill={look.skin} stroke={INK} strokeWidth="2.2" />
        <ellipse cx="81" cy="52" rx="3.2" ry="5" fill={look.skin} stroke={INK} strokeWidth="2.2" />
        <path d="M49 34c5-4 12-3 15 2" fill="none" stroke="#C8C8C8" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M48 40h8M64 40h8" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
        {smile(59, 3)}
      </Bust>
    );
  }
  if (id === "beard-glasses") {
    return (
      <>
        <path d="M41 42c0-14 38-16 39 0-8-7-31-7-39 0z" fill={INK} />
        <Bust look={look}>
          <path d="M42 56c0 18 36 18 36 0-8 8-28 8-36 0z" fill={INK} />
          <circle cx="52" cy="47" r="6.5" fill="none" stroke={INK} strokeWidth="2.2" />
          <circle cx="68" cy="47" r="6.5" fill="none" stroke={INK} strokeWidth="2.2" />
          <path d="M58.5 47h3" stroke={INK} strokeWidth="2.2" />
        </Bust>
      </>
    );
  }
  if (id === "long-hair") {
    return (
      <>
        <path d="M28 60c2-34 62-36 66 2l8 42c-10-2-12-18-16-30-3-10-10-14-18-14s-15 4-18 14c-4 12-6 28-16 30z" fill={INK} />
        <Bust look={look}>{smile(58, 4)}</Bust>
      </>
    );
  }
  return (
    <Bust look={look}>
      <path d="M32 46c2-20 44-22 56-4 10 4 18 8 22 9 2 1-6 6-14 3-8-8-32-10-44-2-8 4-18 0-20-6z" fill={INK} />
      <path d="M78 44h8" stroke="#3A3A3A" strokeWidth="2" strokeLinecap="round" />
      {smile(59, 4)}
    </Bust>
  );
}

/** Original flat bust. Men's badges are lime. Women's badges are pink. The ring is light grey. */
export function ProfileAvatar({ id }: { id: string }) {
  const raw = useId().replace(/:/g, "");
  const avatar = AVATARS.find((item) => item.id === id) ?? AVATARS[2]!;
  const fill = avatar.badge === "lime" ? colors.avatarLime : colors.avatarPink;
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" data-avatar={avatar.id} data-badge={avatar.badge} aria-hidden="true">
      <Frame fill={fill} clip={`avatarClip${raw}`}>
        <Portrait id={avatar.id} />
      </Frame>
    </svg>
  );
}

/** Labeled radios. The choice is stored in localStorage. */
export function AvatarPicker() {
  const { t } = useTranslation();
  const selected = useAvatar();
  return (
    <fieldset data-testid="avatar-picker" className="flex flex-col gap-3">
      <legend className="font-semibold">{t("avatar.legend")}</legend>
      <div className="grid grid-cols-1 gap-2">
        {AVATARS.map((avatar) => {
          const on = avatar.id === selected;
          return (
            <label key={avatar.id} className={`flex min-h-touch items-center gap-3 rounded-2xl border px-2 py-2 ${on ? "border-2 border-ink bg-mist" : "border-line bg-paper"}`}>
              <input type="radio" name="profile-avatar" value={avatar.id} checked={on} onChange={() => setAvatar(avatar.id)} />
              <span className="h-14 w-14 shrink-0" aria-hidden="true">
                <ProfileAvatar id={avatar.id} />
              </span>
              <span className="min-w-0 leading-tight">{t(avatar.labelKey)}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
