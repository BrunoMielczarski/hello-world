import { addEntry, getMaterial, listEntries, listMaterials } from "../store.js";
import { datetime, escapeHtml, formValues, num, stockTag, toast } from "../ui.js";

export const title = "Entrada de Materiais";
export const subtitle =
  "Registre compras posteriores, reponha o estoque e corrija lançamentos errados";

let search = "";
let selectedId = null;
let movement = "entrada";

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
    return '<section class="card"><h3>Lançar movimento</h3><p class="empty">Busque e selecione um material na lista abaixo.</p></section>';
  }
  return `
    <section class="card">
      <h3>Lançar movimento · ${escapeHtml(material.code)} — ${escapeHtml(material.name)}</h3>
      <p class="card-sub">Estoque atual: <strong>${num(material.stock)} ${escapeHtml(material.unit)}</strong></p>
      <form id="entry-form">
        <div class="form-grid">
          <label>Tipo de movimento
            <select name="type" id="entry-type">
              <option value="entrada" ${movement === "entrada" ? "selected" : ""}>Entrada (somar ao estoque)</option>
              <option value="saida" ${movement === "saida" ? "selected" : ""}>Saída / correção (remover do estoque)</option>
            </select>
          </label>
          <label>${movement === "saida" ? "Quantidade a remover" : "Quantidade a adicionar"}
            <input name="qty" type="number" min="0.001" step="0.001" ${
              movement === "saida" ? `max="${material.stock}"` : ""
            } required autofocus />
          </label>
          <label>Documento / NF
            <input name="document" placeholder="${movement === "saida" ? "Ex.: correção de lançamento" : "NF 1234"}" />
          </label>
          <label>Fornecedor
            <input name="supplier" value="${escapeHtml(material.supplier)}" />
          </label>
          <label>Observação
            <input name="note" placeholder="Opcional" />
          </label>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">${
            movement === "saida" ? "Remover do estoque" : "Adicionar ao estoque"
          }</button>
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
      const out = entry.type === "saida";
      return `
        <tr>
          <td>${datetime(entry.date)}</td>
          <td><strong>${escapeHtml(material?.code ?? "—")}</strong> ${escapeHtml(material?.name ?? "")}</td>
          <td><span class="tag ${out ? "tag-danger" : "tag-ok"}">${out ? "Saída" : "Entrada"}</span></td>
          <td class="num">${out ? "−" : "+"}${num(entry.qty)} ${escapeHtml(material?.unit ?? "")}</td>
          <td>${escapeHtml(entry.document || "—")}</td>
          <td>${escapeHtml(entry.supplier || "—")}</td>
        </tr>`;
    })
    .join("");
  return `
    <section class="card">
      <h3>Últimos movimentos</h3>
      <p class="card-sub">Histórico de reposição e correções de estoque</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Data</th><th>Material</th><th>Tipo</th><th class="num">Qtd</th><th>Documento</th><th>Fornecedor</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" class="empty">Nenhum movimento registrado.</td></tr>'}</tbody>
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
      selectedId = btn.dataset.select;
      render(container, rerender);
      window.scrollTo({ top: 0, behavior: "smooth" });
    })
  );

  const form = container.querySelector("#entry-form");
  container.querySelector("#entry-type")?.addEventListener("change", (event) => {
    movement = event.target.value;
    render(container, rerender);
  });
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = formValues(form);
    try {
      addEntry({ materialId: selectedId, ...values });
      toast(values.type === "saida" ? "Saída registrada e estoque corrigido." : "Estoque atualizado com a entrada.");
      render(container, rerender);
    } catch (err) {
      toast(err.message, "error");
    }
  });
  form?.querySelector("[data-clear]")?.addEventListener("click", () => {
    selectedId = null;
    render(container, rerender);
  });
}
