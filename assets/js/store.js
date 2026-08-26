const STORAGE_KEY = "protus.stock.v1";

const emptyState = () => ({
  materials: [],
  structures: [],
  entries: [],
  orders: [],
  sequences: { order: 0 },
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return { ...emptyState(), ...JSON.parse(raw) };
  } catch (err) {
    console.error("Falha ao ler dados locais", err);
    return emptyState();
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const getState = () => state;

export const listMaterials = () =>
  [...state.materials].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

export const getMaterial = (id) => state.materials.find((m) => m.id === id) || null;

export function saveMaterial(data) {
  const payload = {
    code: data.code.trim(),
    name: data.name.trim(),
    unit: data.unit.trim() || "UN",
    minStock: Number(data.minStock) || 0,
    cost: Number(data.cost) || 0,
    supplier: (data.supplier || "").trim(),
  };
  const duplicated = state.materials.some(
    (m) => m.code.toLowerCase() === payload.code.toLowerCase() && m.id !== data.id
  );
  if (duplicated) throw new Error(`Já existe material com o código ${payload.code}.`);

  if (data.id) {
    const material = getMaterial(data.id);
    if (!material) throw new Error("Material não encontrado.");
    Object.assign(material, payload);
    persist();
    return material;
  }

  const stock = Number(data.stock) || 0;
  const material = { id: uid("mat"), ...payload, stock, createdAt: new Date().toISOString() };
  state.materials.push(material);
  if (stock > 0) {
    state.entries.push({
      id: uid("ent"),
      materialId: material.id,
      qty: stock,
      document: "Estoque inicial",
      supplier: payload.supplier,
      note: "Registrado no cadastro do material",
      date: new Date().toISOString(),
    });
  }
  persist();
  return material;
}

export function deleteMaterial(id) {
  const used = state.structures.filter((s) => s.items.some((i) => i.materialId === id));
  if (used.length) {
    throw new Error(`Material usado na(s) estrutura(s): ${used.map((s) => s.name).join(", ")}.`);
  }
  state.materials = state.materials.filter((m) => m.id !== id);
  state.entries = state.entries.filter((e) => e.materialId !== id);
  persist();
}

export const listStructures = () =>
  [...state.structures].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

export const getStructure = (id) => state.structures.find((s) => s.id === id) || null;

export function saveStructure(data) {
  const name = data.name.trim();
  if (!name) throw new Error("Informe o nome da estrutura.");
  const duplicated = state.structures.some(
    (s) => s.name.toLowerCase() === name.toLowerCase() && s.id !== data.id
  );
  if (duplicated) throw new Error(`Já existe a estrutura ${name}.`);

  const items = (data.items || [])
    .filter((i) => i.materialId && Number(i.qty) > 0)
    .map((i) => ({ materialId: i.materialId, qty: Number(i.qty) }));

  if (data.id) {
    const structure = getStructure(data.id);
    if (!structure) throw new Error("Estrutura não encontrada.");
    Object.assign(structure, { name, description: (data.description || "").trim(), items });
    persist();
    return structure;
  }

  const structure = {
    id: uid("str"),
    name,
    description: (data.description || "").trim(),
    items,
    createdAt: new Date().toISOString(),
  };
  state.structures.push(structure);
  persist();
  return structure;
}

export function deleteStructure(id) {
  const open = state.orders.filter((o) => o.status === "aberta" && o.structureIds.includes(id));
  if (open.length) throw new Error("Estrutura vinculada a ordens de produção abertas.");
  state.structures = state.structures.filter((s) => s.id !== id);
  persist();
}

export const listEntries = () =>
  [...state.entries].sort((a, b) => b.date.localeCompare(a.date));

export function addEntry({ materialId, qty, document: doc, supplier, note }) {
  const material = getMaterial(materialId);
  if (!material) throw new Error("Selecione um material cadastrado.");
  const quantity = Number(qty);
  if (!(quantity > 0)) throw new Error("A quantidade deve ser maior que zero.");

  material.stock = Number((material.stock + quantity).toFixed(4));
  const entry = {
    id: uid("ent"),
    materialId,
    qty: quantity,
    document: (doc || "").trim(),
    supplier: (supplier || material.supplier || "").trim(),
    note: (note || "").trim(),
    date: new Date().toISOString(),
  };
  state.entries.push(entry);
  persist();
  return entry;
}

export const listOrders = () =>
  [...state.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export const getOrder = (id) => state.orders.find((o) => o.id === id) || null;

/**
 * Explode as estruturas selecionadas na quantidade pedida e confronta com o estoque atual.
 */
export function calculateBom(structureIds, quantity) {
  const qty = Number(quantity) || 0;
  const required = new Map();

  structureIds.forEach((structureId) => {
    const structure = getStructure(structureId);
    if (!structure) return;
    structure.items.forEach((item) => {
      const current = required.get(item.materialId) || { qty: 0, structures: new Set() };
      current.qty += item.qty * qty;
      current.structures.add(structure.name);
      required.set(item.materialId, current);
    });
  });

  const lines = [...required.entries()].map(([materialId, info]) => {
    const material = getMaterial(materialId);
    const stock = material ? material.stock : 0;
    const fromStock = Math.min(stock, info.qty);
    const toBuy = Number(Math.max(0, info.qty - stock).toFixed(4));
    return {
      materialId,
      code: material ? material.code : "—",
      name: material ? material.name : "Material removido",
      unit: material ? material.unit : "UN",
      cost: material ? material.cost : 0,
      supplier: material ? material.supplier : "",
      structures: [...info.structures].join(", "),
      required: Number(info.qty.toFixed(4)),
      stock,
      fromStock: Number(fromStock.toFixed(4)),
      toBuy,
    };
  });

  lines.sort((a, b) => b.toBuy - a.toBuy || a.name.localeCompare(b.name, "pt-BR"));

  return {
    lines,
    quantity: qty,
    complete: lines.length > 0 && lines.every((l) => l.toBuy === 0),
    shortageCount: lines.filter((l) => l.toBuy > 0).length,
    purchaseCost: Number(lines.reduce((sum, l) => sum + l.toBuy * l.cost, 0).toFixed(2)),
    stockCost: Number(lines.reduce((sum, l) => sum + l.fromStock * l.cost, 0).toFixed(2)),
  };
}

export function createOrder({ structureIds, quantity, product, notes }) {
  if (!structureIds.length) throw new Error("Selecione ao menos uma estrutura.");
  const qty = Number(quantity);
  if (!(qty > 0)) throw new Error("Informe a quantidade de robôs a montar.");

  state.sequences.order += 1;
  const bom = calculateBom(structureIds, qty);
  const order = {
    id: uid("ord"),
    number: `OP-${String(state.sequences.order).padStart(4, "0")}`,
    product: (product || "Robô Protus Totem").trim(),
    structureIds: [...structureIds],
    quantity: qty,
    notes: (notes || "").trim(),
    status: "aberta",
    createdAt: new Date().toISOString(),
    producedAt: null,
    bom: bom.lines,
  };
  state.orders.push(order);
  persist();
  return order;
}

export function produceOrder(id) {
  const order = getOrder(id);
  if (!order) throw new Error("Ordem não encontrada.");
  if (order.status !== "aberta") throw new Error("Somente ordens abertas podem ser produzidas.");

  const bom = calculateBom(order.structureIds, order.quantity);
  if (!bom.complete) throw new Error("Estoque insuficiente. Registre a entrada dos materiais faltantes.");

  bom.lines.forEach((line) => {
    const material = getMaterial(line.materialId);
    if (material) material.stock = Number((material.stock - line.required).toFixed(4));
  });

  order.status = "produzida";
  order.producedAt = new Date().toISOString();
  order.bom = bom.lines;
  persist();
  return order;
}

export function cancelOrder(id) {
  const order = getOrder(id);
  if (!order) throw new Error("Ordem não encontrada.");
  if (order.status !== "aberta") throw new Error("Somente ordens abertas podem ser canceladas.");
  order.status = "cancelada";
  persist();
  return order;
}

export function dashboardMetrics() {
  const produced = state.orders.filter((o) => o.status === "produzida");
  const open = state.orders.filter((o) => o.status === "aberta");
  const robotsAssembled = produced.reduce((sum, o) => sum + o.quantity, 0);
  const robotsPlanned = open.reduce((sum, o) => sum + o.quantity, 0);
  const belowMin = state.materials.filter((m) => m.minStock > 0 && m.stock < m.minStock);
  const stockValue = state.materials.reduce((sum, m) => sum + m.stock * m.cost, 0);

  const shortages = new Map();
  open.forEach((order) => {
    calculateBom(order.structureIds, order.quantity).lines
      .filter((line) => line.toBuy > 0)
      .forEach((line) => {
        const current = shortages.get(line.materialId) || { ...line, toBuy: 0, orders: [] };
        current.toBuy = Number((current.toBuy + line.toBuy).toFixed(4));
        current.orders.push(order.number);
        shortages.set(line.materialId, current);
      });
  });

  return {
    robotsAssembled,
    robotsPlanned,
    openOrders: open.length,
    producedOrders: produced.length,
    materialsCount: state.materials.length,
    structuresCount: state.structures.length,
    belowMin,
    stockValue: Number(stockValue.toFixed(2)),
    shortages: [...shortages.values()].sort((a, b) => b.toBuy - a.toBuy),
    recentOrders: listOrders().slice(0, 6),
  };
}

export function seedDemoData() {
  state = emptyState();
  const demoMaterials = [
    ["MT-001", "Display touch 21\" ", "UN", 6, 2, 1250],
    ["MT-002", "Placa mãe mini-ITX", "UN", 4, 2, 980],
    ["MT-003", "Câmera 4K USB", "UN", 3, 2, 420],
    ["MT-004", "Alto-falante 10W", "UN", 10, 4, 85],
    ["MT-005", "Estrutura ABS cabeça", "UN", 2, 2, 640],
    ["MT-006", "Chapa de aço totem 1,2mm", "UN", 5, 2, 310],
    ["MT-007", "Fonte 24V 150W", "UN", 8, 3, 260],
    ["MT-008", "Rodízio industrial", "UN", 12, 8, 45],
    ["MT-009", "Kit parafusos M4", "KIT", 20, 5, 18],
    ["MT-010", "Cabo HDMI 1,5m", "UN", 7, 3, 32],
  ];
  demoMaterials.forEach(([code, name, unit, stock, minStock, cost]) =>
    saveMaterial({ code, name: name.trim(), unit, stock, minStock, cost, supplier: "Fornecedor Padrão" })
  );

  const byCode = (code) => state.materials.find((m) => m.code === code).id;
  saveStructure({
    name: "Cabeça",
    description: "Conjunto de interação do totem: display, câmera, áudio e carcaça.",
    items: [
      { materialId: byCode("MT-001"), qty: 1 },
      { materialId: byCode("MT-003"), qty: 1 },
      { materialId: byCode("MT-004"), qty: 2 },
      { materialId: byCode("MT-005"), qty: 1 },
      { materialId: byCode("MT-009"), qty: 1 },
    ],
  });
  saveStructure({
    name: "Corpo",
    description: "Gabinete do totem com eletrônica de processamento.",
    items: [
      { materialId: byCode("MT-002"), qty: 1 },
      { materialId: byCode("MT-006"), qty: 2 },
      { materialId: byCode("MT-007"), qty: 1 },
      { materialId: byCode("MT-010"), qty: 1 },
    ],
  });
  saveStructure({
    name: "Base",
    description: "Base de sustentação e mobilidade.",
    items: [
      { materialId: byCode("MT-006"), qty: 1 },
      { materialId: byCode("MT-008"), qty: 4 },
      { materialId: byCode("MT-009"), qty: 1 },
    ],
  });

  const structureIds = state.structures.map((s) => s.id);
  const first = createOrder({ structureIds, quantity: 1, product: "Robô Protus Totem" });
  produceOrder(first.id);
  createOrder({ structureIds, quantity: 3, product: "Robô Protus Totem", notes: "Pedido cliente piloto" });
  persist();
}

export function resetAll() {
  state = emptyState();
  persist();
}
