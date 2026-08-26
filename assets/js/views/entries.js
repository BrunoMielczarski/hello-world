import { addEntry, getMaterial, listEntries, listMaterials } from "../store.js";
import { datetime, escapeHtml, formValues, num, reportError, stockTag, toast } from "../ui.js";

export const title = "Entrada de Materiais";
export const subtitle = "Registre compras posteriores e reponha o estoque de qualquer material";

let search = "";
let selectedId = null;

function resultRows() {
  const term = search.trim().toLowerCase();
  const materials = listMaterials().filter(
    (m) => !term || m.name.toLowerCase().includes(term) || m.code.toLowerCase().includes(term)
  );
  if (!materials.length) return '<tr><td colspan="5" class="empty">Nenhum material encontrado.</td></tr>';
  return materials
    .map(
      (m) => `
      <tr ${m.id === selectedId ? 'style="background:var(--orange-soft)"' : ""}>
        <td><strong>${escapeHtml(m.code)}</strong></td>
        <td>${escapeHtml(m.name)}</td>
        <td class="num">${num(m.stock)} ${escapeHtml(m.unit)}</td>
        <td>${stockTag(m)}</td>
        <td><div class="row-actions"><button class="btn btn-primary btn-sm" data-select="${m.id}">Selecionar</button></div></td>
      </tr>`
    )
    .join("");
}

function entryForm() {
  const material = selectedId ? getMaterial(selectedId) : null;
  if (!material) {
    return '<section class="card"><h3>Lançar entrada</h3><p class="empty">Busque e selecione um material na lista abaixo.</p></section>';
  }
  return `
    <section class="card">
      <h3>Lançar entrada · ${escapeHtml(material.code)} — ${escapeHtml(material.name)}</h3>
      <p class="card-sub">Estoque atual: <strong>${num(material.stock)} ${escapeHtml(material.unit)}</strong></p>
      <form id="entry-form">
        <div class="form-grid">
          <label>Quantidade a adicionar
            <input name="qty" type="number" min="0.001" step="0.001" required autofocus />
          </label>
          <label>Documento / NF
            <input name="document" placeholder="NF 1234" />
          </label>
          <label>Fornecedor
            <input name="supplier" value="${escapeHtml(material.supplier)}" />
          </label>
          <label>Observação
            <input name="note" placeholder="Opcional" />
          </label>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">Adicionar ao estoque</button>
          <button class="btn btn-ghost" type="button" data-clear>Trocar material</button>
        </div>
      </form>
    </section>`;
}

function historyCard() {
  const entries = listEntries().slice(0, 25);
  const rows = entries
    .map((entry) => {
      const material = getMaterial(entry.materialId);
      return `
        <tr>
          <td>${datetime(entry.date)}</td>
          <td><strong>${escapeHtml(material?.code ?? "—")}</strong> ${escapeHtml(material?.name ?? "")}</td>
          <td class="num">+${num(entry.qty)} ${escapeHtml(material?.unit ?? "")}</td>
          <td>${escapeHtml(entry.document || "—")}</td>
          <td>${escapeHtml(entry.supplier || "—")}</td>
        </tr>`;
    })
    .join("");
  return `
    <section class="card">
      <h3>Últimas entradas</h3>
      <p class="card-sub">Histórico de reposição de estoque</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Data</th><th>Material</th><th class="num">Qtd</th><th>Documento</th><th>Fornecedor</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="empty">Nenhuma entrada registrada.</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;
}

export function render(container, rerender) {
  container.innerHTML = `
    ${entryForm()}
    <section class="card">
      <h3>Buscar materiais cadastrados</h3>
      <p class="card-sub">Selecione o item para adicionar quantidades</p>
      <label style="max-width:340px">Buscar
        <input id="entry-search" value="${escapeHtml(search)}" placeholder="Código ou descrição" />
      </label>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Código</th><th>Material</th><th class="num">Estoque</th><th>Situação</th><th></th></tr></thead>
          <tbody>${resultRows()}</tbody>
        </table>
      </div>
    </section>
    ${historyCard()}`;

  const searchInput = container.querySelector("#entry-search");
  searchInput.addEventListener("input", () => {
    search = searchInput.value;
    render(container, rerender);
    const fresh = container.querySelector("#entry-search");
    fresh.focus();
    fresh.setSelectionRange(search.length, search.length);
  });

  container.querySelectorAll("[data-select]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const material = getMaterial(btn.dataset.select);
      if (!material) {
        reportError(new Error("Material não encontrado."));
        return;
      }
      selectedId = material.id;
      render(container, rerender);
      window.scrollTo({ top: 0, behavior: "smooth" });
    })
  );

  const form = container.querySelector("#entry-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      addEntry({ materialId: selectedId, ...formValues(form) });
      toast("Estoque atualizado com a entrada.");
      render(container, rerender);
    } catch (error) {
      reportError(error, "Não foi possível registrar a entrada.");
    }
  });
  form?.querySelector("[data-clear]")?.addEventListener("click", () => {
    selectedId = null;
    render(container, rerender);
  });
}
