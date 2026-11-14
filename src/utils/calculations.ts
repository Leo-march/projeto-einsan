export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const dataBR = (s: string) => new Date(s.length > 10 ? s : s + 'T12:00:00-03:00').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
