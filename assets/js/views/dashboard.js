import { dashboardMetrics, getStructure } from "../store.js";
import { datetime, escapeHtml, money, num, statusTag } from "../ui.js";

export const title = "Dashboard";
export const subtitle = "Visão geral da montagem de robôs Protus";

export function render(container) {
  const m = dashboardMetrics();

  const shortageRows = m.shortages
    .map(
      (line) => `
      <tr>
        <td><strong>${escapeHtml(line.code)}</strong></td>
        <td>${escapeHtml(line.name)}</td>
        <td class="num">${num(line.toBuy)} ${escapeHtml(line.unit)}</td>
        <td class="num">${money(line.toBuy * line.cost)}</td>
        <td>${escapeHtml(line.orders.join(", "))}</td>
      </tr>`
    )
    .join("");

  const belowRows = m.belowMin
    .map(
      (mat) => `
      <tr>
        <td><strong>${escapeHtml(mat.code)}</strong></td>
        <td>${escapeHtml(mat.name)}</td>
        <td class="num">${num(mat.stock)} ${escapeHtml(mat.unit)}</td>
        <td class="num">${num(mat.minStock)}</td>
      </tr>`
    )
    .join("");

  const orderRows = m.recentOrders
    .map(
      (order) => `
      <tr>
        <td><strong>${escapeHtml(order.number)}</strong></td>
        <td>${escapeHtml(order.structureIds.map((id) => getStructure(id)?.name).filter(Boolean).join(", "))}</td>
        <td class="num">${num(order.quantity)}</td>
        <td>${statusTag(order.status)}</td>
        <td>${datetime(order.producedAt || order.createdAt)}</td>
      </tr>`
    )
    .join("");

  container.innerHTML = `
    <div class="grid grid-4">
      <div class="kpi accent"><span>Robôs montados</span><strong>${num(m.robotsAssembled)}</strong></div>
      <div class="kpi"><span>Robôs em produção</span><strong>${num(m.robotsPlanned)}</strong></div>
      <div class="kpi"><span>Ordens abertas</span><strong>${num(m.openOrders)}</strong></div>
      <div class="kpi"><span>Valor em estoque</span><strong style="font-size:1.5rem">${money(m.stockValue)}</strong></div>
    </div>

    <div class="grid grid-4" style="margin-top:16px">
      <div class="kpi"><span>Materiais cadastrados</span><strong>${num(m.materialsCount)}</strong></div>
      <div class="kpi"><span>Estruturas</span><strong>${num(m.structuresCount)}</strong></div>
      <div class="kpi"><span>Ordens produzidas</span><strong>${num(m.producedOrders)}</strong></div>
      <div class="kpi"><span>Itens abaixo do mínimo</span><strong style="color:${m.belowMin.length ? "var(--danger)" : "var(--ok)"}">${num(m.belowMin.length)}</strong></div>
    </div>

    <div class="grid grid-2" style="margin-top:20px">
      <section class="card">
        <h3>Compras necessárias (ordens abertas)</h3>
        <p class="card-sub">Faltas apuradas na B.O.M. das ordens em aberto</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Código</th><th>Material</th><th class="num">Comprar</th><th class="num">Custo</th><th>Ordens</th></tr></thead>
            <tbody>${shortageRows || '<tr><td colspan="5" class="empty">Nenhuma falta de material.</td></tr>'}</tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h3>Estoque abaixo do mínimo</h3>
        <p class="card-sub">Itens que precisam de reposição</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Código</th><th>Material</th><th class="num">Estoque</th><th class="num">Mínimo</th></tr></thead>
            <tbody>${belowRows || '<tr><td colspan="4" class="empty">Todos os itens acima do mínimo.</td></tr>'}</tbody>
          </table>
        </div>
      </section>
    </div>

    <section class="card">
      <h3>Ordens recentes</h3>
      <p class="card-sub">Últimas movimentações de produção</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Ordem</th><th>Estruturas</th><th class="num">Robôs</th><th>Status</th><th>Data</th></tr></thead>
          <tbody>${orderRows || '<tr><td colspan="5" class="empty">Nenhuma ordem registrada.</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;
}
