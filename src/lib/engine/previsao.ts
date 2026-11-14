export type ResultadoPrevisao = {
  mediaSemanal: number;
  desvioPadrao: number;
  consumoProjetado: number;
  coberturaHistorico: number;
  metodo: string;
};

export function preverConsumo(historico: number[], semanas: number, completude = 1): ResultadoPrevisao {
  const valores = historico.map((valor) => valor / Math.max(completude, 0.1));
  const recentes = valores.slice(-4);
  const mediaRecente = recentes.reduce((total, valor) => total + valor, 0) / Math.max(recentes.length, 1);
  const mediaHistorica = valores.reduce((total, valor) => total + valor, 0) / Math.max(valores.length, 1);
  const mediaSemanal = mediaRecente * 0.7 + mediaHistorica * 0.3;
  const variancia = valores.reduce((total, valor) => total + (valor - mediaSemanal) ** 2, 0) / Math.max(valores.length, 1);
  const desvioPadrao = Math.sqrt(variancia);

  return {
    mediaSemanal,
    desvioPadrao,
    consumoProjetado: mediaSemanal * semanas,
    coberturaHistorico: Math.round(completude * 100),
    metodo: "70% média das últimas 4 semanas + 30% média do histórico",
  };
}