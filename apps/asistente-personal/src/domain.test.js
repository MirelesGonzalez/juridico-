import test from "node:test";
import assert from "node:assert/strict";
import {
  dueItems,
  formatMoney,
  numberToWords,
  pendingReminders,
  quoteTotal,
  quoteText,
  readData,
  STORAGE_KEY,
} from "./domain.js";

test("readData returns safe empty data when storage has no record", () => {
  const storage = { getItem: key => key === STORAGE_KEY ? null : null };
  assert.deepEqual(readData(storage), {
    cases: [],
    appointments: [],
    tasks: [],
    quotes: [],
    sentReminders: [],
  });
});

test("readData migrates legacy case, appointment, and quote records", () => {
  const records = {
    exp_mgz: [{ id: "case-1", numero: "215/2026", tipo: "amparo_indirecto", quejoso: "Cliente" }],
    aud_mgz: [{ id: "appointment-1", expediente: "215/2026", tipo: "Audiencia", fecha: "2026-12-01", hora: "10:00" }],
    cot_mgz: [{ id: "quote-1", cliente: "Cliente", tema: "Amparo", iva: true, fecha: "24/11/2026", etapas: [{ t: "Demanda {M}", m: 1000 }] }],
  };
  const migrated = readData({ getItem: key => key === STORAGE_KEY ? null : JSON.stringify(records[key] || []) });
  assert.equal(migrated.cases[0].number, "215/2026");
  assert.equal(migrated.appointments[0].caseId, "case-1");
  assert.equal(migrated.quotes[0].stages[0].amount, 1000);
  assert.equal(migrated.quotes[0].includeIva, true);
});

test("dueItems orders upcoming appointments and open dated tasks", () => {
  const now = new Date("2026-11-24T12:00:00");
  const items = dueItems({
    appointments: [{ id: "a", title: "Audiencia", startsAt: "2026-11-25T10:00:00" }],
    tasks: [
      { id: "t1", title: "Escrito", dueAt: "2026-11-24T13:00:00", done: false },
      { id: "t2", title: "Cerrada", dueAt: "2026-11-24T12:30:00", done: true },
      { id: "t3", title: "Vencida", dueAt: "2026-11-24T11:00:00", done: false },
    ],
  }, now);
  assert.deepEqual(items.map(item => item.id), ["t1", "a"]);
});

test("pendingReminders emits each due appointment/task once and skips completed tasks", () => {
  const now = new Date("2026-11-24T10:00:00");
  const result = pendingReminders({
    sentReminders: ["appointment:sent"],
    appointments: [
      { id: "sent", title: "Avisada", startsAt: "2026-11-24T10:10:00", reminderMinutes: 15 },
      { id: "next", title: "Audiencia", startsAt: "2026-11-24T10:10:00", reminderMinutes: 15 },
    ],
    tasks: [
      { id: "task", title: "Presentar promoción", dueAt: "2026-11-24T09:00:00", reminderMinutes: 0, done: false },
      { id: "done", title: "Concluida", dueAt: "2026-11-24T09:00:00", done: true },
    ],
  }, now);
  assert.deepEqual(result.map(item => item.key), ["appointment:next", "task:task"]);
});

test("pendingReminders supports a reminder set for the appointment time", () => {
  const result = pendingReminders({
    sentReminders: [],
    appointments: [{ id: "now", title: "Junta", startsAt: "2026-11-24T10:00:00", reminderMinutes: 0 }],
    tasks: [],
  }, new Date("2026-11-24T10:00:00"));
  assert.deepEqual(result.map(item => item.key), ["appointment:now"]);
});

test("numberToWords handles pesos and rejects unsupported amounts", () => {
  assert.equal(numberToWords(21), "veintiuno");
  assert.equal(numberToWords(1_021_000), "un millón veintiún mil");
  assert.throws(() => numberToWords(-1), RangeError);
});

test("formatMoney and quoteTotal account for cents and optional IVA", () => {
  assert.equal(formatMoney(1.25), "$1.25 (un peso 25/100 M.N.)");
  assert.equal(formatMoney(21), "$21.00 (veintiún pesos 00/100 M.N.)");
  assert.equal(formatMoney(1_000_000), "$1,000,000.00 (un millón de pesos 00/100 M.N.)");
  assert.equal(quoteTotal({ stages: [{ amount: 100 }, { amount: "50" }], includeIva: true }), 174);
  assert.equal(quoteTotal({ stages: [{ amount: 100 }], includeIva: false }), 100);
});

test("quoteText includes staged amounts, IVA, and the firm signature", () => {
  const text = quoteText({
    client: "Cliente",
    matter: "Juicio civil",
    reference: "Asunto de prueba",
    includeIva: true,
    stages: [{ description: "Demanda", amount: 1000 }],
  }, {
    name: "Lic. Ejemplo",
    license: "123",
    barNumber: "456",
    firm: "Despacho Ejemplo",
    phone: "800-000-0000",
  });
  assert.match(text, /IVA \(16%\)/);
  assert.match(text, /TOTAL: \$1,160\.00/);
  assert.match(text, /Cédula Profesional: 123 · TSJ-NL: 456/);
});
