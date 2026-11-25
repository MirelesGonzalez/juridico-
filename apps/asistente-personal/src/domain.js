export const STORAGE_KEY = "legalos.personal-assistant.v1";

export const EMPTY_DATA = {
  cases: [],
  appointments: [],
  tasks: [],
  quotes: [],
  sentReminders: [],
};

export function readData(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY));
    if (!value || typeof value !== "object") return migrateLegacyData(storage);
    return {
      ...structuredClone(EMPTY_DATA),
      ...value,
      cases: Array.isArray(value.cases) ? value.cases : [],
      appointments: Array.isArray(value.appointments) ? value.appointments : [],
      tasks: Array.isArray(value.tasks) ? value.tasks : [],
      quotes: Array.isArray(value.quotes) ? value.quotes : [],
      sentReminders: Array.isArray(value.sentReminders) ? value.sentReminders : [],
    };
  } catch {
    return migrateLegacyData(storage);
  }
}

function migrateLegacyData(storage) {
  const readLegacy = key => {
    try {
      const value = JSON.parse(storage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };
  const legacyCases = readLegacy("exp_mgz");
  const cases = legacyCases.map(item => ({
    id: item.id || makeId(),
    number: item.numero || "",
    matter: item.tipo || "",
    client: item.quejoso || item.autoridad || "",
    court: item.juzgado || "",
    status: item.estado === "concluido" ? "concluido" : "activo",
    notes: item.notas || "",
  }));
  const caseIds = new Map(cases.map(item => [item.number, item.id]));
  const appointments = readLegacy("aud_mgz").filter(item => item.fecha).map(item => ({
    id: item.id || makeId(),
    title: item.tipo || "Actividad",
    type: item.tipo || "Otro",
    startsAt: toLocalDateTime(new Date(`${item.fecha}T${item.hora || "09:00"}`)),
    place: item.tribunal || "",
    caseId: caseIds.get(item.expediente) || "",
    notes: item.notas || "",
    reminderMinutes: 15,
  }));
  const quotes = readLegacy("cot_mgz").map(item => {
    const stages = Array.isArray(item.etapas)
      ? item.etapas.map(stage => ({
        description: (stage.t || "Servicios profesionales").replace(/\{M\}/g, "").trim(),
        amount: Number(stage.m) || 0,
      }))
      : [1, 2, 3, 4, 5]
        .filter(index => Number(item[`etapa${index}`]) > 0)
        .map(index => ({ description: `Servicios profesionales — etapa ${index}`, amount: Number(item[`etapa${index}`]) }));
    const legacyDate = item.fecha ? new Date(item.fecha) : null;
    return {
      id: item.id || makeId(),
      client: item.cliente || "",
      matter: item.tema || item.asunto || "",
      reference: item.asunto || "",
      includeIva: Boolean(item.iva),
      stages,
      createdAt: legacyDate && !Number.isNaN(legacyDate.getTime()) ? legacyDate.toISOString() : new Date().toISOString(),
    };
  });
  return { ...structuredClone(EMPTY_DATA), cases, appointments, quotes };
}

export function writeData(data, storage = globalThis.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function toLocalDateTime(value = new Date()) {
  const date = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}

export function formatDateTime(value) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no válida";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function dueItems(data, now = new Date()) {
  const items = [
    ...data.appointments.map(item => ({ ...item, kind: "appointment", dueAt: item.startsAt })),
    ...data.tasks.filter(item => !item.done && item.dueAt).map(item => ({ ...item, kind: "task" })),
  ];
  return items
    .filter(item => item.dueAt && new Date(item.dueAt).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
}

export function pendingReminders(data, now = new Date()) {
  const sent = new Set(data.sentReminders);
  const due = [];

  for (const appointment of data.appointments) {
    if (!appointment.startsAt) continue;
    const alarmAt = new Date(appointment.startsAt).getTime() - Number(appointment.reminderMinutes || 0) * 60_000;
    const startAt = new Date(appointment.startsAt).getTime();
    const key = `appointment:${appointment.id}`;
    if (now.getTime() >= alarmAt && now.getTime() < startAt + 60_000 && !sent.has(key)) {
      due.push({ key, title: appointment.title, detail: "Cita o diligencia próxima" });
    }
  }

  for (const task of data.tasks) {
    if (task.done || !task.dueAt) continue;
    const alarmAt = new Date(task.dueAt).getTime() - Number(task.reminderMinutes || 0) * 60_000;
    const key = `task:${task.id}`;
    if (now.getTime() >= alarmAt && !sent.has(key)) {
      due.push({ key, title: task.title, detail: "Pendiente de expediente" });
    }
  }

  return due;
}

const units = [
  "", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete",
  "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés",
  "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];
const tens = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const hundreds = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function underThousand(number) {
  if (number === 0) return "";
  if (number === 100) return "cien";
  const hundred = Math.floor(number / 100);
  const remainder = number % 100;
  const base = hundreds[hundred];
  if (remainder < 30) return [base, units[remainder]].filter(Boolean).join(" ");
  return [base, tens[Math.floor(remainder / 10)], remainder % 10 ? `y ${units[remainder % 10]}` : ""].filter(Boolean).join(" ");
}

function apocopate(value) {
  return value.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");
}

export function numberToWords(number) {
  if (!Number.isSafeInteger(number) || number < 0 || number > 999_999_999) {
    throw new RangeError("El monto debe ser un entero entre 0 y 999,999,999.");
  }
  if (number === 0) return "cero";

  const millions = Math.floor(number / 1_000_000);
  const thousands = Math.floor((number % 1_000_000) / 1_000);
  const remainder = number % 1_000;
  const parts = [];

  if (millions) parts.push(millions === 1 ? "un millón" : `${apocopate(numberToWords(millions))} millones`);
  if (thousands) parts.push(thousands === 1 ? "mil" : `${apocopate(underThousand(thousands))} mil`);
  if (remainder) parts.push(underThousand(remainder));
  return parts.join(" ");
}

export function formatMoney(number) {
  const value = Number(number);
  if (!Number.isFinite(value) || value < 0 || value > 999_999_999.99) {
    throw new RangeError("El monto debe ser válido y no exceder $999,999,999.99.");
  }
  const roundedCents = Math.round(value * 100 + Number.EPSILON);
  const cents = roundedCents % 100;
  const whole = Math.floor(roundedCents / 100);
  const amount = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(roundedCents / 100);
  const words = whole === 1 ? "un peso" : `${apocopate(numberToWords(whole))}${whole >= 1_000_000 && whole % 1_000_000 === 0 ? " de" : ""} pesos`;
  return `${amount} (${words} ${String(cents).padStart(2, "0")}/100 M.N.)`;
}

export function quoteTotal(quote) {
  const subtotal = quote.stages.reduce((total, stage) => total + (Number(stage.amount) || 0), 0);
  return quote.includeIva ? subtotal * 1.16 : subtotal;
}

export function quoteText(quote, profile) {
  const subtotal = quote.stages.reduce((total, stage) => total + (Number(stage.amount) || 0), 0);
  const total = quoteTotal(quote);
  const stages = quote.stages.map((stage, index) =>
    `${index + 1}. ${stage.description.trim() || "Servicios profesionales"}: ${formatMoney(stage.amount || 0)}.`
  );
  const ivaText = quote.includeIva
    ? `\nSubtotal: ${formatMoney(subtotal)}.\nIVA (16%): ${formatMoney(subtotal * 0.16)}.\n`
    : "\n";

  return [
    `COTIZACIÓN DE HONORARIOS${quote.reference ? `\nAsunto: ${quote.reference}` : ""}`,
    `Fecha: ${new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(new Date())}`,
    `Cliente: ${quote.client}`,
    `Asunto: ${quote.matter}`,
    "",
    "ETAPAS Y HONORARIOS",
    ...stages,
    ivaText.trimEnd(),
    `TOTAL: ${formatMoney(total)}.`,
    "",
    "Los gastos, derechos y erogaciones de terceros no están incluidos, salvo pacto expreso.",
    "",
    "Atentamente,",
    profile.name,
    `Cédula Profesional: ${profile.license} · TSJ-NL: ${profile.barNumber}`,
    profile.firm,
    `Tel: ${profile.phone}`,
  ].filter(Boolean).join("\n");
}
