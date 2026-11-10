/**
 * Lay-language search words for Choose a service.
 *
 * How to add a word
 * -----------------
 * 1. Direct trade or problem: add the base word to `tradeSynonyms` on that
 *    trade. A hit glows the trade strong and suggests `jobs` (best first).
 *    Trades in `related` glow soft. Put the specific phrase above the short
 *    word when both exist ("piso roto" above "roto") so the specific job wins.
 * 2. Every catalog job id should appear in some `jobs` list. Words are
 *    accent-insensitive. Plurals ("pisos", "toilets") and a typed prefix
 *    ("fug" -> "fuga", "calent" -> "calentador") already match, so add the
 *    base word. A word that is its own entry will not swallow a longer
 *    different word ("lavar" does not hit "lavadora", "ac" does not hit "acero").
 * 3. Room or space: add it under `rooms`. With only a room in the sentence,
 *    those trades glow soft. `strong` is the trade that should glow harder
 *    (a bathroom glows Plumbing strong). A direct word, or that strong trade,
 *    turns the other room trades off. `jobs` on a room are used only when the
 *    sentence has no direct word, and should stay at one or two chips.
 * 4. A storey ("second floor", "segundo piso", "2층"): add the phrase to
 *    `storeyPhrases` or the single token to `storeyTokens`. That keeps
 *    "floor" / "piso" for Flooring and stops "second floor" from lighting it.
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

export interface TradeSynonym {
  /** Home-screen category id. A hit glows this trade strong. */
  tradeId: string;
  /** English, Mexican Spanish, and draft Korean. */
  words: string[];
  /** Other trades that glow soft when one of these words hits. */
  related?: string[];
  /** Catalog task ids, best suggestion first. At most three are shown. */
  jobs?: string[];
  /**
   * Chip rank. Specific jobs stay at 100. Vague words ("broken") stay lower
   * so they do not jump ahead of a toilet, a leak, or a glass pane.
   */
  score?: number;
}

export interface RoomSynonym {
  id: string;
  /** Phrases and single words. Longer phrases win over a word inside them. */
  words: string[];
  /** Soft glow, including any id also listed in `strong`. */
  trades: string[];
  /** Room match that should still glow strong. Bathroom -> plumbing. */
  strong?: string[];
  /** Suggested only when no direct word matched a job. Keep this to 1 or 2. */
  jobs?: string[];
}

export const tradeSynonyms: TradeSynonym[] = [
  // --- Plumbing ---
  {
    tradeId: "plumbing",
    words: [
      "toilet", "wc", "excusado", "taza", "inodoro", "retrete",
      "변기", "양변기"
    ],
    related: bathRelated,
    jobs: ["FIXX-PLM-001"]
  },
  {
    tradeId: "plumbing",
    words: [
      "faucet", "tap", "monomando", "llave de agua", "grifo", "mezcladora",
      "lavabo", "sink", "fregadero", "tarja", "fregadero tapado",
      "세면대", "싱크대", "수전"
    ],
    related: bathRelated,
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
      "calentador no calienta", "no calienta el agua", "agua fria", "hot water", "agua caliente",
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
    words: [
      "leak", "leaking", "leaky", "fuga", "fuga de agua", "goteo", "gotea", "goteando",
      "se sale el agua", "tuberia", "tubo", "pipe", "pipes", "pvc", "pex", "cobre", "copper",
      "tinaco", "cisterna", "aljibe", "bomba de agua", "sin agua", "no hay agua", "baja presion",
      "presion de agua", "valvula", "flotador", "sapo", "mugre del tinaco",
      "누수", "배관", "수도"
    ],
    related: ["roofing"],
    jobs: ["FIXX-PLM-006"]
  },
  {
    tradeId: "plumbing",
    words: [
      "regadera", "ducha", "shower", "showerhead", "lluvia",
      "샤워", "샤워기"
    ],
    related: bathRelated
  },
  {
    tradeId: "plumbing",
    words: [
      "smells", "stinks", "huele mal", "mal olor", "olor a drenaje", "olor a caño",
      "냄새", "하수구 냄새"
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
      "정전", "전등", "조명", "불이 안 켜요"
    ],
    jobs: ["FIXX-ELC-002"]
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
    words: ["circuito 220", "220 v", "minisplit circuit", "pastilla del minisplit"],
    related: ["hvac"],
    jobs: ["FIXX-ELC-004"]
  },
  {
    tradeId: "electrical",
    words: [
      "short", "short circuit", "corto", "cortocircuito", "chispa", "chispas",
      "breaker", "fuse", "fusible", "pastilla", "pastillas", "se bota la pastilla",
      "centro de carga", "cable", "cableado", "wiring", "wire", "chispazo",
      "단락", "차단기", "누전"
    ],
    jobs: ["FIXX-ELC-005"]
  },

  // --- HVAC ---
  {
    tradeId: "hvac",
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
    related: ["pest_control", "cleaning", "handyman"],
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
    words: ["crack", "cracks", "grieta", "grietas", "resane", "resanar", "concrete crack"],
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
    related: ["appliance", "electrical"],
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
    jobs: ["FIXX-HND-002"],
    score: 90
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
  {
    tradeId: "locksmith",
    words: ["puerta principal", "front door", "entrada principal"],
    related: ["carpentry", "metalwork"],
    jobs: ["FIXX-LCK-001"]
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
    related: ["handyman"],
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
    related: ["locksmith"],
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
  }
];

const livingTrades = [
  "painting", "flooring", "electrical", "hvac", "handyman", "carpentry",
  "cleaning", "pest_control", "appliance"
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
    // A bedroom door lock is a real job. The living room does not get one.
    trades: [...livingTrades, "locksmith"]
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
    strong: ["plumbing"],
    jobs: ["FIXX-PLM-001", "FIXX-PLM-002"]
  },
  {
    id: "garage",
    words: ["garage", "cochera", "estacionamiento", "차고"],
    // Water fixtures live in the laundry and the bathrooms, not the garage.
    trades: ["concrete", "electrical", "painting", "metalwork", "locksmith", "pest_control", "handyman", "cleaning"]
  },
  {
    id: "patio",
    words: ["patio", "backyard", "yard", "yarda", "terraza", "마당"],
    // A hose tap is not enough to light Plumbing next to the garden and the slab.
    trades: ["gardening", "concrete", "pest_control", "electrical", "cleaning", "metalwork", "handyman"]
  },
  {
    id: "roof",
    words: ["azotea", "rooftop", "roof", "techo", "옥상", "지붕"],
    trades: ["roofing", "plumbing", "electrical", "cleaning", "handyman"],
    strong: ["roofing"],
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
    words: ["hallway", "hall", "corridor", "pasillo", "recibidor", "entrada", "복도"],
    trades: ["painting", "electrical", "flooring", "cleaning", "handyman", "locksmith"]
  },
  {
    id: "ceiling",
    words: ["ceiling", "ceilings", "plafon", "plafón", "cielo raso", "천장"],
    trades: ["painting", "electrical", "handyman"],
    strong: ["painting"]
  },
  {
    id: "walls",
    words: ["wall", "walls", "pared", "paredes", "muro", "muros", "벽면"],
    trades: ["painting", "electrical", "handyman", "carpentry"],
    strong: ["painting"]
  },
  {
    id: "windows",
    words: ["window", "windows", "ventana", "ventanas", "창문"],
    // Frame paint is a stretch next to the glass, the bars, and a window wash.
    trades: ["handyman", "cleaning", "metalwork"],
    strong: ["handyman"],
    jobs: ["FIXX-HND-004", "FIXX-CLN-007"]
  },
  {
    id: "doors",
    words: ["door", "doors", "puerta", "puertas", "현관문"],
    trades: ["carpentry", "locksmith", "handyman", "painting"],
    strong: ["carpentry"],
    jobs: ["FIXX-CAR-001"]
  },
  {
    id: "closet",
    words: ["closet", "closets", "vestidor", "armario", "guardarropa", "옷장"],
    trades: ["carpentry", "handyman", "painting", "cleaning"],
    strong: ["carpentry"]
  },
  {
    id: "balcony",
    words: ["balcony", "balcon", "balcón", "발코니"],
    trades: ["metalwork", "painting", "cleaning", "roofing", "handyman"]
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
  "upstairs", "downstairs",
  "1층", "2층", "3층", "4층", "5층",
  "일층", "이층", "삼층", "사층", "오층",
  "위층", "아래층"
];
