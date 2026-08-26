import { listMaterials, saveMaterial, deleteMaterial, getMaterial } from "../store.js";
import { escapeHtml, formValues, money, num, stockTag, toast } from "../ui.js";

export const title = "Cadastro de Materiais";
export const subtitle = "Itens que compõem as estruturas do robô, com estoque inicial";

let editingId = null;

function formCard() {
  const material = editingId ? getMaterial(editingId) : null;
  return `
    <section class="card">
      <h3>${material ? "Editar material" : "Novo material"}</h3>
      <p class="card-sub">O estoque informado aqui é lançado como estoque inicial. Compras posteriores devem ser registradas na aba Entrada de Materiais.</p>
      <form id="material-form">
        <div class="form-grid">
          <label>Código
            <input name="code" required value="${escapeHtml(material?.code ?? "")}" placeholder="MT-001" />
          </label>
          <label>Descrição
            <input name="name" required value="${escapeHtml(material?.name ?? "")}" placeholder="Display touch 21&quot;" />
          </label>
          <label>Unidade
            <input name="unit" value="${escapeHtml(material?.unit ?? "UN")}" placeholder="UN" />
          </label>
          <label>Estoque ${material ? "atual (ajuste por entrada)" : "inicial"}
            <input name="stock" type="number" min="0" step="0.001" value="${material ? material.stock : 0}" ${material ? "disabled" : ""} />
          </label>
          <label>Estoque mínimo
            <input name="minStock" type="number" min="0" step="0.001" value="${material?.minStock ?? 0}" />
          </label>
          <label>Custo unitário (R$)
            <input name="cost" type="number" min="0" step="0.01" value="${material?.cost ?? 0}" />
          </label>
          <label>Fornecedor
            <input name="supplier" value="${escapeHtml(material?.supplier ?? "")}" placeholder="Opcional" />
          </label>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">${material ? "Salvar alterações" : "Cadastrar material"}</button>
          ${material ? '<button class="btn btn-ghost" type="button" data-cancel>Cancelar</button>' : ""}
        </div>
      </form>
    </section>`;
}

function tableCard(search) {
  const term = (search || "").toLowerCase();
  const materials = listMaterials().filter(
    (m) => !term || m.name.toLowerCase().includes(term) || m.code.toLowerCase().includes(term)
  );

  const rows = materials
    .map(
      (m) => `
      <tr>
        <td><strong>${escapeHtml(m.code)}</strong></td>
        <td>${escapeHtml(m.name)}</td>
        <td>${escapeHtml(m.unit)}</td>
        <td class="num">${num(m.stock)}</td>
        <td class="num">${num(m.minStock)}</td>
        <td class="num">${money(m.cost)}</td>
        <td>${stockTag(m)}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost btn-sm" data-edit="${m.id}">Editar</button>
            <button class="btn btn-danger btn-sm" data-delete="${m.id}">Excluir</button>
          </div>
        </td>
      </tr>`
    )
    .join("");

  return `
    <section class="card">
      <h3>Materiais cadastrados</h3>
      <p class="card-sub">${materials.length} item(ns)</p>
      <label style="max-width:320px">Buscar
        <input id="material-search" value="${escapeHtml(search || "")}" placeholder="Código ou descrição" />
      </label>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Código</th><th>Descrição</th><th>Un.</th>
              <th class="num">Estoque</th><th class="num">Mínimo</th><th class="num">Custo</th>
              <th>Situação</th><th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${materials.length ? "" : '<p class="empty">Nenhum material encontrado.</p>'}
    </section>`;
}

export function render(container, rerender, search = "") {
  container.innerHTML = formCard() + tableCard(search);

  const form = container.querySelector("#material-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      saveMaterial({ id: editingId, ...formValues(form) });
      toast(editingId ? "Material atualizado." : "Material cadastrado com estoque inicial.");
      editingId = null;
      rerender();
    } catch (err) {
      toast(err.message, "error");
    }
  });

  form.querySelector("[data-cancel]")?.addEventListener("click", () => {
    editingId = null;
    rerender();
  });

  container.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => {
      editingId = btn.dataset.edit;
      rerender();
      window.scrollTo({ top: 0, behavior: "smooth" });
    })
  );

  container.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const material = getMaterial(btn.dataset.delete);
      if (!material || !confirm(`Excluir o material ${material.code} - ${material.name}?`)) return;
      try {
        deleteMaterial(material.id);
        toast("Material excluído.");
        if (editingId === material.id) editingId = null;
        rerender();
      } catch (err) {
        toast(err.message, "error");
      }
    })
  );

  const searchInput = container.querySelector("#material-search");
  searchInput.addEventListener("input", () => {
    const value = searchInput.value;
    render(container, rerender, value);
    const fresh = container.querySelector("#material-search");
    fresh.focus();
    fresh.setSelectionRange(value.length, value.length);
  });
}
