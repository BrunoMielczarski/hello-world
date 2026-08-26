import {
  calculateBom,
  cancelOrder,
  createOrder,
  getOrder,
  getStructure,
  listOrders,
  listStructures,
  produceOrder,
} from "../store.js";
import { datetime, escapeHtml, money, num, reportError, statusTag, toast } from "../ui.js";

export const title = "Ordem de Produção";
export const subtitle = "Consulta a estrutura, confere o estoque item a item e gera a B.O.M.";

let selectedStructures = [];
let quantity = 1;
let simulation = null;
let expandedOrderId = null;

function bomTable(lines) {
  const rows = lines
    .map(
      (line) => `
      <tr>
        <td><strong>${escapeHtml(line.code)}</strong></td>
        <td>${escapeHtml(line.name)}<br /><small style="color:var(--muted)">${escapeHtml(line.structures)}</small></td>
        <td class="num">${num(line.required)} ${escapeHtml(line.unit)}</td>
        <td class="num">${num(line.stock)}</td>
        <td class="num">${num(line.fromStock)}</td>
        <td class="num">${line.toBuy > 0 ? `<strong style="color:var(--danger)">${num(line.toBuy)}</strong>` : "0"}</td>
        <td class="num">${line.toBuy > 0 ? money(line.toBuy * line.cost) : "—"}</td>
        <td>${
          line.toBuy > 0
            ? '<span class="tag tag-danger">Comprar</span>'
            : '<span class="tag tag-ok">Em estoque</span>'
        }</td>
      </tr>`
    )
    .join("");

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Código</th><th>Material / estrutura</th>
            <th class="num">Necessário</th><th class="num">Estoque</th>
            <th class="num">Atende do estoque</th><th class="num">Comprar</th>
            <th class="num">Custo da compra</th><th>Situação</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="8" class="empty">Sem itens.</td></tr>'}</tbody>
      </table>
    </div>`;
}

function bomCsv(lines) {
  const header = ["Codigo", "Material", "Estruturas", "Unidade", "Necessario", "Estoque", "AtendeDoEstoque", "Comprar", "CustoCompra"];
  const body = lines.map((l) =>
    [l.code, l.name, l.structures, l.unit, l.required, l.stock, l.fromStock, l.toBuy, (l.toBuy * l.cost).toFixed(2)]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(";")
  );
  return [header.join(";"), ...body].join("\n");
}

function downloadCsv(filename, content) {
  let objectUrl;
  try {
    const blob = new Blob([`\ufeff${content}`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = filename;
    link.click();
  } catch (error) {
    throw new Error(`Não foi possível exportar ${filename}.`, { cause: error });
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

function plannerCard() {
  const structures = listStructures();
  if (!structures.length) {
    return '<section class="card"><h3>Nova ordem de produção</h3><p class="empty">Cadastre estruturas antes de abrir uma ordem.</p></section>';
  }

  const pills = structures
    .map(
      (s) =>
        `<button type="button" class="pill ${selectedStructures.includes(s.id) ? "selected" : ""}" data-structure="${s.id}">${escapeHtml(s.name)} · ${s.items.length} itens</button>`
    )
    .join("");

  const summary = simulation
    ? `
      <div class="bom-total">
        <div><span>Robôs</span><strong>${num(simulation.quantity)}</strong></div>
        <div><span>Itens na B.O.M.</span><strong>${simulation.lines.length}</strong></div>
        <div><span>Itens a comprar</span><strong style="color:${simulation.shortageCount ? "var(--danger)" : "var(--ok)"}">${simulation.shortageCount}</strong></div>
        <div><span>Consumo do estoque</span><strong>${money(simulation.stockCost)}</strong></div>
        <div><span>Compra necessária</span><strong>${money(simulation.purchaseCost)}</strong></div>
      </div>
      ${
        simulation.complete
          ? '<p class="card-sub" style="color:var(--ok);font-weight:600">Estoque suficiente para produzir toda a ordem.</p>'
          : '<p class="card-sub" style="color:var(--danger);font-weight:600">Estoque insuficiente: veja abaixo o que deve ser comprado.</p>'
      }
      ${bomTable(simulation.lines)}
      <div class="form-actions">
        <button class="btn btn-primary" type="button" id="create-order">Abrir ordem de produção</button>
        <button class="btn btn-ghost" type="button" id="export-bom">Exportar B.O.M. (CSV)</button>
      </div>`
    : '<p class="empty">Selecione as estruturas e a quantidade, então clique em Consultar estoque e gerar B.O.M.</p>';

  return `
    <section class="card">
      <h3>Nova ordem de produção</h3>
      <p class="card-sub">A B.O.M. é gerada confrontando cada item da estrutura com o estoque atual.</p>
      <div class="form-grid">
        <label>Produto
          <input id="order-product" value="Robô Protus Totem" />
        </label>
        <label>Quantidade de robôs
          <input id="order-qty" type="number" min="1" step="1" value="${quantity}" />
        </label>
        <label>Observações
          <input id="order-notes" placeholder="Opcional" />
        </label>
      </div>
      <p class="card-sub" style="margin:14px 0 8px">Estruturas do robô</p>
      <div class="pill-list">${pills}</div>
      <div class="form-actions">
        <button class="btn btn-navy" type="button" id="simulate">Consultar estoque e gerar B.O.M.</button>
      </div>
      ${summary}
    </section>`;
}

function ordersCard() {
  const orders = listOrders();
  if (!orders.length) {
    return '<section class="card"><h3>Ordens registradas</h3><p class="empty">Nenhuma ordem de produção registrada.</p></section>';
  }

  const rows = orders
    .map((order) => {
      const bom = order.status === "aberta" ? calculateBom(order.structureIds, order.quantity) : { lines: order.bom, shortageCount: order.bom.filter((l) => l.toBuy > 0).length, complete: order.bom.every((l) => l.toBuy === 0) };
      const structureNames = order.structureIds
        .map((id) => getStructure(id)?.name ?? "Estrutura removida")
        .join(", ");
      const detail =
        expandedOrderId === order.id
          ? `<tr><td colspan="7">
               ${bomTable(bom.lines)}
               <div class="form-actions">
                 <button class="btn btn-ghost btn-sm" data-export="${order.id}">Exportar B.O.M. (CSV)</button>
               </div>
             </td></tr>`
          : "";
      return `
        <tr>
          <td><strong>${escapeHtml(order.number)}</strong><br /><small style="color:var(--muted)">${datetime(order.createdAt)}</small></td>
          <td>${escapeHtml(order.product)}<br /><small style="color:var(--muted)">${escapeHtml(structureNames)}</small></td>
          <td class="num">${num(order.quantity)}</td>
          <td>${statusTag(order.status)}</td>
          <td class="num">${bom.shortageCount ? `<span class="tag tag-danger">${bom.shortageCount} a comprar</span>` : '<span class="tag tag-ok">Completa</span>'}</td>
          <td>${order.producedAt ? datetime(order.producedAt) : "—"}</td>
          <td>
            <div class="row-actions">
              <button class="btn btn-ghost btn-sm" data-toggle="${order.id}">${expandedOrderId === order.id ? "Ocultar" : "B.O.M."}</button>
              ${order.status === "aberta" ? `<button class="btn btn-primary btn-sm" data-produce="${order.id}">Produzir</button>` : ""}
              ${order.status === "aberta" ? `<button class="btn btn-danger btn-sm" data-cancel="${order.id}">Cancelar</button>` : ""}
            </div>
          </td>
        </tr>
        ${detail}`;
    })
    .join("");

  return `
    <section class="card">
      <h3>Ordens registradas</h3>
      <p class="card-sub">Produzir uma ordem baixa o estoque dos materiais e soma robôs montados no dashboard.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Ordem</th><th>Produto</th><th class="num">Qtd</th><th>Status</th><th class="num">Materiais</th><th>Produzida em</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}

export function render(container, rerender) {
  container.innerHTML = plannerCard() + ordersCard();

  const qtyInput = container.querySelector("#order-qty");
  const productInput = container.querySelector("#order-product");
  const notesInput = container.querySelector("#order-notes");

  container.querySelectorAll("[data-structure]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.structure;
      selectedStructures = selectedStructures.includes(id)
        ? selectedStructures.filter((s) => s !== id)
        : [...selectedStructures, id];
      simulation = null;
      render(container, rerender);
    })
  );

  container.querySelector("#simulate")?.addEventListener("click", () => {
    quantity = Number(qtyInput.value) || 0;
    if (!selectedStructures.length) return toast("Selecione ao menos uma estrutura.", "error");
    if (!(quantity > 0)) return toast("Informe a quantidade de robôs.", "error");
    try {
      simulation = calculateBom(selectedStructures, quantity);
      const product = productInput.value;
      const notes = notesInput.value;
      render(container, rerender);
      container.querySelector("#order-product").value = product;
      container.querySelector("#order-notes").value = notes;
    } catch (error) {
      reportError(error, "Não foi possível calcular a B.O.M.");
    }
  });

  container.querySelector("#create-order")?.addEventListener("click", () => {
    try {
      const order = createOrder({
        structureIds: selectedStructures,
        quantity,
        product: productInput.value,
        notes: notesInput.value,
      });
      toast(`Ordem ${order.number} criada.`);
      simulation = null;
      selectedStructures = [];
      quantity = 1;
      rerender();
    } catch (error) {
      reportError(error, "Não foi possível criar a ordem.");
    }
  });

  container.querySelector("#export-bom")?.addEventListener("click", () => {
    try {
      if (!simulation) throw new Error("Gere a B.O.M. antes de exportar.");
      downloadCsv("bom-simulacao.csv", bomCsv(simulation.lines));
    } catch (error) {
      reportError(error, "Não foi possível exportar a B.O.M.");
    }
  });

  container.querySelectorAll("[data-toggle]").forEach((btn) =>
    btn.addEventListener("click", () => {
      expandedOrderId = expandedOrderId === btn.dataset.toggle ? null : btn.dataset.toggle;
      render(container, rerender);
    })
  );

  container.querySelectorAll("[data-export]").forEach((btn) =>
    btn.addEventListener("click", () => {
      try {
        const order = getOrder(btn.dataset.export);
        if (!order) throw new Error("Ordem não encontrada.");
        const lines = order.status === "aberta" ? calculateBom(order.structureIds, order.quantity).lines : order.bom;
        downloadCsv(`bom-${order.number}.csv`, bomCsv(lines));
      } catch (error) {
        reportError(error, "Não foi possível exportar a B.O.M.");
      }
    })
  );

  container.querySelectorAll("[data-produce]").forEach((btn) =>
    btn.addEventListener("click", () => {
      try {
        const order = produceOrder(btn.dataset.produce);
        toast(`Ordem ${order.number} produzida. Estoque baixado.`);
        rerender();
      } catch (error) {
        reportError(error, "Não foi possível produzir a ordem.");
      }
    })
  );

  container.querySelectorAll("[data-cancel]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const order = getOrder(btn.dataset.cancel);
      if (!order) {
        reportError(new Error("Ordem não encontrada."));
        return;
      }
      if (!confirm(`Cancelar a ordem ${order.number}?`)) return;
      try {
        cancelOrder(order.id);
        toast("Ordem cancelada.");
        rerender();
      } catch (error) {
        reportError(error, "Não foi possível cancelar a ordem.");
      }
    })
  );
}

export function resetPlanner() {
  selectedStructures = [];
  quantity = 1;
  simulation = null;
  expandedOrderId = null;
}
