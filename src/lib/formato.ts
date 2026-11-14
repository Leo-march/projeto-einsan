const fusoBrasilia = "America/Sao_Paulo";

export function formatarData(valor: string): string {
  const data = new Date(/^\d{4}-\d{2}-\d{2}$/.test(valor) ? `${valor}T12:00:00-03:00` : valor);
  if (Number.isNaN(data.getTime())) return "Data inválida";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: fusoBrasilia,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(data);
}

export function formatarDataHora(valor: string | null): string {
  if (!valor) return "Não informado";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "Data inválida";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: fusoBrasilia,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(data);
}

export function formatarBRL(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

export function formatarNumero(valor: number, casasDecimais = 0): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casasDecimais,
    maximumFractionDigits: casasDecimais,
  }).format(valor);
}

export function formatarDuracao(segundos: number): string {
  return `${formatarNumero(segundos / 60, 1)} min`;
}