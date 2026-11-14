import type { DadosDemonstracao, EventoCofre, Lote } from "@/lib/engine/tipos";

const BASE_DATE = new Date("2026-11-14T12:00:00.000Z");

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function dateOffset(days: number): string {
  const date = new Date(BASE_DATE);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function createEvents(lots: Lote[]): EventoCofre[] {
  const random = seededRandom(20261114);
  const events: EventoCofre[] = [];

  for (let week = 11; week >= 0; week -= 1) {
    const lot = lots[(11 - week) % lots.length];
    const demand = Math.round(18 + random() * 12);
    events.push({
      id: `EV-${String(week + 1).padStart(3, "0")}`,
      data: dateOffset(-week * 7 - Math.floor(random() * 5)),
      tipo: "dispensacao",
      qtd: demand,
      loteId: lot.id,
    });
  }

  events.push(
    {
      id: "EV-013",
      data: dateOffset(-1),
      tipo: "transferencia",
      qtd: 8,
      loteId: null,
      portaAbertaMin: 4,
    },
    {
      id: "EV-014",
      data: dateOffset(-3),
      tipo: "entrada",
      qtd: 60,
      loteId: lots[0].id,
      temperaturaForaDaFaixa: true,
    },
  );

  return events.sort((left, right) => right.data.localeCompare(left.data));
}

const lotes: Lote[] = [
  { id: "LT-2408", medicamentoId: "MED-X", qtd: 70, validade: dateOffset(14), cadeiaFriaOk: true },
  { id: "LT-2411", medicamentoId: "MED-X", qtd: 8, validade: dateOffset(74), cadeiaFriaOk: true },
  { id: "LT-2417", medicamentoId: "MED-X", qtd: 6, validade: dateOffset(142), cadeiaFriaOk: true },
  { id: "LT-2420", medicamentoId: "MED-X", qtd: 6, validade: dateOffset(265), cadeiaFriaOk: true },
];

export const seed: DadosDemonstracao = {
  estabelecimento: {
    id: "EST-001",
    nome: "Farmácia Modelo",
    perfil: {
      z: 1.65,
      semanasRevisao: 2,
      pesos: { preco: 35, prazo: 25, confiabilidade: 25, loteMinimo: 15 },
      min: 120,
      max: 360,
    },
  },
  lotes,
  eventos: createEvents(lotes),
  fornecedores: [
    { id: "FOR-A", nome: "Distribuidora Alfa", precoUnitario: 1280, prazoDias: 5, confiabilidade: 94, loteMinimo: 24 },
    { id: "FOR-B", nome: "Distribuidora Beta", precoUnitario: 1195, prazoDias: 9, confiabilidade: 91, loteMinimo: 48 },
    { id: "FOR-C", nome: "Distribuidora Gama", precoUnitario: 1370, prazoDias: 3, confiabilidade: 98, loteMinimo: 72 },
    { id: "FOR-D", nome: "Distribuidora Delta", precoUnitario: 1160, prazoDias: 18, confiabilidade: 82, loteMinimo: 96 },
  ],
  consumoSemanal: [24, 21, 28, 19, 26, 23, 31, 22, 27, 24, 29, 25],
};

export const dataBaseDemonstracao = BASE_DATE;