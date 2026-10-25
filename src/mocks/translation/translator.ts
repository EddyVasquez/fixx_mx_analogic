import type { Lang } from "../../core/config/fixx.config";

type Entry = Record<Lang, string> & { role: "customer" | "professional" | "agent" };
/** Scripted lines for the Korean customer / Spanish professional demo (scenario 12). Anything else gets an obvious mock prefix. */
export const PHRASEBOOK: Entry[] = [
  { role: "customer", ko: "안녕하세요, 내일 오전 10시에 가능할까요?", es: "Hola, ¿es posible mañana a las 10 de la mañana?", en: "Hello, is tomorrow at 10 in the morning possible?" },
  { role: "professional", ko: "네, 그 시간에 가겠습니다. 벽 사진을 보내주실 수 있나요?", es: "Sí, ahí estaré. ¿Puede mandarme una foto de la pared?", en: "Yes, I will be there. Could you send me a photo of the wall?" },
  { role: "customer", ko: "사진 보냈어요. 감사합니다.", es: "Ya envié la foto. Gracias.", en: "I sent the photo. Thank you." },
  { role: "professional", ko: "좋습니다, 20분 후에 도착합니다.", es: "Perfecto, llego en 20 minutos.", en: "Great, I will arrive in 20 minutes." },
  // Support macros (FIXX Agents write in English or Spanish; Korean users read the translation)
  { role: "agent", en: "Hello, I am a FIXX Agent. How can I help you?", es: "Hola, soy un Agente FIXX. ¿En qué puedo ayudarte?", ko: "안녕하세요, FIXX 상담원입니다. 무엇을 도와드릴까요?" },
  { role: "agent", en: "You can see the expected arrival date of your refund on the refund screen.", es: "Puedes ver la fecha estimada de llegada de tu reembolso en la pantalla del reembolso.", ko: "환불 예상 입금일은 환불 화면에서 확인할 수 있어요." },
  { role: "agent", en: "Could you send a photo and a short description of the problem?", es: "¿Podrías enviar una foto y una descripción breve del problema?", ko: "문제를 보여주는 사진과 간단한 설명을 보내 주시겠어요?" },
  { role: "agent", en: "Your case is under review. You can ask for one review of the decision until the deadline shown in the case.", es: "Tu caso está en revisión. Puedes pedir una revisión de la decisión hasta la fecha límite que aparece en el caso.", ko: "케이스를 검토 중이에요. 케이스에 표시된 기한까지 결정에 대한 재검토를 한 번 요청할 수 있어요." }
];

export interface Translation { text: string; original: string; from: Lang; to: Lang; auto: boolean; matched: boolean }

export function translate(text: string, from: Lang, to: Lang): Translation {
  if (from === to) return { text, original: text, from, to, auto: false, matched: true };
  const hit = PHRASEBOOK.find((e) => e[from] === text);
  return hit
    ? { text: hit[to], original: text, from, to, auto: true, matched: true }
    : { text: `[demo ${from}→${to}] ${text}`, original: text, from, to, auto: true, matched: false };
}

export interface Message {
  id: string; jobId: string; authorRole: "customer" | "professional"; language: Lang; original: string;
  translations: Partial<Record<Lang, string>>; at: string;
}
export function makeMessage(m: { id: string; jobId: string; authorRole: Message["authorRole"]; language: Lang; text: string; at: Date }, langs: readonly Lang[] = ["en", "es", "ko"]): Message {
  const translations: Partial<Record<Lang, string>> = {};
  for (const l of langs) if (l !== m.language) translations[l] = translate(m.text, m.language, l).text;
  return { id: m.id, jobId: m.jobId, authorRole: m.authorRole, language: m.language, original: m.text, translations, at: m.at.toISOString() };
}
/** What a viewer sees: their language when available, flagged as translated so the UI can show "See original". */
export function viewFor(msg: Message, viewer: Lang): { text: string; translated: boolean; original: string; originalLanguage: Lang } {
  const t = viewer === msg.language ? undefined : msg.translations[viewer];
  return { text: t ?? msg.original, translated: t !== undefined, original: msg.original, originalLanguage: msg.language };
}
/** The official version of a quote or agreement is in the language of the customer who signs. */
export const officialLanguage = (customerLanguage: Lang): Lang => customerLanguage;
