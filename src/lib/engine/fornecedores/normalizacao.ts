export function normalizar(valor: number, minimo: number, maximo: number, menorMelhor: boolean): number {
  if (maximo === minimo) return 100;
  const proporcao = (valor - minimo) / (maximo - minimo);
  return Math.round((menorMelhor ? 1 - proporcao : proporcao) * 100);
}