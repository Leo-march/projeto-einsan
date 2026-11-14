"use client";

import { useState } from "react";
import { seed, dataBaseDemonstracao } from "@/data/seed";
import { calcularConfiancaSaldo } from "@/lib/engine/confianca";
import { avaliarFornecedores } from "@/lib/engine/fornecedores";
import { calcularMinMax } from "@/lib/engine/minmax";
import { preverConsumo } from "@/lib/engine/previsao";
import { calcularReposicao } from "@/lib/engine/reposicao";
import { simularFefo } from "@/lib/engine/validade";
import type { Estabelecimento, Pesos } from "@/lib/engine/tipos";
import styles from "./page.module.css";

type Secao = "hoje" | "estoque" | "reposicao" | "simulador";

const secoes: { id: Secao; numero: string; rotulo: string }[] = [
  { id: "hoje", numero: "01", rotulo: "Hoje" },
  { id: "estoque", numero: "02", rotulo: "Estoque" },
  { id: "reposicao", numero: "03", rotulo: "Reposição" },
  { id: "simulador", numero: "04", rotulo: "Simulador" },
];

const nomesPesos: Record<keyof Pesos, string> = {
  preco: "Preço",
  prazo: "Prazo de entrega",
  confiabilidade: "Confiabilidade simulada",
  loteMinimo: "Lote mínimo",
};

function moeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(valor);
}

function moedaPrecisao(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);
}

function arredondar(valor: number): number {
  return Math.round(valor);
}

function dataCurta(data: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(data));
}

function compararFornecedor(
  atual: string,
  outro: string,
  criterio: string,
  atualValor: number,
  outroValor: number,
  menorMelhor: boolean,
  formatar: (valor: number) => string = (valor) => String(valor),
): string {
  const atualMelhor = menorMelhor ? atualValor < outroValor : atualValor > outroValor;
  const igual = atualValor === outroValor;
  const vantagem = igual ? "empate" : atualMelhor ? atual : outro;
  return `${criterio}: vantagem de ${vantagem} (${atual}: ${formatar(atualValor)}; ${outro}: ${formatar(outroValor)}).`;
}

function GraficoConsumo({ valores }: { valores: number[] }) {
  const maximo = Math.max(...valores, 1);
  const pontos = valores.map((valor, indice) => {
    const x = 20 + (indice * 560) / (valores.length - 1);
    const y = 150 - (valor / maximo) * 112;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg className={styles.chart} viewBox="0 0 600 180" role="img" aria-label="Consumo semanal observado e estimado">
      <line x1="20" y1="150" x2="580" y2="150" className={styles.chartAxis} />
      <line x1="20" y1="94" x2="580" y2="94" className={styles.chartGrid} />
      <line x1="20" y1="38" x2="580" y2="38" className={styles.chartGrid} />
      <polyline points={pontos} className={styles.chartLine} />
      {valores.map((valor, indice) => {
        const x = 20 + (indice * 560) / (valores.length - 1);
        const y = 150 - (valor / maximo) * 112;
        return <circle key={`${indice}-${valor}`} cx={x} cy={y} r="3.5" className={styles.chartPoint} />;
      })}
    </svg>
  );
}

export default function Home() {
  const [secao, setSecao] = useState<Secao>("hoje");
  const [nomeEstabelecimento, setNomeEstabelecimento] = useState("Farmácia Modelo");
  const [pesos, setPesos] = useState<Pesos>(seed.estabelecimento.perfil.pesos);
  const [nivelServico, setNivelServico] = useState(seed.estabelecimento.perfil.z);
  const [semanasRevisao, setSemanasRevisao] = useState(seed.estabelecimento.perfil.semanasRevisao);
  const [completude, setCompletude] = useState(100);
  const [custoArmazenagem, setCustoArmazenagem] = useState(3.5);
  const [estoqueMinimo, setEstoqueMinimo] = useState(seed.estabelecimento.perfil.min);
  const [estoqueMaximo, setEstoqueMaximo] = useState(seed.estabelecimento.perfil.max);

  const estabelecimento: Estabelecimento = nomeEstabelecimento === "Farmácia Modelo"
    ? seed.estabelecimento
    : {
        ...seed.estabelecimento,
        id: "EST-002",
        nome: "Clínica Modelo",
        perfil: { ...seed.estabelecimento.perfil, z: 1.96, semanasRevisao: 1, min: 90, max: 260 },
      };
  const estabelecimentoAtivo: Estabelecimento = {
    ...estabelecimento,
    perfil: { ...estabelecimento.perfil, z: nivelServico, semanasRevisao, pesos, min: estoqueMinimo, max: estoqueMaximo },
  };
  const previsao = preverConsumo(seed.consumoSemanal, semanasRevisao, completude / 100);
  const previsaoCompleta = preverConsumo(seed.consumoSemanal, semanasRevisao, 1);
  const reposicao = calcularReposicao(seed.lotes, previsao, estabelecimentoAtivo);
  const reposicaoMinMax = calcularMinMax(seed.lotes, estabelecimentoAtivo);
  const lotesEmRisco = simularFefo(seed.lotes, previsao.mediaSemanal, dataBaseDemonstracao);
  const unidadesEmRisco = lotesEmRisco.reduce((total, item) => total + item.unidadesEmRisco, 0);
  const avaliacaoFornecedores = avaliarFornecedores(seed.fornecedores, pesos);
  const elegiveis = avaliacaoFornecedores.filter((item) => !item.excluido);
  const recomendado = elegiveis[0];
  const segundoLugar = elegiveis[1];
  const saldoAtual = reposicao.saldoAtual;
  const diasAtePontoReposicao = previsao.mediaSemanal <= 0
    ? 0
    : Math.max(0, Math.ceil(((saldoAtual - reposicao.pontoReposicao) / previsao.mediaSemanal) * 7));
  const quantidadeCompraSugerida = reposicao.quantidadeSugerida === 0
    ? 0
    : Math.max(reposicao.quantidadeSugerida, recomendado?.fornecedor.loteMinimo ?? 0);
  const janela = seed.eventos.slice(0, 5);
  const tituloSecao: Record<Secao, string> = {
    hoje: "Visão de hoje",
    estoque: "Estoque por lote",
    reposicao: "Plano de reposição",
    simulador: "Teste as premissas",
  };

  function atualizarPeso(chave: keyof Pesos, valor: number) {
    setPesos((atuais) => ({ ...atuais, [chave]: valor }));
  }

  function renderFornecedorResumo() {
    if (!recomendado) return <p>Nenhum fornecedor atende às premissas atuais.</p>;
    const fornecedor = recomendado.fornecedor;
    const comparacao = segundoLugar?.fornecedor;

    return (
      <>
        <div className={styles.recommendationHead}>
          <div>
            <span className={styles.kicker}>MAIOR PONTUAÇÃO ELEGÍVEL</span>
            <h3>{fornecedor.nome}</h3>
          </div>
          <strong className={styles.score}>{recomendado.pontuacao}<small>/100</small></strong>
        </div>
        <p className={styles.reasonText}>
          Resultado do peso atual: {fornecedor.nome} combina preço de {moeda(fornecedor.precoUnitario)}, entrega em {fornecedor.prazoDias} dias, confiabilidade simulada de {fornecedor.confiabilidade}% e lote mínimo de {fornecedor.loteMinimo} unidades.
        </p>
        <div className={styles.orderAdjustment}>
          <div><span>Compra sugerida com este fornecedor</span><strong>{quantidadeCompraSugerida} un.</strong></div>
          <p>{reposicao.quantidadeSugerida === 0
            ? "Sem pedido calculado para o ciclo atual."
            : quantidadeCompraSugerida > reposicao.quantidadeSugerida
              ? `Sugestão base: ${reposicao.quantidadeSugerida} un. O lote mínimo acrescenta ${quantidadeCompraSugerida - reposicao.quantidadeSugerida} un.`
              : "Quantidade dentro do lote mínimo informado."}</p>
          {quantidadeCompraSugerida > 0 && <span className={styles.orderCost}>Total simulado: {moeda(quantidadeCompraSugerida * fornecedor.precoUnitario)}</span>}
        </div>
        {comparacao && (
          <>
          <div className={styles.tradeoffHeading}>Vantagens e concessões vs. {comparacao.nome}</div>
          <div className={styles.comparisonLines}>
            <p>{compararFornecedor(fornecedor.nome, comparacao.nome, "Preço", fornecedor.precoUnitario, comparacao.precoUnitario, true, moeda)}</p>
            <p>{compararFornecedor(fornecedor.nome, comparacao.nome, "Prazo", fornecedor.prazoDias, comparacao.prazoDias, true, (valor) => `${valor} dias`)}</p>
            <p>{compararFornecedor(fornecedor.nome, comparacao.nome, "Confiabilidade", fornecedor.confiabilidade, comparacao.confiabilidade, false, (valor) => `${valor}%`)}</p>
            <p>{compararFornecedor(fornecedor.nome, comparacao.nome, "Lote mínimo", fornecedor.loteMinimo, comparacao.loteMinimo, true, (valor) => `${valor} un.`)}</p>
          </div>
          </>
        )}
        <div className={styles.referenceNote}>
          <strong>Faixa BPS demonstrativa: R$ 1.100–1.400 por unidade.</strong>
          <span>Referência de compras públicas; não equivale a cotação atual.</span>
        </div>
      </>
    );
  }

  function renderHoje() {
    return (
      <>
        <section className={styles.metricGrid} aria-label="Indicadores do estoque">
          <article className={`${styles.metric} ${styles.metricLead}`}>
            <span>Saldo total</span><strong>{saldoAtual}<small> un.</small></strong><p>4 lotes monitorados</p>
          </article>
          <article className={styles.metric}>
            <span>Cobertura estimada</span><strong>{reposicao.coberturaSemanas.toFixed(1)}<small> sem.</small></strong><p>Com base no consumo previsto</p>
          </article>
          <article className={styles.metric}>
            <span>Risco de vencimento</span><strong>{unidadesEmRisco}<small> un.</small></strong><p>Simulação FEFO · 12 semanas</p>
          </article>
          <article className={styles.metric}>
            <span>Consumo previsto</span><strong>{arredondar(previsao.mediaSemanal)}<small> un./sem.</small></strong><p>Média ponderada do histórico</p>
          </article>
        </section>

        <section className={styles.overviewGrid}>
          <article className={styles.panel}>
            <div className={styles.panelHeading}>
              <div><span className={styles.kicker}>SÉRIE SEMANAL</span><h2>Ritmo de consumo</h2></div>
              <span className={styles.periodLabel}>12 semanas</span>
            </div>
            <GraficoConsumo valores={seed.consumoSemanal} />
            <div className={styles.chartFoot}>
              <span><i className={styles.legendDot} />Consumo registrado</span>
              <span>Média prevista <b>{arredondar(previsao.mediaSemanal)} un./sem.</b></span>
            </div>
            <p className={styles.methodNote}>{previsao.metodo}. Sem treinamento de modelo.</p>
          </article>

          <article className={`${styles.panel} ${styles.signalPanel}`}>
            <div className={styles.panelHeading}>
              <div><span className={styles.kicker}>LEITURA DO COFRE</span><h2>Eventos recentes</h2></div>
              <span className={styles.signalCount}>{seed.eventos.filter((item) => item.loteId === null || item.temperaturaForaDaFaixa).length} sinais</span>
            </div>
            <div className={styles.eventList}>
              {janela.map((evento) => (
                <div className={styles.eventRow} key={evento.id}>
                  <span className={`${styles.eventMark} ${evento.temperaturaForaDaFaixa || evento.loteId === null ? styles.eventMarkAlert : ""}`} />
                  <div><strong>{evento.temperaturaForaDaFaixa ? "Temperatura fora da faixa" : evento.loteId === null ? "Movimento sem lote vinculado" : `${evento.tipo} registrada`}</strong><span>{evento.qtd} un. · {evento.loteId ?? "Lote não informado"}</span></div>
                  <time>{dataCurta(evento.data)}</time>
                </div>
              ))}
            </div>
            <p className={styles.disclaimer}>Sinais para conferência do responsável. Sem interpretação clínica.</p>
          </article>
        </section>

        <section className={styles.lowerGrid}>
          <article className={styles.panel}>
            <div className={styles.panelHeading}>
              <div><span className={styles.kicker}>PRÓXIMA AÇÃO</span><h2>Reposição estatística</h2></div>
              <button className={styles.textButton} onClick={() => setSecao("reposicao")}>Ver análise <span aria-hidden="true">↗</span></button>
            </div>
            <div className={styles.actionStrip}>
              <span className={styles.actionNumber}>{reposicao.quantidadeSugerida === 0 ? "—" : diasAtePontoReposicao === 0 ? "Agora" : `${diasAtePontoReposicao} d`}</span>
              <p>{reposicao.quantidadeSugerida === 0 ? "Sem compra indicada neste ciclo." : `Até atingir o ponto de reposição; sugestão base de ${reposicao.quantidadeSugerida} un. para o estoque-alvo.`}</p>
            </div>
            <div className={styles.inlineStats}><span>Ponto de reposição <b>{reposicao.pontoReposicao} un.</b></span><span>Estoque de segurança <b>{reposicao.estoqueSeguranca} un.</b></span></div>
          </article>
          <article className={styles.panel}>
            <div className={styles.panelHeading}>
              <div><span className={styles.kicker}>FEFO SIMULADO</span><h2>Validade em foco</h2></div>
              <button className={styles.textButton} onClick={() => setSecao("estoque")}>Ver lotes <span aria-hidden="true">↗</span></button>
            </div>
            {lotesEmRisco.length ? lotesEmRisco.slice(0, 2).map((item) => (
              <div className={styles.expiryRow} key={item.lote.id}>
                <div><strong>{item.lote.id}</strong><span>Vence em {item.diasParaVencer} dias</span></div>
                <b>{item.unidadesEmRisco} un. em risco</b>
              </div>
            )) : <p className={styles.emptyState}>Sem unidades estimadas em risco no horizonte simulado.</p>}
          </article>
        </section>
      </>
    );
  }

  function renderEstoque() {
    return (
      <section className={styles.stockLayout}>
        <article className={styles.panel}>
          <div className={styles.panelHeading}>
            <div><span className={styles.kicker}>MEDICAMENTO X</span><h2>Saldo e validade por lote</h2></div>
            <span className={styles.periodLabel}>{saldoAtual} unidades</span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead><tr><th>Lote</th><th>Saldo</th><th>Validade</th><th>Confiança do saldo</th><th>FEFO</th></tr></thead>
              <tbody>{seed.lotes.map((lote) => {
                const risco = lotesEmRisco.find((item) => item.lote.id === lote.id);
                const confianca = calcularConfiancaSaldo(lote.id, seed.eventos);
                return (
                  <tr key={lote.id}>
                    <td><strong>{lote.id}</strong></td><td>{lote.qtd} un.</td><td>{dataCurta(lote.validade)}</td>
                    <td><div className={styles.confidenceCell}><span className={styles.meter}><i style={{ width: `${confianca}%` }} /></span><b>{confianca}%</b></div></td>
                    <td>{risco ? <span className={styles.riskTag}>{risco.unidadesEmRisco} un. em risco</span> : <span className={styles.okTag}>Sem risco estimado</span>}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          <p className={styles.methodNote}>Confiança demonstrativa: proporção de eventos de movimentação vinculados ao lote entre os eventos vinculados a ele e os sem lote. Não substitui conferência local.</p>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeading}><div><span className={styles.kicker}>TRILHA DE EVENTOS</span><h2>Registro do cofre</h2></div><span className={styles.periodLabel}>Simulado</span></div>
          <div className={styles.timeline}>
            {seed.eventos.slice(0, 8).map((evento) => (
              <div className={styles.timelineItem} key={evento.id}>
                <span className={`${styles.timelineDot} ${evento.temperaturaForaDaFaixa ? styles.timelineDotAlert : ""}`} />
                <div className={styles.timelineBody}>
                  <div><strong>{evento.temperaturaForaDaFaixa ? "Sinal: temperatura fora da faixa" : `${evento.tipo} de ${evento.qtd} un.`}</strong><time>{dataCurta(evento.data)}</time></div>
                  <p>{evento.loteId ? `Lote ${evento.loteId}` : "Lote não informado"}{evento.portaAbertaMin ? ` · porta aberta por ${evento.portaAbertaMin} min` : ""}</p>
                  {evento.temperaturaForaDaFaixa && <span className={styles.disclaimer}>Evento sinalizado; decisão do responsável.</span>}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    );
  }

  function renderReposicao() {
    return (
      <section className={styles.procurementLayout}>
        <div className={styles.procurementMain}>
          <article className={styles.panel}>
            <div className={styles.panelHeading}><div><span className={styles.kicker}>CÁLCULO EXPLICÁVEL</span><h2>Recomendação de compra</h2></div><span className={styles.premiseTag}>Premissas editáveis</span></div>
            <div className={styles.replenishSummary}>
              <div><span>Quantidade sugerida</span><strong>{reposicao.quantidadeSugerida}<small> un.</small></strong></div>
              <div><span>Acionar em</span><strong>{reposicao.quantidadeSugerida === 0 ? "—" : diasAtePontoReposicao}<small>{reposicao.quantidadeSugerida === 0 ? "" : " dias"}</small></strong></div>
              <div><span>Saldo atual</span><strong>{saldoAtual}<small> un.</small></strong></div>
              <div><span>Cobertura prevista</span><strong>{reposicao.coberturaSemanas.toFixed(1)}<small> sem.</small></strong></div>
            </div>
            <div className={styles.formulaBand}>
              <span>Ponto de reposição</span><b>{reposicao.pontoReposicao} un.</b>
              <span>= demanda durante revisão + estoque de segurança ({reposicao.estoqueSeguranca} un.)</span>
            </div>
            <p className={styles.methodNote}>Estoque-alvo considera {semanasRevisao} semana(s) de revisão + 2 semanas de cobertura, somadas ao estoque de segurança.</p>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeading}><div><span className={styles.kicker}>DECISÃO POR CRITÉRIOS</span><h2>Comparativo de fornecedores</h2></div><span className={styles.periodLabel}>Ordenado pela pontuação</span></div>
            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead><tr><th>Fornecedor</th><th>Preço simulado</th><th>Prazo</th><th>Confiabilidade</th><th>Lote mínimo</th><th>Pontos</th></tr></thead>
                <tbody>{avaliacaoFornecedores.map((item, indice) => (
                  <tr key={item.fornecedor.id} className={item.excluido ? styles.excludedRow : ""}>
                    <td><strong>{item.fornecedor.nome}</strong>{indice === 0 && !item.excluido && <span className={styles.recommendedTag}>Recomendado</span>}{item.excluido && <span className={styles.excludedTag}>Excluído</span>}</td>
                    <td>{moeda(item.fornecedor.precoUnitario)}</td><td>{item.fornecedor.prazoDias} dias</td><td>{item.fornecedor.confiabilidade}%</td><td>{item.fornecedor.loteMinimo} un.</td><td><b>{item.pontuacao}</b></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <p className={styles.exclusionNote}>Exclusões: {avaliacaoFornecedores.filter((item) => item.excluido).map((item) => `${item.fornecedor.nome}: ${item.motivoExclusao}`).join(" ") || "nenhum fornecedor excluído pelas premissas atuais."}</p>
          </article>

          <article className={`${styles.panel} ${styles.reasonPanel}`}>
            <div className={styles.panelHeading}><div><span className={styles.kicker}>JUSTIFICATIVA CALCULADA</span><h2>Por que esta opção?</h2></div></div>
            {renderFornecedorResumo()}
          </article>
        </div>

        <aside className={`${styles.panel} ${styles.assumptionsPanel}`}>
          <span className={styles.kicker}>CONTROLES</span><h2>Premissas da análise</h2>
          <label className={styles.sliderField}>
            <span>Nível de serviço <b>{nivelServico.toFixed(2)} z</b></span>
            <input type="range" min="1.04" max="2.33" step="0.01" value={nivelServico} onChange={(event) => setNivelServico(Number(event.target.value))} />
            <small>Fator estatístico hipotético</small>
          </label>
          <label className={styles.sliderField}>
            <span>Ciclo de revisão <b>{semanasRevisao} sem.</b></span>
            <input type="range" min="1" max="4" step="1" value={semanasRevisao} onChange={(event) => setSemanasRevisao(Number(event.target.value))} />
            <small>Intervalo hipotético entre revisões</small>
          </label>
          <label className={styles.sliderField}>
            <span>Custo de armazenagem <b>{moedaPrecisao(custoArmazenagem)}/un./sem.</b></span>
            <input type="range" min="0" max="20" step="0.5" value={custoArmazenagem} onChange={(event) => setCustoArmazenagem(Number(event.target.value))} />
            <small>Premissa editável para simulação de custo</small>
          </label>
          <div className={styles.numberFields}>
            <label>Min. estoque <input type="number" min="0" value={estoqueMinimo} onChange={(event) => setEstoqueMinimo(Math.min(estoqueMaximo, Math.max(0, Number(event.target.value))))} /></label>
            <label>Max. estoque <input type="number" min={estoqueMinimo} value={estoqueMaximo} onChange={(event) => setEstoqueMaximo(Math.max(estoqueMinimo, Number(event.target.value)))} /></label>
          </div>
          <div className={styles.assumptionDivider} />
          <div className={styles.weightHeading}><span>Pesos da decisão</span><small>Premissas · % relativo</small></div>
          {(Object.keys(nomesPesos) as (keyof Pesos)[]).map((chave) => (
            <label className={styles.weightField} key={chave}>
              <span>{nomesPesos[chave]} <b>{pesos[chave]}%</b></span>
              <input type="range" min="0" max="60" step="1" value={pesos[chave]} onChange={(event) => atualizarPeso(chave, Number(event.target.value))} />
            </label>
          ))}
          <p className={styles.methodNote}>A pontuação é normalizada sobre os pesos informados e o ranking é recalculado ao mover os controles. Distribuidora Delta fica excluída quando o prazo excede 14 dias.</p>
        </aside>
      </section>
    );
  }

  function renderSimulador() {
    const mediaSemanalCompleta = previsaoCompleta.mediaSemanal;
    const custoDiferenca = Math.abs(reposicaoMinMax - quantidadeCompraSugerida) * (recomendado?.fornecedor.precoUnitario ?? 0);
    const custoEstoque = quantidadeCompraSugerida * custoArmazenagem * semanasRevisao;
    return (
      <section className={styles.simulatorLayout}>
        <article className={styles.panel}>
          <div className={styles.panelHeading}><div><span className={styles.kicker}>CENÁRIO HIPOTÉTICO</span><h2>Histórico incompleto</h2></div><span className={styles.premiseTag}>Não altera os dados base</span></div>
          <p className={styles.simulatorIntro}>Reduza a completude simulada do histórico e observe como a previsão, o estoque de reposição e a perda estimada mudam.</p>
          <label className={styles.completenessControl}>
            <span>Histórico disponível <strong>{completude}%</strong></span>
            <input type="range" min="50" max="100" step="5" value={completude} onChange={(event) => setCompletude(Number(event.target.value))} />
            <div className={styles.rangeEnds}><span>50% incompleto</span><span>100% completo</span></div>
          </label>
          <div className={styles.comparisonGrid}>
            <div className={styles.comparisonColumn}><span>Histórico completo</span><strong>{arredondar(mediaSemanalCompleta)}<small> un./sem.</small></strong><p>Reposição: {calcularReposicao(seed.lotes, previsaoCompleta, estabelecimentoAtivo).quantidadeSugerida} un.</p></div>
            <div className={styles.comparisonArrow} aria-hidden="true">→</div>
            <div className={styles.comparisonColumnActive}><span>Com {completude}% disponível</span><strong>{arredondar(previsao.mediaSemanal)}<small> un./sem.</small></strong><p>Reposição: {reposicao.quantidadeSugerida} un.</p></div>
          </div>
          <p className={styles.methodNote}>A estimativa ajusta os consumos observados pela completude informada antes de aplicar a média ponderada (70/30). É uma hipótese de simulação, não uma correção do histórico real.</p>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeading}><div><span className={styles.kicker}>COMPARAÇÃO DE MÉTODOS</span><h2>Estatístico × min-max</h2></div></div>
          <div className={styles.methodCompare}>
            <div><span>Previsão estatística</span><strong>{reposicao.quantidadeSugerida} un.</strong><p>Baseada em consumo, variabilidade e ciclo de revisão.</p></div>
            <div><span>Método min-max atual</span><strong>{reposicaoMinMax} un.</strong><p>Saldo abaixo de {estabelecimentoAtivo.perfil.min} aciona reposição até {estabelecimentoAtivo.perfil.max}.</p></div>
          </div>
          <div className={styles.deltaBand}><span>Diferença estimada de compra</span><b>{moeda(custoDiferenca)}</b></div>
              <div className={styles.deltaBand}><span>Custo hipotético de armazenagem no ciclo</span><b>{moedaPrecisao(custoEstoque)}</b></div>
          <p className={styles.methodNote}>Valores de custo são premissas para comparação e não representam cotação ou custo observado.</p>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeading}><div><span className={styles.kicker}>RASTREABILIDADE</span><h2>Como interpretar esta simulação</h2></div></div>
          <div className={styles.auditRows}>
            <div><span>Fonte dos dados</span><b>Seed determinística local</b></div>
            <div><span>Eventos avaliados</span><b>{seed.eventos.length} eventos simulados</b></div>
            <div><span>Cobertura do histórico</span><b>{previsao.coberturaHistorico}%</b></div>
            <div><span>Impacto no saldo</span><b>Nenhum; cenário não persistido</b></div>
          </div>
          <p className={styles.disclaimer}>O painel sinaliza divergências e cenários para avaliação do responsável. Não emite recomendação clínica nem decide o destino de qualquer item.</p>
        </article>
      </section>
    );
  }

  return (
    <div className={styles.appShell}>
      <aside className={styles.sidebar}>
        <a className={styles.brand} href="#inicio" onClick={(event) => { event.preventDefault(); setSecao("hoje"); }}>
          <span className={styles.brandMark}>e</span><span>einsan<small>INTELIGÊNCIA DE ESTOQUE</small></span>
        </a>
        <div className={styles.sidebarLabel}>OPERAÇÃO</div>
        <nav className={styles.navigation} aria-label="Navegação principal">
          {secoes.map((item) => (
            <button key={item.id} className={`${styles.navItem} ${secao === item.id ? styles.navItemActive : ""}`} onClick={() => setSecao(item.id)} aria-current={secao === item.id ? "page" : undefined}>
              <span className={styles.navNumber}>{item.numero}</span>{item.rotulo}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarBottom}>
          <span className={styles.sidebarLabel}>ESTABELECIMENTO</span>
          <label className={styles.locationSelect}>
            <span>{nomeEstabelecimento}</span>
            <select aria-label="Selecionar estabelecimento" value={nomeEstabelecimento} onChange={(event) => {
              const proximoNome = event.target.value;
              setNomeEstabelecimento(proximoNome);
              setEstoqueMinimo(proximoNome === "Farmácia Modelo" ? 120 : 90);
              setEstoqueMaximo(proximoNome === "Farmácia Modelo" ? 360 : 260);
              setNivelServico(proximoNome === "Farmácia Modelo" ? 1.65 : 1.96);
              setSemanasRevisao(proximoNome === "Farmácia Modelo" ? 2 : 1);
            }}>
              <option>Farmácia Modelo</option><option>Clínica Modelo</option>
            </select>
          </label>
          <span className={styles.versionStamp}>PROTÓTIPO · DEMONSTRAÇÃO</span>
        </div>
      </aside>

      <main className={styles.mainArea}>
        <div className={styles.demoNotice}><span>!</span> Dados fictícios para demonstração</div>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}><span>OPERAÇÃO</span><i>/</i><b>{tituloSecao[secao]}</b></div>
          <div className={styles.topbarRight}><span className={styles.dateLabel}>14 nov 2026</span><span className={styles.statusIndicator}><i />Dados locais</span></div>
        </header>
        <div className={styles.content}>
          <div className={styles.pageTitle}>
            <div><span className={styles.kicker}>MEDICAMENTO X <i>·</i> {estabelecimentoAtivo.nome.toUpperCase()}</span><h1>{tituloSecao[secao]}</h1></div>
            {secao === "hoje" && <span className={styles.updatedStamp}>Atualizado com eventos simulados</span>}
          </div>
          {secao === "hoje" && renderHoje()}
          {secao === "estoque" && renderEstoque()}
          {secao === "reposicao" && renderReposicao()}
          {secao === "simulador" && renderSimulador()}
          <footer className={styles.footer}><span>Ferramenta de apoio operacional · Decisão do responsável</span><span>Ambiente local · {seed.eventos.length} eventos</span></footer>
        </div>
      </main>
    </div>
  );
}