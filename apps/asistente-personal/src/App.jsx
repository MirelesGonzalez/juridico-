import { useEffect, useMemo, useState } from "react";
import {
  dueItems,
  EMPTY_DATA,
  formatDateTime,
  formatMoney,
  makeId,
  pendingReminders,
  quoteText,
  quoteTotal,
  readData,
  toLocalDateTime,
  writeData,
} from "./domain.js";

const PROFILE = {
  name: "LIC. EDGAR JAIR MIRELES GONZÁLEZ",
  firm: "ABOGADOS MIRELES GONZÁLEZ Y ASOCIADOS S.A.",
  license: "14924346",
  barNumber: "24499",
  phone: "818.137.1871 / 811.639.1477",
};

const TABS = [
  ["inicio", "Resumen"],
  ["agenda", "Agenda"],
  ["expedientes", "Expedientes"],
  ["cotizaciones", "Cotizaciones"],
];
const APPOINTMENT_TYPES = ["Audiencia", "Junta", "Cita", "Vencimiento", "Diligencia", "Otro"];
const REMINDER_OPTIONS = [
  ["0", "A la hora"],
  ["5", "5 minutos antes"],
  ["15", "15 minutos antes"],
  ["30", "30 minutos antes"],
  ["60", "1 hora antes"],
  ["1440", "1 día antes"],
];

function Field({ label, children, className = "" }) {
  return <label className={`field ${className}`}><span>{label}</span>{children}</label>;
}

function Button({ children, variant = "secondary", ...props }) {
  return <button className={`button ${variant}`} {...props}>{children}</button>;
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Cerrar">×</button></div>
        {children}
      </section>
    </div>
  );
}

function App() {
  const [data, setData] = useState(() => readData());
  const [tab, setTab] = useState("inicio");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [notificationPermission, setNotificationPermission] = useState(() => globalThis.Notification?.permission ?? "unsupported");
  const [pendingImport, setPendingImport] = useState(null);

  useEffect(() => {
    try { writeData(data); } catch { setToast("No se pudo guardar en este navegador. Exporta o respalda tus datos."); }
  }, [data]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const reminders = pendingReminders(data, now);
    if (!reminders.length) return;
    setData(current => ({
      ...current,
      sentReminders: [...new Set([...current.sentReminders, ...reminders.map(item => item.key)])],
    }));
    reminders.forEach(reminder => {
      setToast(`${reminder.detail}: ${reminder.title}`);
      if (globalThis.Notification?.permission === "granted") {
        new Notification(reminder.title, { body: reminder.detail, tag: reminder.key });
      }
    });
  }, [now, data]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const upcoming = useMemo(() => dueItems(data, now).slice(0, 6), [data, now]);
  const activeCases = data.cases.filter(item => item.status !== "concluido");
  const pendingTasks = data.tasks.filter(item => !item.done);
  const overdueTasks = pendingTasks.filter(item => item.dueAt && new Date(item.dueAt) < now);

  function update(collection, next) {
    setData(current => ({ ...current, [collection]: next }));
  }

  function saveAppointment(form) {
    if (!form.title.trim() || !form.startsAt) return setToast("Indica el nombre y la fecha de la cita.");
    const appointment = { ...form, id: form.id || makeId(), reminderMinutes: Number(form.reminderMinutes) };
    if (form.id) {
      const previous = data.appointments.find(item => item.id === form.id);
      setData(current => ({
        ...current,
        appointments: current.appointments.map(item => item.id === form.id ? appointment : item),
        sentReminders: previous && (previous.startsAt !== appointment.startsAt || previous.reminderMinutes !== appointment.reminderMinutes)
          ? current.sentReminders.filter(key => key !== `appointment:${form.id}`)
          : current.sentReminders,
      }));
    } else {
      update("appointments", [...data.appointments, appointment]);
    }
    setModal(null);
  }

  function saveCase(form) {
    if (!form.number.trim()) return setToast("Indica el número o identificador del expediente.");
    const item = { ...form, id: form.id || makeId() };
    update("cases", form.id ? data.cases.map(entry => entry.id === form.id ? item : entry) : [item, ...data.cases]);
    setModal(null);
  }

  function saveTask(form) {
    if (!form.title.trim()) return setToast("Describe el pendiente.");
    const item = { ...form, id: form.id || makeId(), done: Boolean(form.done), reminderMinutes: Number(form.reminderMinutes) };
    if (form.id) {
      const previous = data.tasks.find(entry => entry.id === form.id);
      setData(current => ({
        ...current,
        tasks: current.tasks.map(entry => entry.id === form.id ? item : entry),
        sentReminders: previous && (previous.dueAt !== item.dueAt || previous.reminderMinutes !== item.reminderMinutes)
          ? current.sentReminders.filter(key => key !== `task:${form.id}`)
          : current.sentReminders,
      }));
    } else {
      update("tasks", [item, ...data.tasks]);
    }
    setModal(null);
  }

  function saveQuote(form) {
    if (!form.client.trim() || !form.matter.trim() || !form.stages.length) return setToast("Completa cliente, asunto y al menos una etapa.");
    if (form.stages.some(stage => !Number.isFinite(Number(stage.amount)) || Number(stage.amount) < 0)) {
      return setToast("Los importes de las etapas deben ser cantidades positivas.");
    }
    if (quoteTotal(form) > 999_999_999.99) return setToast("El importe total excede el límite permitido.");
    const item = { ...form, id: form.id || makeId(), createdAt: form.createdAt || new Date().toISOString() };
    update("quotes", form.id ? data.quotes.map(entry => entry.id === form.id ? item : entry) : [item, ...data.quotes]);
    setModal({ type: "quote-preview", quote: item });
  }

  async function enableNotifications() {
    if (!globalThis.Notification) return setToast("Este navegador no permite notificaciones. Los avisos aparecerán dentro de la aplicación.");
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      setToast(permission === "granted" ? "Notificaciones activadas mientras la aplicación esté abierta." : "Permiso de notificaciones no concedido.");
    } catch {
      setToast("No se pudo solicitar el permiso. Los avisos aparecerán dentro de la aplicación.");
    }
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `legal-os-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(file) {
    try {
      const imported = JSON.parse(await file.text());
      for (const key of ["cases", "appointments", "tasks", "quotes"]) {
        if (!Array.isArray(imported[key])) throw new Error("El respaldo no tiene un formato compatible.");
      }
      setPendingImport({ ...EMPTY_DATA, ...imported });
    } catch (error) {
      setToast(error.message || "No se pudo leer el archivo de respaldo.");
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" onClick={() => setTab("inicio")} aria-label="Inicio LEGAL-OS">
          <span className="brand-mark">L</span>
          <span><b>LEGAL-OS</b><small>ASISTENTE PERSONAL</small></span>
        </a>
        <div className="profile-block"><span>{PROFILE.name}</span><small>Cédula {PROFILE.license} · TSJ-NL {PROFILE.barNumber}</small></div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <div className="nav-label">ESPACIO DE TRABAJO</div>
          {TABS.map(([id, label], index) => (
            <button key={id} onClick={() => setTab(id)} className={`nav-item ${tab === id ? "selected" : ""}`}>
              <span className="nav-icon">{["⌂", "◷", "▤", "$"][index]}</span>{label}
              {id === "expedientes" && pendingTasks.length > 0 && <span className="nav-count">{pendingTasks.length}</span>}
            </button>
          ))}
          <div className="sidebar-bottom">
            <p>DATOS EN ESTE DISPOSITIVO</p>
            <div className="privacy-badge">Uso personal · Acceso local</div>
            <Button onClick={exportBackup}>↓ Exportar respaldo</Button>
            <label className="button secondary import-button">↑ Importar respaldo<input type="file" accept="application/json,.json" onChange={event => event.target.files?.[0] && importBackup(event.target.files[0])} /></label>
            <small>Los registros se guardan localmente en este navegador.</small>
          </div>
        </aside>

        <main className="main-content">
          {toast && <div className="toast" role="status">{toast}<button onClick={() => setToast("")}>×</button></div>}
          {tab === "inicio" && <Dashboard
            data={data} upcoming={upcoming} activeCases={activeCases.length}
            pendingTasks={pendingTasks.length} overdueTasks={overdueTasks.length}
            now={now} setTab={setTab} openModal={setModal} enableNotifications={enableNotifications}
            notificationPermission={notificationPermission}
          />}
          {tab === "agenda" && <Agenda data={data} cases={data.cases} now={now} openModal={setModal} update={update} />}
          {tab === "expedientes" && <Cases data={data} openModal={setModal} update={update} />}
          {tab === "cotizaciones" && <Quotes data={data} openModal={setModal} update={update} />}
        </main>
      </div>

      {modal?.type === "appointment" && <AppointmentForm initial={modal.item} cases={data.cases} onSave={saveAppointment} onClose={() => setModal(null)} />}
      {modal?.type === "case" && <CaseForm initial={modal.item} onSave={saveCase} onClose={() => setModal(null)} />}
      {modal?.type === "task" && <TaskForm initial={modal.item} cases={data.cases} onSave={saveTask} onClose={() => setModal(null)} />}
      {modal?.type === "quote" && <QuoteForm initial={modal.item} onSave={saveQuote} onClose={() => setModal(null)} />}
      {modal?.type === "quote-preview" && <QuotePreview quote={modal.quote} onClose={() => setModal(null)} />}
      {pendingImport && <Modal title="Reemplazar datos locales" onClose={() => setPendingImport(null)}>
        <p className="import-warning">Importar este respaldo sustituirá los expedientes, actividades, pendientes y cotizaciones guardados en este navegador. Exporta una copia si necesitas conservarlos.</p>
        <div className="form-actions"><Button onClick={() => setPendingImport(null)}>Cancelar</Button><Button variant="primary" onClick={() => { setData(pendingImport); setPendingImport(null); setToast("Respaldo importado."); }}>Reemplazar e importar</Button></div>
      </Modal>}
    </div>
  );
}

function PageHeading({ eyebrow, title, action, children }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{children}</div>{action}</div>;
}

function Dashboard({ data, upcoming, activeCases, pendingTasks, overdueTasks, now, setTab, openModal, enableNotifications, notificationPermission }) {
  const today = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);
  const greeting = now.getHours() < 12 ? "Buenos días" : now.getHours() < 19 ? "Buenas tardes" : "Buenas noches";
  return <>
    <PageHeading eyebrow="TU DESPACHO, EN ORDEN" title={`${greeting}, Edgar.`} action={<Button variant="primary" onClick={enableNotifications}>♧ {notificationPermission === "granted" ? "Avisos activos" : "Activar avisos"}</Button>}>
      <p className="muted capitalize">{today}</p>
    </PageHeading>
    <section className="metric-grid">
      <Metric label="Expedientes activos" value={activeCases} icon="▤" tone="green" />
      <Metric label="Pendientes por hacer" value={pendingTasks} icon="✓" tone="blue" />
      <Metric label="Pendientes vencidos" value={overdueTasks} icon="!" tone={overdueTasks ? "red" : "gold"} />
      <Metric label="Citas en agenda" value={data.appointments.length} icon="◷" tone="gold" />
    </section>
    <section className="quick-actions">
      <button onClick={() => openModal({ type: "appointment" })}><span>＋</span><b>Agendar cita</b><small>Audiencias, juntas y más</small></button>
      <button onClick={() => openModal({ type: "task" })}><span>✓</span><b>Agregar pendiente</b><small>Vinculado a un expediente</small></button>
      <button onClick={() => openModal({ type: "quote" })}><span>$</span><b>Crear cotización</b><small>Honorarios por etapas</small></button>
    </section>
    <div className="dashboard-columns">
      <section className="panel">
        <div className="panel-heading"><div><div className="eyebrow">LO QUE SIGUE</div><h2>Próximas actividades</h2></div><button className="text-button" onClick={() => setTab("agenda")}>Ver agenda →</button></div>
        {upcoming.length ? <div className="activity-list">{upcoming.map(item => (
          <div className="activity" key={`${item.kind}-${item.id}`}>
            <div className={`activity-date ${item.kind}`}><b>{new Date(item.dueAt).toLocaleDateString("es-MX", { day: "2-digit" })}</b><small>{new Date(item.dueAt).toLocaleDateString("es-MX", { month: "short" })}</small></div>
            <div className="activity-content"><b>{item.title}</b><span>{formatDateTime(item.dueAt)}{item.caseId ? ` · Exp. ${data.cases.find(caseItem => caseItem.id === item.caseId)?.number || "sin identificar"}` : ""}</span></div>
            <span className={`pill ${item.kind}`}>{item.kind === "task" ? "Pendiente" : item.type}</span>
          </div>
        ))}</div> : <EmptyState title="Tu agenda está despejada" text="Agrega una audiencia, junta o pendiente para empezar." />}
      </section>
      <section className="panel focus-panel">
        <div className="eyebrow">TU ENFOQUE</div><h2>Un paso a la vez.</h2>
        <p>Registra fechas y tareas por expediente para tener claro qué sigue y cuándo.</p>
        <button className="focus-link" onClick={() => setTab("expedientes")}>Revisar expedientes <span>→</span></button>
        <div className="focus-note"><span>i</span> Tus datos se conservan en este dispositivo. Descarga respaldos periódicos.</div>
      </section>
    </div>
  </>;
}

function Metric({ label, value, icon, tone }) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><div><b>{value}</b><span>{label}</span></div></div>;
}

function Agenda({ data, cases, now, openModal, update }) {
  const [filter, setFilter] = useState("proximas");
  const items = [...data.appointments].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    .filter(item => filter === "todas" || new Date(item.startsAt) >= now);
  return <>
    <PageHeading eyebrow="CALENDARIO DEL DESPACHO" title="Agenda" action={<Button variant="primary" onClick={() => openModal({ type: "appointment" })}>＋ Agendar actividad</Button>}>
      <p className="muted">Audiencias, juntas, citas, diligencias y vencimientos.</p>
    </PageHeading>
    <div className="toolbar"><div className="segmented">
      <button className={filter === "proximas" ? "active" : ""} onClick={() => setFilter("proximas")}>Próximas</button>
      <button className={filter === "todas" ? "active" : ""} onClick={() => setFilter("todas")}>Todas</button>
    </div><span className="muted">{items.length} actividades</span></div>
    <section className="panel">
      {items.length ? items.map(item => <article className="list-row" key={item.id}>
        <div className="row-date"><b>{new Date(item.startsAt).toLocaleDateString("es-MX", { day: "2-digit" })}</b><small>{new Date(item.startsAt).toLocaleDateString("es-MX", { month: "short" })}</small></div>
        <div className="row-main"><div className="row-title">{item.title}<span className="pill appointment">{item.type}</span></div>        <div className="row-meta">{formatDateTime(item.startsAt)}{item.place && ` · ${item.place}`}{item.caseId && ` · Exp. ${cases.find(caseItem => caseItem.id === item.caseId)?.number || "sin identificar"}`}</div>{item.notes && <p className="row-notes">{item.notes}</p>}</div>
        <div className="row-actions"><button title="Editar" onClick={() => openModal({ type: "appointment", item })}>Editar</button><button className="danger-text" title="Eliminar" onClick={() => update("appointments", data.appointments.filter(entry => entry.id !== item.id))}>Eliminar</button></div>
      </article>) : <EmptyState title="No hay actividades registradas" text="Agenda audiencias, citas y reuniones para verlas aquí." />}
    </section>
  </>;
}

function Cases({ data, openModal, update }) {
  const [filter, setFilter] = useState("");
  const filtered = data.cases.filter(item => `${item.number} ${item.client} ${item.matter}`.toLowerCase().includes(filter.toLowerCase()));
  return <>
    <PageHeading eyebrow="SEGUIMIENTO PROCESAL" title="Expedientes" action={<Button variant="primary" onClick={() => openModal({ type: "case" })}>＋ Nuevo expediente</Button>}>
      <p className="muted">Cada expediente reúne sus pendientes y próximos pasos.</p>
    </PageHeading>
    <div className="toolbar"><input className="search-input" placeholder="Buscar número, cliente o asunto…" value={filter} onChange={event => setFilter(event.target.value)} /><span className="muted">{filtered.length} expedientes</span></div>
    {filtered.length ? <div className="case-grid">{filtered.map(item => {
      const tasks = data.tasks.filter(task => task.caseId === item.id && !task.done);
      return <article className="case-card" key={item.id}>
        <div className="case-card-top"><span className={`status-dot ${item.status === "concluido" ? "done" : ""}`}></span><span>{item.status === "concluido" ? "Concluido" : "Activo"}</span><button className="icon-button" onClick={() => openModal({ type: "case", item })}>···</button></div>
        <h2>{item.number}</h2><p>{item.matter || "Asunto sin descripción"}</p><div className="case-client">{item.client || "Cliente pendiente de captura"}</div>
        {item.court && <div className="case-court">⌂ {item.court}</div>}
        <div className="case-footer"><span>{tasks.length} pendiente{tasks.length === 1 ? "" : "s"}</span><Button onClick={() => openModal({ type: "task", item: { caseId: item.id } })}>＋ Pendiente</Button></div>
        {tasks.slice(0, 3).map(task => <div className="case-task" key={task.id}>
          <button className={`check ${task.done ? "checked" : ""}`} onClick={() => update("tasks", data.tasks.map(entry => entry.id === task.id ? { ...entry, done: !entry.done } : entry))}>{task.done ? "✓" : ""}</button>
          <span className={task.done ? "completed" : ""}>{task.title}</span>
          {task.dueAt && <small>{new Date(task.dueAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</small>}
          <button className="delete-task" title="Eliminar pendiente" onClick={() => update("tasks", data.tasks.filter(entry => entry.id !== task.id))}>×</button>
        </div>)}
      </article>;
    })}</div> : <div className="panel"><EmptyState title="Aún no hay expedientes" text="Registra un expediente y empieza a asociar pendientes." /></div>}
    <section className="panel tasks-panel">
      <div className="panel-heading"><div><div className="eyebrow">TODOS LOS ASUNTOS</div><h2>Pendientes por hacer</h2></div><Button onClick={() => openModal({ type: "task" })}>＋ Agregar pendiente</Button></div>
      {data.tasks.filter(task => !task.done).length ? data.tasks.filter(task => !task.done).map(task => {
        const caseItem = data.cases.find(entry => entry.id === task.caseId);
        return <div className="task-row" key={task.id}>
          <button className="check" onClick={() => update("tasks", data.tasks.map(entry => entry.id === task.id ? { ...entry, done: true } : entry))}></button>
          <div className="task-row-content"><b>{task.title}</b><span>{caseItem ? `Exp. ${caseItem.number}` : "Sin expediente vinculado"}{task.dueAt && ` · Vence ${formatDateTime(task.dueAt)}`}</span></div>
          <button className="text-button" onClick={() => openModal({ type: "task", item: task })}>Editar</button>
          <button className="danger-text" onClick={() => update("tasks", data.tasks.filter(entry => entry.id !== task.id))}>Eliminar</button>
        </div>;
      }) : <EmptyState title="Sin pendientes abiertos" text="Cuando registres una tarea, aparecerá en esta lista." />}
    </section>
  </>;
}

function Quotes({ data, openModal, update }) {
  const [preview, setPreview] = useState(null);
  return <>
    <PageHeading eyebrow="SERVICIOS PROFESIONALES" title="Cotizaciones" action={<Button variant="primary" onClick={() => openModal({ type: "quote" })}>＋ Nueva cotización</Button>}>
      <p className="muted">Desglosa honorarios por etapas y genera una propuesta lista para copiar.</p>
    </PageHeading>
    {preview && <QuotePreview quote={preview} onClose={() => setPreview(null)} />}
    <div className="quote-grid">{data.quotes.map(quote => <article className="quote-card" key={quote.id}>
      <div className="quote-card-top"><span className="quote-symbol">$</span><span className="quote-date">{new Date(quote.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}</span><button className="icon-button" onClick={() => update("quotes", data.quotes.filter(item => item.id !== quote.id))}>×</button></div>
      <h2>{quote.client}</h2><p>{quote.matter}</p>
      <div className="quote-total">{formatMoney(quoteTotal(quote))}<small>{quote.stages.length} etapa{quote.stages.length === 1 ? "" : "s"} · {quote.includeIva ? "IVA incluido" : "sin IVA"}</small></div>
      <Button variant="primary" onClick={() => setPreview(quote)}>Ver cotización</Button>
    </article>)}</div>
    {!data.quotes.length && <section className="panel"><EmptyState title="Aún no hay cotizaciones" text="Crea una propuesta de honorarios con etapas, total e IVA." /></section>}
  </>;
}

function AppointmentForm({ initial = {}, cases, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    title: "", type: "Audiencia", startsAt: toLocalDateTime(new Date(Date.now() + 3_600_000)),
    place: "", caseId: "", notes: "", reminderMinutes: 15, ...initial,
  }));
  const field = (key, value) => setForm(current => ({ ...current, [key]: value }));
  return <Modal title={initial.id ? "Editar actividad" : "Agendar actividad"} onClose={onClose}><form className="form-grid" onSubmit={event => { event.preventDefault(); onSave(form); }}>
    <Field label="Nombre *"><input required autoFocus value={form.title} onChange={event => field("title", event.target.value)} placeholder="Ej. Audiencia constitucional" /></Field>
    <div className="form-two"><Field label="Tipo"><select value={form.type} onChange={event => field("type", event.target.value)}>{APPOINTMENT_TYPES.map(type => <option key={type}>{type}</option>)}</select></Field><Field label="Fecha y hora *"><input required type="datetime-local" value={form.startsAt} onChange={event => field("startsAt", event.target.value)} /></Field></div>
    <Field label="Expediente vinculado"><select value={form.caseId} onChange={event => field("caseId", event.target.value)}><option value="">Sin expediente</option>{cases.map(item => <option key={item.id} value={item.id}>{item.number}</option>)}</select></Field>
    <Field label="Lugar o liga"><input value={form.place} onChange={event => field("place", event.target.value)} placeholder="Juzgado, sala o enlace" /></Field>
    <Field label="Aviso"><select value={form.reminderMinutes} onChange={event => field("reminderMinutes", event.target.value)}>{REMINDER_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
    <Field label="Notas"><textarea rows="3" value={form.notes} onChange={event => field("notes", event.target.value)} /></Field>
    <div className="form-actions"><Button type="button" onClick={onClose}>Cancelar</Button><Button type="submit" variant="primary">Guardar en agenda</Button></div>
  </form></Modal>;
}

function CaseForm({ initial = {}, onSave, onClose }) {
  const [form, setForm] = useState({ number: "", matter: "", client: "", court: "", status: "activo", ...initial });
  const field = (key, value) => setForm(current => ({ ...current, [key]: value }));
  return <Modal title={initial.id ? "Editar expediente" : "Nuevo expediente"} onClose={onClose}><form className="form-grid" onSubmit={event => { event.preventDefault(); onSave(form); }}>
    <Field label="Número o identificador *"><input required autoFocus value={form.number} onChange={event => field("number", event.target.value)} placeholder="Ej. 873/2026" /></Field>
    <Field label="Asunto"><input value={form.matter} onChange={event => field("matter", event.target.value)} placeholder="Amparo indirecto, alimentos…" /></Field>
    <Field label="Cliente / promovente"><input value={form.client} onChange={event => field("client", event.target.value)} /></Field>
    <Field label="Juzgado / autoridad"><input value={form.court} onChange={event => field("court", event.target.value)} /></Field>
    <Field label="Estado"><select value={form.status} onChange={event => field("status", event.target.value)}><option value="activo">Activo</option><option value="concluido">Concluido</option></select></Field>
    <div className="form-actions"><Button type="button" onClick={onClose}>Cancelar</Button><Button type="submit" variant="primary">Guardar expediente</Button></div>
  </form></Modal>;
}

function TaskForm({ initial = {}, cases, onSave, onClose }) {
  const [form, setForm] = useState(() => ({ title: "", caseId: "", dueAt: "", reminderMinutes: 0, notes: "", ...initial }));
  const field = (key, value) => setForm(current => ({ ...current, [key]: value }));
  return <Modal title={initial.id ? "Editar pendiente" : "Agregar pendiente"} onClose={onClose}><form className="form-grid" onSubmit={event => { event.preventDefault(); onSave(form); }}>
    <Field label="Qué hay que hacer *"><input required autoFocus value={form.title} onChange={event => field("title", event.target.value)} placeholder="Ej. Preparar promoción de pruebas" /></Field>
    <Field label="Expediente"><select value={form.caseId} onChange={event => field("caseId", event.target.value)}><option value="">Sin expediente</option>{cases.map(item => <option key={item.id} value={item.id}>{item.number} · {item.matter}</option>)}</select></Field>
    <div className="form-two"><Field label="Fecha límite"><input type="datetime-local" value={form.dueAt} onChange={event => field("dueAt", event.target.value)} /></Field><Field label="Aviso"><select value={form.reminderMinutes} onChange={event => field("reminderMinutes", event.target.value)}>{REMINDER_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field></div>
    <Field label="Notas"><textarea rows="3" value={form.notes} onChange={event => field("notes", event.target.value)} /></Field>
    <div className="form-actions"><Button type="button" onClick={onClose}>Cancelar</Button><Button type="submit" variant="primary">Guardar pendiente</Button></div>
  </form></Modal>;
}

function QuoteForm({ initial = {}, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    client: "", matter: "", reference: "", includeIva: true,
    stages: [{ description: "Elaboración y presentación de la demanda", amount: "" }],
    ...initial,
  }));
  const setField = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const subtotal = form.stages.reduce((total, stage) => total + (Number(stage.amount) || 0), 0);
  const total = subtotal * (form.includeIva ? 1.16 : 1);
  return <Modal title={initial.id ? "Editar cotización" : "Nueva cotización"} onClose={onClose}><form className="form-grid" onSubmit={event => { event.preventDefault(); onSave(form); }}>
    <Field label="Cliente *"><input required autoFocus value={form.client} onChange={event => setField("client", event.target.value)} /></Field>
    <Field label="Asunto / servicio *"><input required value={form.matter} onChange={event => setField("matter", event.target.value)} placeholder="Ej. Juicio oral de alimentos" /></Field>
    <Field label="Referencia"><input value={form.reference} onChange={event => setField("reference", event.target.value)} placeholder="Folio o asunto" /></Field>
    <div className="field"><span>ETAPAS Y HONORARIOS</span>
      {form.stages.map((stage, index) => <div className="stage-input" key={index}>
        <input aria-label={`Descripción etapa ${index + 1}`} value={stage.description} onChange={event => setField("stages", form.stages.map((item, i) => i === index ? { ...item, description: event.target.value } : item))} placeholder="Descripción de la etapa" />
        <input aria-label={`Monto etapa ${index + 1}`} type="number" min="0" max="999999999.99" step="0.01" value={stage.amount} onChange={event => setField("stages", form.stages.map((item, i) => i === index ? { ...item, amount: event.target.value } : item))} placeholder="$" />
        <button type="button" className="icon-button" aria-label="Eliminar etapa" onClick={() => setField("stages", form.stages.filter((_, i) => i !== index))}>×</button>
      </div>)}
      <button type="button" className="text-button add-stage" onClick={() => setField("stages", [...form.stages, { description: "", amount: "" }])}>＋ Agregar etapa</button>
    </div>
    <label className="checkbox-field"><input type="checkbox" checked={form.includeIva} onChange={event => setField("includeIva", event.target.checked)} /> Calcular IVA (16%)</label>
    <div className="quote-form-total"><span>{form.includeIva ? "Total con IVA" : "Total"}</span><b>{Number.isFinite(total) && total <= 999_999_999.99 ? formatMoney(Math.max(0, total)) : "Importe fuera de rango"}</b></div>
    <div className="form-actions"><Button type="button" onClick={onClose}>Cancelar</Button><Button type="submit" variant="primary">Guardar y generar</Button></div>
  </form></Modal>;
}

function QuotePreview({ quote, onClose }) {
  const text = quoteText(quote, PROFILE);
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { setCopied(false); }
  }
  return <Modal title="Vista previa de cotización" onClose={onClose}>
    <div className="preview-toolbar"><span>Total: <b>{formatMoney(quoteTotal(quote))}</b></span><Button variant="primary" onClick={copy}>{copied ? "✓ Copiada" : "Copiar texto"}</Button></div>
    <pre className="quote-preview">{text}</pre>
    <p className="fine-print">Revisa el alcance, los importes, el tratamiento fiscal y las condiciones antes de enviar la propuesta.</p>
  </Modal>;
}

function EmptyState({ title, text }) {
  return <div className="empty-state"><div className="empty-icon">✳</div><b>{title}</b><p>{text}</p></div>;
}

export default App;
