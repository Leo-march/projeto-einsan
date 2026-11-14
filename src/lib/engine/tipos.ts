export type Pesos = {
  preco: number;
  prazo: number;
  confiabilidade: number;
  loteMinimo: number;
};

export type Estabelecimento = {
  id: string;
  nome: string;
  perfil: {
    z: number;
    semanasRevisao: number;
    pesos: Pesos;
    min: number;
    max: number;
  };
};

export type Lote = {
  id: string;
  medicamentoId: string;
  qtd: number;
  validade: string;
  cadeiaFriaOk: boolean;
};

export type EventoCofre = {
  id: string;
  data: string;
  tipo: "entrada" | "retirada" | "transferencia" | "dispensacao";
  qtd: number;
  loteId: string | null;
  temperaturaForaDaFaixa?: boolean;
  portaAbertaMin?: number;
};

export type Fornecedor = {
  id: string;
  nome: string;
  precoUnitario: number;
  prazoDias: number;
  confiabilidade: number;
  loteMinimo: number;
};

export type DadosDemonstracao = {
  estabelecimento: Estabelecimento;
  lotes: Lote[];
  eventos: EventoCofre[];
  fornecedores: Fornecedor[];
  consumoSemanal: number[];
};