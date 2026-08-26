import { listMaterials, listStructures, saveStructure, deleteStructure, getStructure, getMaterial } from "../store.js";
import { escapeHtml, money, num, reportError, toast } from "../ui.js";

export const title = "Cadastro de Estrutura";
export const subtitle = "Monte conjuntos como Cabeça, Corpo e Base com os materiais cadastrados";

let editingId = null;
let draftItems = [];

function materialOptions(selected) {
  return listMaterials()
    .map(
      (m) =>
        `<option value="${m.id}" ${m.id === selected ? "selected" : ""}>${escapeHtml(`${m.code} · ${m.name}`)}</option>`
    )
    .join("");
}

function draftRows() {
  if (!draftItems.length) return '<tr><td colspan="5" class="empty">Nenhum item adicionado.</td></tr>';
  return draftItems
    .map((item, index) => {
      const material = getMaterial(item.materialId);
      return `
        <tr>
          <td><strong>${escapeHtml(material?.code ?? "—")}</strong></td>
          <td>${escapeHtml(material?.name ?? "Material removido")}</td>
          <td>${escapeHtml(material?.unit ?? "UN")}</td>
          <td class="num">${num(item.qty)}</td>
          <td><div class="row-actions"><button class="btn btn-danger btn-sm" data-remove="${index}">Remover</button></div></td>
        </tr>`;
    })
    .join("");
}

function formCard() {
  const structure = editingId ? getStructure(editingId) : null;
  const hasMaterials = listMaterials().length > 0;
  return `
    <section class="card">
      <h3>${structure ? `Editar estrutura ${escapeHtml(structure.name)}` : "Nova estrutura"}</h3>
      <p class="card-sub">Cada estrutura agrupa vários materiais e a quantidade usada por robô.</p>
      ${hasMaterials ? "" : '<p class="empty">Cadastre materiais antes de criar estruturas.</p>'}
      <form id="structure-form">
        <div class="form-grid">
          <label>Nome da estrutura
            <input name="name" required value="${escapeHtml(structure?.name ?? "")}" placeholder="Cabeça" />
          </label>
          <label>Descrição
            <input name="description" value="${escapeHtml(structure?.description ?? "")}" placeholder="Opcional" />
          </label>
        </div>

        <h3 style="margin-top:18px">Itens da estrutura</h3>
        <div class="form-grid">
          <label>Material
            <select id="item-material" ${hasMaterials ? "" : "disabled"}>${materialOptions()}</select>
          </label>
          <label>Quantidade por robô
            <input id="item-qty" type="number" min="0.001" step="0.001" value="1" ${hasMaterials ? "" : "disabled"} />
          </label>
          <label>&nbsp;
            <button class="btn btn-navy" type="button" id="add-item" ${hasMaterials ? "" : "disabled"}>Adicionar item</button>
          </label>
        </div>

        <div class="table-wrap" style="margin-top:10px">
          <table>
            <thead><tr><th>Código</th><th>Material</th><th>Un.</th><th class="num">Qtd/robô</th><th></th></tr></thead>
            <tbody>${draftRows()}</tbody>
          </table>
        </div>

        <div class="form-actions">
          <button class="btn btn-primary" type="submit">${structure ? "Salvar estrutura" : "Cadastrar estrutura"}</button>
          ${structure ? '<button class="btn btn-ghost" type="button" data-cancel>Cancelar</button>' : ""}
        </div>
      </form>
    </section>`;
}

function listCard() {
  const structures = listStructures();
  if (!structures.length) {
    return '<section class="card"><h3>Estruturas cadastradas</h3><p class="empty">Nenhuma estrutura cadastrada.</p></section>';
  }

  return structures
    .map((structure) => {
      const rows = structure.items
        .map((item) => {
          const material = getMaterial(item.materialId);
          return `
            <tr>
              <td><strong>${escapeHtml(material?.code ?? "—")}</strong></td>
              <td>${escapeHtml(material?.name ?? "Material removido")}</td>
              <td class="num">${num(item.qty)} ${escapeHtml(material?.unit ?? "")}</td>
              <td class="num">${num(material?.stock ?? 0)}</td>
              <td class="num">${money((material?.cost ?? 0) * item.qty)}</td>
            </tr>`;
        })
        .join("");
      const cost = structure.items.reduce(
        (sum, item) => sum + (getMaterial(item.materialId)?.cost ?? 0) * item.qty,
        0
      );
      return `
        <section class="card">
          <div class="topbar" style="margin-bottom:12px">
            <div>
              <h3>${escapeHtml(structure.name)}</h3>
              <p class="card-sub" style="margin:2px 0 0">${escapeHtml(structure.description || "Sem descrição")} · ${structure.items.length} item(ns) · custo ${money(cost)}/robô</p>
            </div>
            <div class="row-actions">
              <button class="btn btn-ghost btn-sm" data-edit="${structure.id}">Editar</button>
              <button class="btn btn-danger btn-sm" data-delete="${structure.id}">Excluir</button>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Código</th><th>Material</th><th class="num">Qtd/robô</th><th class="num">Estoque</th><th class="num">Custo</th></tr></thead>
              <tbody>${rows || '<tr><td colspan="5" class="empty">Estrutura sem itens.</td></tr>'}</tbody>
            </table>
          </div>
        </section>`;
    })
    .join("");
}

export function render(container, rerender) {
  container.innerHTML = formCard() + listCard();

  const form = container.querySelector("#structure-form");
  const materialSelect = container.querySelector("#item-material");
  const qtyInput = container.querySelector("#item-qty");

  container.querySelector("#add-item")?.addEventListener("click", () => {
    const materialId = materialSelect.value;
    const qty = Number(qtyInput.value);
    if (!materialId || !(qty > 0)) {
      toast("Selecione um material e uma quantidade válida.", "error");
      return;
    }
    const existing = draftItems.find((i) => i.materialId === materialId);
    if (existing) existing.qty = Number((existing.qty + qty).toFixed(4));
    else draftItems.push({ materialId, qty });
    const values = new FormData(form);
    const keep = { name: values.get("name"), description: values.get("description") };
    render(container, rerender);
    const fresh = container.querySelector("#structure-form");
    fresh.name.value = keep.name || "";
    fresh.description.value = keep.description || "";
  });

  container.querySelectorAll("[data-remove]").forEach((btn) =>
    btn.addEventListener("click", () => {
      draftItems.splice(Number(btn.dataset.remove), 1);
      const values = new FormData(form);
      const keep = { name: values.get("name"), description: values.get("description") };
      render(container, rerender);
      const fresh = container.querySelector("#structure-form");
      fresh.name.value = keep.name || "";
      fresh.description.value = keep.description || "";
    })
  );

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = new FormData(form);
    if (!draftItems.length) {
      toast("Adicione ao menos um item à estrutura.", "error");
      return;
    }
    try {
      saveStructure({
        id: editingId,
        name: values.get("name"),
        description: values.get("description"),
        items: draftItems,
      });
      toast(editingId ? "Estrutura atualizada." : "Estrutura cadastrada.");
      editingId = null;
      draftItems = [];
      rerender();
    } catch (error) {
      reportError(error, "Não foi possível salvar a estrutura.");
    }
  });

  form.querySelector("[data-cancel]")?.addEventListener("click", () => {
    editingId = null;
    draftItems = [];
    rerender();
  });

  container.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const structure = getStructure(btn.dataset.edit);
      if (!structure) {
        reportError(new Error("Estrutura não encontrada."));
        return;
      }
      editingId = structure.id;
      draftItems = structure.items.map((item) => ({ ...item }));
      rerender();
      window.scrollTo({ top: 0, behavior: "smooth" });
    })
  );

  container.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const structure = getStructure(btn.dataset.delete);
      if (!structure) {
        reportError(new Error("Estrutura não encontrada."));
        return;
      }
      if (!confirm(`Excluir a estrutura ${structure.name}?`)) return;
      try {
        deleteStructure(structure.id);
        if (editingId === structure.id) {
          editingId = null;
          draftItems = [];
        }
        toast("Estrutura excluída.");
        rerender();
      } catch (error) {
        reportError(error, "Não foi possível excluir a estrutura.");
      }
    })
  );
}

export function resetDraft() {
  editingId = null;
  draftItems = [];
}
