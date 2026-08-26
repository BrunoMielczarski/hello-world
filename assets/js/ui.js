const numberFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const moneyFormat = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export const num = (value) => numberFormat.format(Number(value) || 0);
export const money = (value) => moneyFormat.format(Number(value) || 0);
export const datetime = (iso) => (iso ? dateFormat.format(new Date(iso)) : "—");

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

let toastTimer = null;
export function toast(message, type = "info") {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.toggle("error", type === "error");
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 3600);
}

export function errorMessage(error, fallback = "Ocorreu um erro inesperado.") {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function reportError(error, fallback) {
  console.error(error);
  toast(errorMessage(error, fallback), "error");
}

export function statusTag(status) {
  const map = {
    aberta: ["tag-warn", "Aberta"],
    produzida: ["tag-ok", "Produzida"],
    cancelada: ["tag-danger", "Cancelada"],
  };
  const [cls, label] = map[status] || ["tag-navy", status];
  return `<span class="tag ${cls}">${label}</span>`;
}

export function stockTag(material) {
  if (material.stock <= 0) return `<span class="tag tag-danger">Sem estoque</span>`;
  if (material.minStock > 0 && material.stock < material.minStock)
    return `<span class="tag tag-warn">Abaixo do mínimo</span>`;
  return `<span class="tag tag-ok">Disponível</span>`;
}

export const formValues = (form) => Object.fromEntries(new FormData(form).entries());
