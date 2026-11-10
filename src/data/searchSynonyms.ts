/**
 * Lay-language search words for Choose a service.
 *
 * How to add a word
 * -----------------
 * 1. Specific object or problem: add the base word to `tradeSynonyms`.
 *    An object glows its trade strong. `related` is at most one soft trade.
 *    `kind: "symptom"` (leak, no enfría, broken) glows strong only when no
 *    object was found. `kind: "broad"` glows every id in `trades` soft.
 *    Put the longer phrase in its own entry when it should win ("water heater"
 *    above "water", "ventana rota" above "roto").
 * 2. Every catalog job id should appear in some `jobs` list. Plurals
 *    ("pisos", "toilets") match. Only the last word may be a prefix while
 *    it is being typed ("fug" -> "fuga"). A finished word does not swallow
 *    a longer different word ("water" is not "waterproof", "lavar" is not
 *    "lavadora").
 * 3. Room or space: add it under `rooms`. A room alone glows its whole list
 *    soft. `primary` only sorts (Plumbing first for a bathroom). It never
 *    glows strong and never hides the rest of the list. A specific word
 *    turns the room list off. `narrow` marks a door, window, or closet so
 *    its chip comes before the room that contains it.
 * 4. A storey ("second floor", "segundo piso", "abajo", "2층"): add the
 *    phrase to `storeyPhrases` or the token to `storeyTokens`.
 * 5. Gas phrases live in `gasPhrases` and book nothing.
 * 6. Trade names live in `tradeKeywords`. Do not put display-name filler
 *    there (cocheras, patios, general, control, repair, techos).
 *
 * Korean wording in this file is a draft and still needs a native speaker,
 * same convention as src/i18n/ko (`status: "draft"`, `needsNativeReview`).
 * English and Mexican Spanish are the working copy.
 */

export const koreanSynonymStatus = {
  status: "draft",
  needsNativeReview: true
} as const;

/** Soft trades that belong with a bathroom fixture or the bathroom itself. */
const bathRelated = ["electrical", "handyman", "flooring", "painting", "cleaning"];

export type SynonymKind = "object" | "symptom" | "broad";

export interface TradeSynonym {
  /** Home-screen category id. An object or symptom glows this trade strong. */
  tradeId: string;
  /** English, Mexican Spanish, and draft Korean. */
  words: string[];
  /** At most one other trade, glowing soft. Ignored for `kind: "broad"`. */
  related?: string[];
  /** Catalog task ids, best suggestion first. At most three are shown. */
  jobs?: string[];
  /**
   * object: a thing or a named problem (toilet, rejas, tile).
   * symptom: leak, no enfría, broken. Ignored when an object is also present.
   * broad: every id in `trades` glows soft (humidity, hot, cold).
   */
  kind?: SynonymKind;
  /** Soft trades for `kind: "broad"`. */
  trades?: string[];
  /** Vague symptom. Next to a room, the room's jobs are used instead. */
  vague?: boolean;
  /** Kept so a later edit can still rank chips. The matcher uses word order. */
  score?: number;
}

export interface RoomSynonym {
  id: string;
  /** Phrases and single words. Longer phrases win over a word inside them. */
  words: string[];
  /** Soft glow when the query is only this room. */
  trades: string[];
  /** Listed first. Still soft, and never the only trade. */
  primary?: string[];
  /** A door, window, or closet beats the room around it when chips are chosen. */
  narrow?: boolean;
  /** Suggested only when no specific word matched a job. Keep this to 1 or 2. */
  jobs?: string[];
}

export interface TradeKeyword {
  tradeId: string;
  /** Curated names only. Not the parenthetical words in the display name. */
  words: string[];
  jobs?: string[];
}

export const tradeSynonyms: TradeSynonym[] = [
  // --- Plumbing ---
  {
    tradeId: "plumbing",
    words: [
      "toilet", "wc", "excusado", "taza", "inodoro", "retrete",
      "no baja", "no jala", "no le baja",
      "변기", "양변기"
    ],
    jobs: ["FIXX-PLM-001"]
  },
  {
    tradeId: "plumbing",
    words: [
      "faucet", "tap", "llave de agua", "grifo",
      "lavabo", "sink", "fregadero", "tarja", "fregadero tapado",
      "세면대", "싱크대", "수전"
    ],
    jobs: ["FIXX-PLM-002", "FIXX-PLM-003"]
  },
  {
    tradeId: "plumbing",
    words: ["two handle faucet", "llave de dos manerales", "mezcladora de dos manerales"],
    jobs: ["FIXX-PLM-003"]
  },
  {
    tradeId: "plumbing",
    words: [
      "water heater", "boiler", "calentador", "calentador de agua", "boiler no calienta",
      "calentador no calienta", "no calienta el agua", "agua fria", "cold water", "hot water", "agua caliente",
      "sin agua caliente", "온수기"
    ],
    jobs: ["FIXX-PLM-004"]
  },
  {
    tradeId: "plumbing",
    words: [
      "washer hookup", "dryer hookup", "conectar lavadora", "conexion de lavadora",
      "toma de agua", "llave de lavadora"
    ],
    related: ["appliance"],
    jobs: ["FIXX-PLM-005"]
  },
  {
    tradeId: "plumbing",
    words: ["water", "agua", "물", "물이", "water leak", "leaking water"],
    jobs: ["FIXX-PLM-006"]
  },
  {
    // A clog named with the bathroom is the toilet. The shorter "se tapó" stays a drain.
    tradeId: "plumbing",
    words: ["se tapo el bano", "se tapo el excusado", "se tapo la taza", "bano tapado", "taza tapada"],
    related: ["handyman"],
    jobs: ["FIXX-PLM-001", "FIXX-PLM-006"]
  },
  {
    tradeId: "plumbing",
    words: [
      "clog", "clogged", "unclog", "drain", "drenaje", "coladera", "desague",
      "tapado", "tapada", "tapon", "atascado", "atascada", "destape", "destapar",
      "se tapo", "no desagua", "slow drain", "막힘", "배수구"
    ],
    related: ["handyman"],
    jobs: ["FIXX-PLM-006", "FIXX-PLM-001"]
  },
  {
    tradeId: "plumbing",
    kind: "object",
    words: [
      "tuberia", "tubo", "pipe", "pipes", "pvc", "pex", "cobre", "copper",
      "tinaco", "cisterna", "aljibe", "bomba", "bomba de agua", "sin agua", "no hay agua",
      "baja presion", "presion de agua", "valvula", "flotador", "sapo", "mugre del tinaco",
      "배관", "수도"
    ],
    jobs: ["FIXX-PLM-006"]
  },
  {
    kind: "symptom",
    tradeId: "plumbing",
    words: [
      "leak", "leaking", "leaky", "fuga", "fuga de agua", "goteo", "gotea", "goteando",
      "se sale el agua", "se metio el agua", "물이 새요", "물 새요",
      "누수"
    ],
    jobs: ["FIXX-PLM-006"]
  },
  {
    // Shower head and mixer. A future catalog id only needs to be added to `jobs`.
    // PLM-007 is that job. Electric shower heads are electrical and are listed separately.
    tradeId: "plumbing",
    words: [
      "regadera", "ducha", "shower", "showerhead", "shower head", "lluvia",
      "mezcladora", "monomando",
      "샤워", "샤워기", "샤워헤드"
    ],
    jobs: ["FIXX-PLM-007"]
  },
  {
    tradeId: "plumbing",
    words: [
      "smells", "stinks", "huele mal", "mal olor", "olor a drenaje", "olor a caño",
      "huele a cano", "냄새", "하수구 냄새"
    ],
    related: ["pest_control"],
    jobs: ["FIXX-PLM-006"]
  },

  // --- Electrical ---
  {
    tradeId: "electrical",
    words: [
      "no hay luz", "sin luz", "se fue la luz", "no power", "no electricity",
      "power outage", "blackout", "apagon", "se fue la corriente", "no hay corriente",
      "luz", "foco", "focos", "foco fundido", "bombilla", "bombillo", "bulb",
      "lampara", "luminaria", "light", "lights", "lighting",
      "lightbulb", "light bulb", "doorbell", "door bell", "timbre",
      "정전", "전등", "조명", "불이 안 켜요", "초인종"
    ],
    jobs: ["FIXX-ELC-002"]
  },
  {
    // High-load electric shower heads are not the plumbing shower job.
    tradeId: "electrical",
    words: ["electric shower", "electric shower head", "electric showerhead", "regadera electrica", "ducha electrica"]
  },
  {
    // Extractor / exhaust. No ceiling-fan chip: there is no exhaust-fan task yet.
    tradeId: "electrical",
    words: ["exhaust fan", "bathroom fan", "extractor", "extractor de aire", "extractor de bano", "ventilador de extraccion", "환풍기"]
  },
  {
    tradeId: "electrical",
    words: [
      "outlet", "outlets", "socket", "receptacle", "contacto", "contactos", "enchufe",
      "apagador", "apagadores", "switch", "switches", "gfci", "interruptor",
      "콘센트", "스위치"
    ],
    jobs: ["FIXX-ELC-001"]
  },
  {
    tradeId: "electrical",
    words: [
      "ceiling fan", "ventilador", "ventilador de techo", "abanico",
      "선풍기", "천장 선풍기"
    ],
    jobs: ["FIXX-ELC-003"]
  },
  {
    tradeId: "electrical",
    words: ["circuito 220", "220 v", "220", "220v", "minisplit circuit", "pastilla del minisplit"],
    jobs: ["FIXX-ELC-004"]
  },
  {
    tradeId: "electrical",
    words: [
      "short", "short circuit", "corto", "cortocircuito", "chispa", "chispas",
      "breaker", "fuse", "fusible", "pastilla", "pastillas", "se bota la pastilla",
      "centro de carga", "breaker panel", "electrical panel", "panel electrico",
      "tablero", "tablero electrico", "load center", "panel",
      "cable", "cableado", "wiring", "wire", "rewire", "rewiring", "recablear", "chispazo",
      "circuit", "circuito",
      "단락", "차단기", "누전"
    ],
    jobs: ["FIXX-ELC-005"]
  },

  // --- HVAC ---
  {
    tradeId: "hvac",
    kind: "symptom",
    words: [
      "too hot", "too cold", "not cooling", "no cooling", "does not cool", "doesn't cool",
      "no enfria", "no calienta", "hace calor", "hace frio", "esta caliente",
      "el clima no enfria", "el clima no calienta", "ac no enfria", "minisplit no enfria"
    ],
    jobs: ["FIXX-HVC-002"]
  },
  {
    tradeId: "hvac",
    words: [
      "ac", "air conditioner", "air conditioning", "aire acondicionado", "aire",
      "clima", "minisplit", "mini split", "minisplit install", "instalar minisplit",
      "instalar clima", "calefaccion", "heating",
      "에어컨", "냉방", "난방", "미니스플릿", "더워", "안 시원해요"
    ],
    related: ["electrical"],
    jobs: ["FIXX-HVC-002", "FIXX-HVC-001"]
  },

  // --- Painting ---
  {
    tradeId: "painting",
    words: [
      "paint", "painting", "repaint", "pintar", "pintura", "pintura vinilica",
      "esmalte", "brocha", "rodillo", "mancha en la pared", "pared manchada",
      "descascarada", "se cae la pintura",
      "wallpaper", "papel tapiz", "tapiz", "empapelado", "stain", "stains",
      "페인트", "도색", "도장"
    ],
    jobs: ["FIXX-PNT-001"]
  },

  // --- Pest ---
  {
    tradeId: "pest_control",
    words: [
      "cockroach", "cockroaches", "cucaracha", "cucarachas", "scorpion", "scorpions",
      "alacran", "alacranes",
      "바퀴벌레", "전갈"
    ],
    jobs: ["FIXX-PST-001"]
  },
  {
    tradeId: "pest_control",
    words: ["termite", "termites", "termita", "termitas", "흰개미", "흰개미 방제"],
    jobs: ["FIXX-PST-002"]
  },
  {
    tradeId: "pest_control",
    words: [
      "rodent", "rodents", "mouse", "mice", "rat", "rats", "rata", "raton", "ratones",
      "roedor", "roedores",
      "쥐", "설치류"
    ],
    jobs: ["FIXX-PST-003"]
  },
  {
    tradeId: "pest_control",
    words: [
      "pest", "pests", "plaga", "plagas", "bug", "bugs", "insecto", "insectos",
      "mosquito", "mosquitos", "mosco", "moscos", "zancudo", "zancudos",
      "hormiga", "hormigas", "chinche", "chinches", "arana", "aranas", "abeja", "avispa",
      "모기", "개미", "벌레"
    ]
  },

  // --- Gardening ---
  {
    tradeId: "gardening",
    words: [
      "lawn", "grass", "garden", "pasto", "cesped", "jardin", "jardineria",
      "잔디", "정원"
    ],
    jobs: ["FIXX-GRD-001"]
  },
  {
    tradeId: "gardening",
    words: ["weed", "weeds", "maleza", "hierba", "hierbas", "deshierbe", "maleza del jardin", "잡초"],
    jobs: ["FIXX-GRD-002"]
  },
  {
    tradeId: "gardening",
    words: ["trim", "trimming", "prune", "pruning", "poda", "podar", "ramas", "arbusto", "arbol", "가지치기"],
    jobs: ["FIXX-GRD-003"]
  },

  // --- Flooring (the surface, never a storey) ---
  {
    tradeId: "flooring",
    words: [
      "piso roto", "pisos rotos", "azulejo roto", "azulejo suelto", "loose tile", "broken tile",
      "tile repair", "reparar piso"
    ],
    jobs: ["FIXX-FLR-002"]
  },
  {
    tradeId: "flooring",
    words: [
      "floating floor", "piso flotante", "laminado", "laminate", "duela", "duelas",
      "강마루", "마루"
    ],
    jobs: ["FIXX-FLR-003"]
  },
  {
    tradeId: "flooring",
    words: [
      "floor", "floors", "flooring", "piso", "pisos", "tile", "tiles", "azulejo", "azulejos",
      "loseta", "losetas", "mosaico", "ceramica", "porcelanato", "grout", "lechada", "boquilla de piso",
      "타일", "바닥재"
    ],
    jobs: ["FIXX-FLR-001", "FIXX-FLR-003"]
  },

  // --- Concrete ---
  {
    tradeId: "concrete",
    words: ["crack", "cracks", "grieta", "grietas", "resane", "resanar", "concrete crack", "barda", "bardas"],
    related: ["painting"],
    jobs: ["FIXX-CON-001"]
  },
  {
    tradeId: "concrete",
    words: [
      "slab", "firme", "firme de concreto", "colado", "losa de concreto",
      "콘크리트 바닥"
    ],
    jobs: ["FIXX-CON-002"]
  },
  {
    tradeId: "concrete",
    words: ["seal concrete", "sellar concreto", "sellado de concreto", "concrete sealing"],
    jobs: ["FIXX-CON-003"]
  },
  {
    tradeId: "concrete",
    words: [
      "concrete", "concreto", "cemento", "cement", "mortero", "banqueta de concreto",
      "콘크리트", "시멘트"
    ],
    jobs: ["FIXX-CON-001", "FIXX-CON-002"]
  },

  // --- Carpentry ---
  {
    tradeId: "carpentry",
    words: [
      "squeaky door", "squeaky", "squeak", "puerta que rechina", "puerta rechina",
      "rechina", "chirria", "puerta rota", "hinge", "hinges", "bisagra", "bisagras",
      "경첩"
    ],
    related: ["handyman"],
    jobs: ["FIXX-CAR-001"]
  },
  {
    tradeId: "carpentry",
    words: [
      "mueble", "muebles", "madera", "wood", "triplay", "mdf", "gabinete",
      "cabinet", "cabinets", "kitchen cabinet", "kitchen cabinets", "alacena",
      "가구", "문짝"
    ],
    related: ["handyman"],
    jobs: ["FIXX-CAR-001"]
  },

  // --- Appliance ---
  {
    tradeId: "appliance",
    words: [
      "washer", "washing machine", "lavadora", "lavadora no sirve", "lavadora no lava",
      "secadora", "dryer",
      "세탁기"
    ],
    related: ["plumbing"],
    jobs: ["FIXX-APL-001"]
  },
  {
    tradeId: "appliance",
    words: [
      "refrigerator", "fridge", "freezer", "refrigerador", "refri", "nevera",
      "냉장고"
    ],
    jobs: ["FIXX-APL-002"]
  },
  {
    tradeId: "appliance",
    words: [
      "estufa", "stove", "horno", "oven", "microondas", "microwave", "campana",
      "lavavajillas", "dishwasher", "electrodomestico", "electrodomesticos",
      "가전", "가스레인지", "전자레인지"
    ]
  },

  // --- Roofing ---
  {
    tradeId: "roofing",
    words: [
      "gotera", "goteras", "roof leak", "leaking roof", "techo gotea",
      "impermeabilizar", "impermeabilizante", "waterproof", "waterproofing",
      "filtracion", "humedad en el techo", "tejado", "teja",
      "방수", "지붕 누수"
    ],
    related: ["plumbing"],
    jobs: ["FIXX-ROF-001"]
  },

  // --- Handyman ---
  {
    tradeId: "handyman",
    words: ["tv", "television", "televisor", "tele", "pantalla", "티비", "텔레비전"],
    related: ["electrical"],
    jobs: ["FIXX-HND-001"]
  },
  {
    tradeId: "handyman",
    words: [
      "shelf", "shelves", "repisa", "repisas", "curtain", "curtains", "cortina", "cortinero",
      "mirror", "espejo", "cuadro", "colgar", "hang", "montar",
      "선반", "커튼", "거울"
    ],
    jobs: ["FIXX-HND-002"]
  },
  {
    tradeId: "handyman",
    words: [
      "drywall", "tablaroca", "yeso", "panel de yeso", "hoyos en la pared",
      "석고보드"
    ],
    related: ["painting"],
    jobs: ["FIXX-HND-002"]
  },
  {
    tradeId: "handyman",
    words: [
      "broken", "roto", "rota", "descompuesto", "descompuesta", "no sirve", "se descompuso",
      "고장", "망가졌어요"
    ],
    kind: "symptom",
    vague: true,
    jobs: ["FIXX-HND-002"],
    score: 90
  },
  {
    tradeId: "handyman",
    words: ["broken window", "ventana rota", "ventanas rotas", "vidrio estrellado"],
    jobs: ["FIXX-HND-003", "FIXX-HND-004"]
  },
  {
    tradeId: "handyman",
    words: ["mosquitero", "mosquiteros", "screen door", "window screen", "bug screen", "screen", "방충망"]
  },
  {
    tradeId: "handyman",
    words: [
      "broken glass", "shattered", "vidrio", "cristal", "glass", "vidrio roto", "vidrio templado",
      "유리"
    ],
    jobs: ["FIXX-HND-003", "FIXX-HND-005"]
  },
  {
    tradeId: "handyman",
    words: [
      "sliding window", "ventana corrediza", "ventana de aluminio", "aluminio",
      "미닫이 창"
    ],
    related: ["cleaning"],
    jobs: ["FIXX-HND-004"]
  },
  {
    tradeId: "handyman",
    words: [
      "shower screen", "cancel de bano", "cancel", "mampara", "mampara de bano",
      "샤워 칸막이", "욕실 칸막이"
    ],
    related: ["plumbing"],
    jobs: ["FIXX-HND-005"]
  },

  // --- Locksmith ---
  {
    tradeId: "locksmith",
    words: [
      "lock", "locks", "locksmith", "chapa", "chapas", "cerradura", "cerraduras",
      "cerrojo", "cerrajero", "picaporte", "deadbolt", "cambiar chapa",
      "자물쇠", "도어락", "열쇠"
    ],
    related: ["carpentry"],
    jobs: ["FIXX-LCK-001"]
  },
  {
    tradeId: "locksmith",
    words: [
      "locked out", "lockout", "me quede afuera", "no puedo entrar", "llaves adentro",
      "perdí las llaves", "perdi las llaves",
      "문 잠김", "잠겼어요"
    ],
    jobs: ["FIXX-LCK-002"]
  },

  // --- Cleaning ---
  {
    tradeId: "cleaning",
    words: [
      "deep clean", "deep cleaning", "limpieza profunda",
      "딥 클리닝"
    ],
    jobs: ["FIXX-CLN-002"]
  },
  {
    tradeId: "cleaning",
    words: ["move out", "move in", "move-out", "mudanza", "limpieza de mudanza", "이사 청소"],
    jobs: ["FIXX-CLN-003"]
  },
  {
    tradeId: "cleaning",
    words: ["post construction", "despues de la obra", "post obra", "limpieza post obra", "준공 청소"],
    jobs: ["FIXX-CLN-004"]
  },
  {
    tradeId: "cleaning",
    words: [
      "sofa", "sofas", "sillon", "upholstery", "lavado de sala", "lavar la sala", "lavado de salas",
      "소파"
    ],
    jobs: ["FIXX-CLN-005"]
  },
  {
    tradeId: "cleaning",
    words: ["carpet", "carpets", "rug", "rugs", "alfombra", "alfombras", "tapete", "tapetes", "카펫", "러그"],
    jobs: ["FIXX-CLN-006"]
  },
  {
    tradeId: "cleaning",
    words: [
      "window cleaning", "clean the windows", "limpiar ventanas", "limpieza de ventanas", "vidrios sucios",
      "창문 청소"
    ],
    jobs: ["FIXX-CLN-007"]
  },
  {
    tradeId: "cleaning",
    words: [
      "clean", "cleaning", "dirty", "sucio", "sucia", "polvo", "limpieza", "limpiar", "lavar",
      "aseo", "asear", "house cleaning",
      "청소", "더러워요"
    ],
    jobs: ["FIXX-CLN-001"]
  },

  // --- Metalwork ---
  {
    tradeId: "metalwork",
    words: [
      "security bars", "window bars", "bars", "reja", "rejas", "proteccion", "protecciones",
      "herreria", "herrero",
      "방범창", "철창"
    ],
    jobs: ["FIXX-MTL-001"]
  },
  {
    tradeId: "metalwork",
    words: ["gate", "gates", "porton", "portones", "puerta de herreria", "대문", "철제 대문"],
    jobs: ["FIXX-MTL-002"]
  },
  {
    tradeId: "metalwork",
    words: ["railing", "railings", "barandal", "barandales", "pasamanos", "난간"],
    jobs: ["FIXX-MTL-003"]
  },
  {
    tradeId: "metalwork",
    words: ["weld", "welding", "soldadura", "soldar", "용접"],
    jobs: ["FIXX-MTL-004"]
  },
  {
    tradeId: "metalwork",
    words: ["carport", "techumbre", "cochera ligera", "toldo", "카포트", "차양"],
    jobs: ["FIXX-MTL-005"]
  },
  {
    tradeId: "metalwork",
    words: ["metal", "metalwork", "fierro", "hierro", "acero inoxidable", "solera", "철물"],
    jobs: ["FIXX-MTL-004", "FIXX-MTL-001"]
  },
  {
    kind: "broad",
    tradeId: "roofing",
    trades: ["roofing", "painting", "plumbing"],
    words: ["humidity", "damp", "mold", "mildew", "humedad", "moho", "salitre", "습기", "곰팡이"]
  },
  {
    kind: "broad",
    tradeId: "hvac",
    trades: ["hvac", "plumbing"],
    words: ["hot", "cold"]
  }
];

const livingTrades = [
  "painting", "flooring", "electrical", "hvac", "handyman", "carpentry",
  "cleaning", "pest_control"
];

const patioTrades = [
  "gardening", "concrete", "pest_control", "electrical", "cleaning", "metalwork", "handyman"
];

export const rooms: RoomSynonym[] = [
  {
    id: "living_room",
    words: [
      "living room", "livingroom", "family room", "sitting room", "lounge",
      "sala", "sala de estar", "estancia",
      "거실"
    ],
    trades: livingTrades,
    jobs: ["FIXX-PNT-001"]
  },
  {
    id: "dining_room",
    words: ["dining room", "comedor", "식당"],
    trades: livingTrades
  },
  {
    id: "bedroom",
    words: [
      "bedroom", "bedrooms", "recamara", "recámara", "habitacion", "habitación",
      "dormitorio", "alcoba", "cuarto",
      "침실"
    ],
    trades: livingTrades
  },
  {
    id: "kitchen",
    words: ["kitchen", "cocina", "cocina integral", "주방"],
    // A minisplit belongs in the living room or a bedroom, not the kitchen.
    trades: ["plumbing", "electrical", "appliance", "painting", "flooring", "cleaning", "handyman", "pest_control", "carpentry"]
  },
  {
    id: "bathroom",
    words: [
      "bathroom", "bathrooms", "restroom", "restrooms", "washroom", "washrooms",
      "bano", "baño", "sanitario", "cuarto de bano", "cuarto de baño", "medio bano", "medio baño",
      "화장실", "욕실"
    ],
    trades: ["plumbing", ...bathRelated],
    primary: ["plumbing"],
    jobs: ["FIXX-PLM-001", "FIXX-PLM-002"]
  },
  {
    id: "garage",
    words: ["garage", "cochera", "estacionamiento", "entrada de coches", "driveway", "차고"],
    // Water fixtures live in the laundry and the bathrooms, not the garage.
    trades: ["concrete", "electrical", "painting", "metalwork", "locksmith", "pest_control", "handyman", "cleaning"]
  },
  {
    id: "patio",
    words: ["patio", "backyard", "yard", "yarda", "마당"],
    // A hose tap is not enough to light Plumbing next to the garden and the slab.
    trades: patioTrades
  },
  {
    id: "terrace",
    words: ["terraza", "roof terrace"],
    trades: [...patioTrades, "roofing"]
  },
  {
    id: "roof",
    words: ["azotea", "rooftop", "roof", "techo", "옥상", "지붕"],
    trades: ["roofing", "plumbing", "electrical", "cleaning", "handyman"],
    primary: ["roofing"],
    jobs: ["FIXX-ROF-001"]
  },
  {
    id: "facade",
    words: ["facade", "fachada", "frente de la casa", "외벽"],
    trades: ["painting", "metalwork", "cleaning", "concrete", "electrical", "handyman"]
  },
  {
    id: "laundry",
    words: ["laundry", "laundry room", "lavanderia", "lavandería", "cuarto de lavado", "area de lavado", "세탁실"],
    trades: ["appliance", "plumbing", "electrical", "cleaning", "handyman"]
  },
  {
    id: "stairs",
    words: ["stairs", "staircase", "stairway", "escalera", "escaleras", "계단"],
    trades: ["metalwork", "carpentry", "painting", "electrical", "handyman"]
  },
  {
    id: "hallway",
    words: ["hallway", "hall", "corridor", "pasillo", "recibidor", "entrada", "zaguan", "복도"],
    trades: ["painting", "electrical", "flooring", "cleaning", "handyman"]
  },
  {
    id: "ceiling",
    words: ["ceiling", "ceilings", "plafon", "plafón", "cielo raso", "천장"],
    trades: ["painting", "electrical", "handyman", "roofing"],
    primary: ["painting"]
  },
  {
    id: "walls",
    words: ["wall", "walls", "pared", "paredes", "muro", "muros", "벽면"],
    trades: ["painting", "handyman", "electrical", "concrete"],
    primary: ["painting"]
  },
  {
    id: "windows",
    words: ["window", "windows", "ventana", "ventanas", "창문"],
    // Glass and a wash. Bars are a metalwork word, not the window itself.
    trades: ["handyman", "cleaning"],
    primary: ["handyman"],
    narrow: true,
    jobs: ["FIXX-HND-004", "FIXX-CLN-007"]
  },
  {
    id: "doors",
    words: ["door", "doors", "puerta", "puertas", "front door", "puerta principal", "entrada principal", "현관문"],
    trades: ["carpentry", "locksmith", "handyman", "painting", "metalwork"],
    primary: ["carpentry"],
    narrow: true,
    jobs: ["FIXX-CAR-001"]
  },
  {
    id: "closet",
    words: ["closet", "closets", "vestidor", "armario", "guardarropa", "옷장"],
    trades: ["carpentry", "handyman", "painting", "cleaning"],
    primary: ["carpentry"],
    narrow: true
  },
  {
    id: "balcony",
    words: ["balcony", "balcon", "balcón", "발코니"],
    trades: ["metalwork", "painting", "cleaning", "handyman"]
  },
  {
    id: "basement",
    words: ["basement", "sotano", "sótano", "지하", "지하실"],
    trades: ["plumbing", "electrical", "pest_control", "concrete", "cleaning", "painting", "handyman"]
  },
  {
    id: "office",
    words: ["home office", "office", "estudio", "oficina", "서재"],
    trades: ["painting", "electrical", "flooring", "handyman", "carpentry", "cleaning", "hvac"]
  },
  {
    id: "generic_room",
    words: ["room", "rooms"],
    trades: livingTrades
  }
];

/**
 * Storey wording. Stripped before matching so "second floor" is context,
 * while a bare "floor" or "piso" can still mean Flooring.
 * Numbered variants ("4th floor", "2do piso") are also stripped in the matcher.
 */
export const storeyPhrases: string[] = [
  "ground floor", "first floor", "second floor", "third floor", "fourth floor", "fifth floor",
  "top floor", "upper floor", "lower floor",
  "1st floor", "2nd floor", "3rd floor", "4th floor", "5th floor",
  "primer piso", "primero piso", "segundo piso", "tercer piso", "tercero piso", "cuarto piso", "quinto piso",
  "planta alta", "planta baja",
  "piso de arriba", "piso de abajo",
  "primer nivel", "segundo nivel", "tercer nivel"
];

/** Single tokens that mean a storey, including draft Korean. */
export const storeyTokens: string[] = [
  "upstairs", "downstairs", "abajo", "arriba", "planta", "plantas", "nivel", "niveles",
  "1층", "2층", "3층", "4층", "5층",
  "일층", "이층", "삼층", "사층", "오층",
  "위층", "아래층"
];

/** Gas is safety copy, not a job. Korean wording here is a draft. */
export const gasPhrases: string[] = [
  "gas leak", "gas leaks", "natural gas", "smell of gas", "gas smell",
  "fuga de gas", "fugas de gas", "olor a gas", "huele a gas", "tanque de gas", "gas natural",
  "gas", "gases",
  "가스 누출", "가스 냄새", "가스누출", "가스냄새", "가스"
];

/**
 * Trade names a customer actually says. Display-name filler (cocheras, patios,
 * general, control, repair, techos, mantenimiento) is not in this list.
 */
export const tradeKeywords: TradeKeyword[] = [
  { tradeId: "plumbing", words: ["plumbing", "plumber", "plomeria", "plomero", "plomeros", "배관"] },
  { tradeId: "electrical", words: ["electrical", "electrician", "electricista", "electricidad", "전기"] },
  { tradeId: "hvac", words: ["hvac", "climatizacion", "냉난방"] },
  { tradeId: "painting", words: ["painter", "pintor"] },
  { tradeId: "pest_control", words: ["pest control", "control de plagas", "fumigador", "fumigacion", "해충 방제"] },
  { tradeId: "gardening", words: ["gardening", "gardener", "jardinero", "정원 관리"] },
  { tradeId: "flooring", words: ["flooring", "바닥 시공"] },
  { tradeId: "concrete", words: ["콘크리트"] },
  { tradeId: "carpentry", words: ["carpentry", "carpenter", "carpintero", "carpinteria", "목공"] },
  { tradeId: "appliance", words: ["appliance", "appliances"] },
  { tradeId: "roofing", words: ["roofing", "impermeabilizador"] },
  { tradeId: "handyman", words: ["handyman", "todologo", "생활 수리"] },
  { tradeId: "locksmith", words: ["locksmith", "cerrajero", "cerrajeria"] },
  { tradeId: "cleaning", words: ["house cleaning", "limpieza de casa"] },
  { tradeId: "metalwork", words: ["herrero"] }
];
