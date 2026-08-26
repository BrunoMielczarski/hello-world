import { initStore, isRemote, seedDemoData, watchRemote } from "./store.js";
import { toast } from "./ui.js";
import * as dashboard from "./views/dashboard.js";
import * as materials from "./views/materials.js";
import * as structures from "./views/structures.js";
import * as entries from "./views/entries.js";
import * as orders from "./views/orders.js";

const CREDENTIALS = { user: "Protus", password: "Protus@4040" };
const SESSION_KEY = "protus.session";

const views = { dashboard, materials, structures, entries, orders };
let currentView = "dashboard";

const el = (id) => document.getElementById(id);

function renderView() {
  const view = views[currentView];
  el("view-title").textContent = view.title;
  el("view-sub").textContent = view.subtitle;
  el("views").innerHTML = "";
  view.render(el("views"), renderView);
}

function selectView(name) {
  currentView = name;
  document.querySelectorAll(".nav-item").forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.view === name)
  );
  if (name !== "structures") structures.resetDraft();
  if (name !== "orders") orders.resetPlanner();
  renderView();
  window.scrollTo({ top: 0 });
}

function showApp(username) {
  el("login-screen").classList.add("hidden");
  el("app").classList.remove("hidden");
  el("session-user").textContent = username;
  selectView("dashboard");
}

function showLogin() {
  el("app").classList.add("hidden");
  el("login-screen").classList.remove("hidden");
  el("login-form").reset();
}

el("login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const user = el("login-user").value.trim();
  const password = el("login-pass").value;
  if (user.toLowerCase() !== CREDENTIALS.user.toLowerCase() || password !== CREDENTIALS.password) {
    el("login-error").classList.remove("hidden");
    return;
  }
  el("login-error").classList.add("hidden");
  sessionStorage.setItem(SESSION_KEY, CREDENTIALS.user);
  showApp(CREDENTIALS.user);
});

el("logout").addEventListener("click", () => {
  sessionStorage.removeItem(SESSION_KEY);
  showLogin();
});

document.querySelectorAll(".nav-item").forEach((btn) =>
  btn.addEventListener("click", () => selectView(btn.dataset.view))
);

el("seed-demo").addEventListener("click", () => {
  if (!confirm("Substituir os dados atuais por um conjunto de exemplo?")) return;
  seedDemoData();
  toast("Dados de exemplo carregados.");
  selectView("dashboard");
});

function showStorageMode() {
  const label = el("storage-mode");
  if (!label) return;
  label.textContent = isRemote()
    ? "Servidor compartilhado"
    : "Dados apenas neste navegador";
  label.classList.toggle("tag-ok", isRemote());
  label.classList.toggle("tag-warn", !isRemote());
}

async function bootstrap() {
  await initStore();
  showStorageMode();
  watchRemote(() => {
    if (!el("app").classList.contains("hidden")) renderView();
  });
  const session = sessionStorage.getItem(SESSION_KEY);
  if (session) showApp(session);
  else showLogin();
}

bootstrap();
