import { describe, expect, it } from 'vitest';
import { diaDaRuptura, projetarEstoque, saidasPorDia, simularEstoque } from './projecao-inteira';

describe('projecao inteira', () => {
  it('distribui consumo decimal em unidades inteiras por dia', () => {
    expect(saidasPorDia(0.4, 10)).toEqual([0, 0, 1, 0, 1, 0, 0, 1, 0, 1]);
    expect(saidasPorDia(0.5, 6)).toEqual([0, 1, 0, 1, 0, 1]);
    expect(saidasPorDia(1, 4)).toEqual([1, 1, 1, 1]);
    expect(saidasPorDia(2.5, 4)).toEqual([2, 3, 2, 3]);
    expect(saidasPorDia(0, 5)).toEqual([0, 0, 0, 0, 0]);
  });

  it('calcula ruptura em dia inteiro', () => {
    expect(diaDaRuptura(1, 0.4)).toBe(3);
    expect(diaDaRuptura(7, 0.5)).toBe(14);
    expect(diaDaRuptura(5, 0)).toBeNull();
  });

  it('simula FEFO sem criar frações e sem estoque negativo', () => {
    const resultado = simularEstoque(
      [
        { codigo_lote: 'A', quantidade: 5, validade: '2026-12-10' },
        { codigo_lote: 'B', quantidade: 3, validade: '2026-12-20' },
      ],
      0.4,
      10,
      new Date('2026-12-01T00:00:00-03:00').getTime(),
    );

    expect(resultado.every((p) => Number.isInteger(p.saida) && Number.isInteger(p.estoque_restante))).toBe(true);
    expect(Math.max(...resultado.map((p) => p.estoque_restante))).toBeGreaterThanOrEqual(0);
    expect(resultado.atual.estoque_restante).toBeGreaterThanOrEqual(0);
    expect(resultado.atual.saidas_total).toBeGreaterThan(0);
    expect(resultado.estoque_final).toBeGreaterThanOrEqual(0);
    expect(resultado.saidas_total).toBeGreaterThan(0);
  });

  it('mantém a projeção futura em unidades inteiras e sem compra futura presumida', () => {
    const projeção = projetarEstoque(10, 0.63, 6);

    expect(projeção.saidas.every((unidade) => Number.isInteger(unidade))).toBe(true);
    expect(projeção.estoque.every((unidade) => Number.isInteger(unidade))).toBe(true);
    expect(projeção.estoque.every((unidade) => unidade >= 0)).toBe(true);
    expect(projeção.estoque[0]).toBe(10);
    expect(projeção.estoque.at(-1)).toBeLessThanOrEqual(10);
  });
});
