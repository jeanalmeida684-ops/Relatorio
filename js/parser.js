// Interpreta frases faladas em português sobre atendimentos técnicos e
// extrai setor/máquina, duração e horário. Heurístico por natureza — o
// resultado sempre passa por uma tela de confirmação antes de ser salvo.

const UNIT_WORDS = {
  "zero": 0, "um": 1, "uma": 1, "dois": 2, "duas": 2, "tres": 3, "três": 3,
  "quatro": 4, "cinco": 5, "seis": 6, "sete": 7, "oito": 8, "nove": 9,
  "dez": 10, "onze": 11, "doze": 12, "treze": 13, "catorze": 14, "quatorze": 14,
  "quinze": 15, "dezesseis": 16, "dezessete": 17, "dezoito": 18, "dezenove": 19
};

const TEN_WORDS = {
  "vinte": 20, "trinta": 30, "quarenta": 40, "cinquenta": 50,
  "sessenta": 60, "setenta": 70, "oitenta": 80, "noventa": 90
};

function parseNumberPhrase(str) {
  if (str == null) return null;
  str = String(str).trim().toLowerCase();
  if (str === "") return null;
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  if (str === "cem" || str === "cento") return 100;

  const tokens = str.split(/\s+/).filter(t => t && t !== "e");
  let total = 0;
  let found = false;
  for (const t of tokens) {
    if (TEN_WORDS[t] != null) { total += TEN_WORDS[t]; found = true; }
    else if (UNIT_WORDS[t] != null) { total += UNIT_WORDS[t]; found = true; }
    else if (t === "cem" || t === "cento") { total += 100; found = true; }
  }
  return found ? total : null;
}

function extractDuration(text) {
  const lower = text.toLowerCase();
  let totalMin = 0;
  let found = false;

  const hourRe = /(\d+|[a-zà-ú]+(?:\s+e\s+[a-zà-ú]+)?)\s*horas?(?:\s+e\s+(meia|\d+\s*minutos?|[a-zà-ú]+(?:\s+e\s+[a-zà-ú]+)?(?:\s*minutos?)?))?/i;
  const mHour = lower.match(hourRe);

  if (mHour) {
    const h = parseNumberPhrase(mHour[1]);
    if (h != null) {
      totalMin += h * 60;
      found = true;
    } else if (/^meia$/i.test(mHour[1].trim())) {
      totalMin += 30;
      found = true;
    }
    if (mHour[2]) {
      if (/meia/.test(mHour[2])) {
        totalMin += 30;
      } else {
        const mm = parseNumberPhrase(mHour[2].replace(/minutos?/, "").trim());
        if (mm != null) totalMin += mm;
      }
    }
  } else if (/\bmeia\s+hora\b/.test(lower)) {
    totalMin += 30;
    found = true;
  }

  if (!found) {
    const minRe = /(\d+|[a-zà-ú]+(?:\s+e\s+[a-zà-ú]+)?)\s*minutos?/i;
    const mMin = lower.match(minRe);
    if (mMin) {
      const mm = parseNumberPhrase(mMin[1]);
      if (mm != null) {
        totalMin += mm;
        found = true;
      }
    }
  }

  return found ? totalMin : null;
}

function parseClockPhrase(phrase, fallbackPeriod) {
  if (!phrase) return null;
  let p = phrase.trim().toLowerCase();

  if (/meio[\s-]?dia/.test(p)) return { minutes: 12 * 60, period: "pm" };
  if (/meia[\s-]?noite/.test(p)) return { minutes: 0, period: "am" };

  let period = null;
  if (/da tarde|da noite/.test(p)) period = "pm";
  if (/da manh[ãa]/.test(p)) period = "am";
  const explicitPeriod = period;
  if (!period && fallbackPeriod) period = fallbackPeriod;
  p = p.replace(/d[ao]s?\s+(tarde|noite|manh[ãa])/g, "").trim();

  let minutes = 0;
  const half = /\be\s+meia\b/.test(p);
  if (half) {
    minutes = 30;
    p = p.replace(/\be\s+meia\b/, "").trim();
  } else {
    const minWordMatch = p.match(/\be\s+(\d{1,2}|[a-zà-ú]+(?:\s+e\s+[a-zà-ú]+)?)\s*(?:minutos?)?$/);
    if (minWordMatch) {
      const mm = parseNumberPhrase(minWordMatch[1]);
      if (mm != null) {
        minutes = mm;
        p = p.slice(0, minWordMatch.index).trim();
      }
    }
  }

  let hour = null;
  const hm = p.match(/^(\d{1,2})\s*[h:]\s*(\d{1,2})?/);
  if (hm) {
    hour = parseInt(hm[1], 10);
    if (hm[2]) minutes = parseInt(hm[2], 10);
  } else {
    p = p.replace(/horas?/, "").trim();
    const num = parseNumberPhrase(p);
    if (num != null) hour = num;
  }

  if (hour == null) return null;
  if (period === "pm" && hour < 12) hour += 12;
  if (period === "am" && hour === 12) hour = 0;
  hour = ((hour % 24) + 24) % 24;
  return { minutes: hour * 60 + minutes, period: explicitPeriod };
}

function extractTimeRange(text) {
  const rangeRe = /\bdas?\s+(.+?)\s+(?:at[ée]|às|as)\s+(.+?)(?=[,.;]|$)/i;
  const m = text.match(rangeRe);
  if (!m) return null;
  const start = parseClockPhrase(m[1], null);
  if (!start) return null;
  const end = parseClockPhrase(m[2], start.period);
  if (!end) return null;
  return { startMin: start.minutes, endMin: end.minutes };
}

const LOCATION_TRIGGERS = [
  { re: /\bna\s+m[aá]quina\b/i, label: "Máquina" },
  { re: /\bno\s+setor\b/i, label: "Setor" },
  { re: /\bna\s+linha\b/i, label: "Linha" },
  { re: /\bno\s+painel\b/i, label: "Painel" },
  { re: /\bna\s+sala\b/i, label: "Sala" },
  { re: /\bno\s+ccm\b/i, label: "CCM" },
  { re: /\bna\s+subesta[cç][aã]o\b/i, label: "Subestação" },
  { re: /\bno\s+quadro\b/i, label: "Quadro" },
  { re: /\bna\s+esteira\b/i, label: "Esteira" }
];

function extractLocation(text) {
  for (const trig of LOCATION_TRIGGERS) {
    const m = text.match(trig.re);
    if (!m) continue;
    let rest = text.slice(m.index + m[0].length);
    const stopRe = /\b(gastei|levei|demorei|fiquei|das|por|durante|que|e\s+troquei|e\s+fiz)\b|[,.;]/i;
    const sm = rest.search(stopRe);
    if (sm !== -1) rest = rest.slice(0, sm);
    rest = rest.trim().split(/\s+/).slice(0, 4).join(" ").replace(/[.,;]+$/, "");
    if (rest) return { tipo: trig.label, valor: rest };
  }
  return null;
}

function minutesToHHMM(min) {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return String(h).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
}

function hhmmToMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function parseReport(text, now) {
  now = now || new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const range = extractTimeRange(text);
  const duration = extractDuration(text);
  const location = extractLocation(text);

  let inicioMin, fimMin;

  if (range) {
    inicioMin = range.startMin;
    fimMin = range.endMin;
  } else if (duration != null) {
    fimMin = nowMin;
    inicioMin = nowMin - duration;
  } else {
    fimMin = nowMin;
    inicioMin = nowMin;
  }

  let duracaoMin = fimMin - inicioMin;
  if (duracaoMin < 0) duracaoMin += 1440;

  let dateOffsetDays = 0;
  if (/\bontem\b/i.test(text)) dateOffsetDays = -1;

  return {
    setor: location ? `${location.tipo} ${location.valor}` : "",
    inicio: minutesToHHMM(inicioMin),
    fim: minutesToHHMM(fimMin),
    duracaoMin,
    descricao: capitalize(text.trim()),
    dateOffsetDays
  };
}

function formatDuration(min) {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}
