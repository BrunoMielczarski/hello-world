import { initializeStore, seedDemoData } from "./store.js";
import { errorMessage, reportError, toast } from "./ui.js";
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
  const container = el("views");

  try {
    if (!view) throw new Error(`Tela não encontrada: ${currentView}.`);
    el("view-title").textContent = view.title;
    el("view-sub").textContent = view.subtitle;
    container.innerHTML = "";
    view.render(container, renderView);
  } catch (error) {
    container.innerHTML =
      '<section class="card"><h3>Não foi possível carregar esta tela</h3><p class="empty"></p></section>';
    container.querySelector("p").textContent = errorMessage(
      error,
      "Atualize a página e tente novamente.",
    );
    reportError(error, "Não foi possível carregar esta tela.");
  }
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
  el("login-error").classList.add("hidden");
}

function handleLogin(event) {
  event.preventDefault();
  const user = el("login-user").value.trim();
  const password = el("login-pass").value;
  if (user.toLowerCase() !== CREDENTIALS.user.toLowerCase() || password !== CREDENTIALS.password) {
    el("login-error").classList.remove("hidden");
    return;
  }
  try {
    el("login-error").classList.add("hidden");
    sessionStorage.setItem(SESSION_KEY, CREDENTIALS.user);
    showApp(CREDENTIALS.user);
  } catch (error) {
    reportError(new Error("Não foi possível iniciar a sessão no navegador.", { cause: error }));
  }
}

function handleLogout() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    showLogin();
  } catch (error) {
    reportError(new Error("Não foi possível encerrar a sessão no navegador.", { cause: error }));
  }
}

function initializeApp() {
  el("login-form").addEventListener("submit", handleLogin);
  el("logout").addEventListener("click", handleLogout);

  document.querySelectorAll(".nav-item").forEach((btn) =>
    btn.addEventListener("click", () => selectView(btn.dataset.view))
  );

  el("seed-demo").addEventListener("click", () => {
    if (!confirm("Substituir os dados atuais por um conjunto de exemplo?")) return;
    try {
      seedDemoData();
      toast("Dados de exemplo carregados.");
      selectView("dashboard");
    } catch (error) {
      reportError(error, "Não foi possível carregar os dados de exemplo.");
    }
  });

  let session;
  try {
    session = sessionStorage.getItem(SESSION_KEY);
  } catch (error) {
    throw new Error("Não foi possível acessar a sessão salva no navegador.", { cause: error });
  }
  if (session) showApp(session);
  else showLogin();
}

function reportStartupError(error) {
  console.error(error);
  el("app").classList.add("hidden");
  el("login-screen").classList.remove("hidden");
  const message = el("login-error");
  message.textContent = errorMessage(error, "Não foi possível iniciar a aplicação.");
  message.classList.remove("hidden");
  Array.from(el("login-form").elements).forEach((element) => {
    element.disabled = true;
  });
}

try {
  initializeStore();
  initializeApp();
} catch (error) {
  reportStartupError(error);
}
