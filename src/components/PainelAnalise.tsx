import type {
  AcaoCompra,
  AnaliseResponse,
  Severidade,
  AvaliacaoTermica,
} from "@/types/dominio";
import Badge, { type TomBadge } from "./Badge";
import CartaoResumo from "./CartaoResumo";
import styles from "./PainelAnalise.module.css";
import { formatarBRL, formatarData, formatarDataHora, formatarDuracao, formatarNumero } from "@/lib/formato";

type Props = { analise: AnaliseResponse };

const rotulosUrgencia: Record<Severidade, string> = {
  CRITICA: "Crítica",
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
};

const tonsUrgencia: Record<Severidade, TomBadge> = {
  CRITICA: "critica",
  ALTA: "alta",
  MEDIA: "media",
  BAIXA: "baixa",
};

const rotulosAcao: Record<AcaoCompra, string> = {
  COMPRAR_IMEDIATAMENTE: "Comprar imediatamente",
  COMPRAR_NO_CICLO_ATUAL: "Comprar no ciclo atual",
  PLANEJAR_REPOSICAO: "Planejar reposição",
  MONITORAR: "Monitorar",
};

const rotulosStatusTermico: Record<AvaliacaoTermica["status"], string> = {
  CONFORME: "Conforme",
  EXCURSAO_TOLERADA: "Excursão tolerada",
  LOTES_INVALIDADOS: "Lotes invalidados",
};

const tomStatusTermico: Record<AvaliacaoTermica["status"], TomBadge> = {
  CONFORME: "ok",
  EXCURSAO_TOLERADA: "media",
  LOTES_INVALIDADOS: "critica",
};

const rotulosFator = {
  preco: "Preço efetivo",
  prazo: "Prazo e cobertura",
  confiabilidade: "Confiabilidade de entrega",
  validade: "Validade garantida",
} as const;

const rotulosMovimento = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  DISPENSACAO: "Dispensação",
  TRANSFERENCIA: "Transferência",
  AJUSTE: "Ajuste",
  VALIDADE: "Validade",
  EXCURSAO_TERMICA: "Excursão térmica",
} as const;

function SeloMotor({ versao }: { versao: string }) {
  return <span className={styles.seloMotor}>Motor Einsan (regras {versao})</span>;
}

function TextoTemperatura({ valor }: { valor: number | null }) {
  return <>{valor === null ? "Não disponível" : `${formatarNumero(valor, 1)} °C`}</>;
}

function GraficoImpacto({ pontos }: { pontos: AnaliseResponse["recomendacoes_compra"][number]["impacto"]["simulacao_30_dias"]["pontos_diarios"] }) {
  const maximo = Math.max(1, ...pontos.flatMap((ponto) => [ponto.estoque_sem_acao, ponto.estoque_com_recomendacao]));
  const coordenadas = (valor: number, indice: number) => {
    const x = 8 + (indice * 384) / Math.max(1, pontos.length - 1);
    const y = 104 - (valor / maximo) * 92;
    return `${x},${y}`;
  };
  const semAcao = pontos.map((ponto, indice) => coordenadas(ponto.estoque_sem_acao, indice)).join(" ");
  const comRecomendacao = pontos.map((ponto, indice) => coordenadas(ponto.estoque_com_recomendacao, indice)).join(" ");

  return (
    <div className={styles.graficoImpacto}>
      <svg viewBox="0 0 400 112" role="img" aria-label="Projeção de estoque em 30 dias, sem ação versus com recomendação">
        <line x1="8" y1="104" x2="392" y2="104" className={styles.eixoImpacto} />
        <polyline points={semAcao} className={styles.linhaSemAcao} />
        <polyline points={comRecomendacao} className={styles.linhaComAcao} />
      </svg>
      <div className={styles.legendaImpacto}><span><i className={styles.amostraSemAcao} />Sem ação</span><span><i className={styles.amostraComAcao} />Com recomendação</span></div>
    </div>
  );
}

function periodoExcursao(avaliacao: AvaliacaoTermica): string {
  if (!avaliacao.inicio_excursao && !avaliacao.fim_excursao && !avaliacao.excursao_em_andamento) {
    return "Sem excursão";
  }

  const inicio = avaliacao.inicio_excursao ? formatarDataHora(avaliacao.inicio_excursao) : "Início não informado";
  if (avaliacao.excursao_em_andamento) return `${inicio} · em andamento`;
  const fim = avaliacao.fim_excursao ? formatarDataHora(avaliacao.fim_excursao) : "Fim não informado";
  return `${inicio} – ${fim}`;
}

function PainelAlertas({ analise }: Props) {
  const { risco_termico: riscosTermicos, movimentacao_nao_identificada: divergencias } = analise.alertas;

  return (
    <section className={styles.secao} id="alertas" aria-labelledby="titulo-alertas">
      <div className={styles.tituloSecao}>
        <div><p className={styles.sobretitulo}>SINAIS DO COFRE</p><h2 id="titulo-alertas">Alertas</h2></div>
        <SeloMotor versao={analise.meta.versao_regras} />
      </div>
      {riscosTermicos.length === 0 && divergencias.length === 0 ? (
        <p className={styles.vazio}>Nenhum alerta retornado pela análise.</p>
      ) : (
        <div className={styles.alertasGrid}>
          {riscosTermicos.map((alerta, indice) => (
            <article className={`${styles.cartaoAlerta} ${styles.alertaCritico}`} key={`${alerta.id_medicamento}-${indice}`}>
              <div className={styles.linhaAlerta}><Badge tom="critica">Risco térmico · {alerta.severidade}</Badge><span className={styles.idMedicamento}>{alerta.id_medicamento}</span></div>
              <h3>{alerta.nome}</h3>
              <dl className={styles.dadosAlerta}>
                <div><dt>Exposição / limite</dt><dd>{alerta.minutos_fora_da_faixa} / {alerta.limite_exposicao_minutos} min</dd></div>
                <div><dt>Temperatura máxima</dt><dd><TextoTemperatura valor={alerta.temperatura_maxima_registrada} /></dd></div>
                <div><dt>Lotes invalidados</dt><dd>{alerta.lotes_invalidados.length ? alerta.lotes_invalidados.join(", ") : "Nenhum lote listado"}</dd></div>
                <div><dt>Unidades invalidadas</dt><dd>{alerta.unidades_invalidadas}</dd></div>
              </dl>
              <p className={styles.mensagemApi}>{alerta.mensagem}</p>
            </article>
          ))}
          {divergencias.map((alerta, indice) => (
            <article className={`${styles.cartaoAlerta} ${styles.alertaAlta}`} key={`${alerta.porta_aberta_em}-${indice}`}>
              <div className={styles.linhaAlerta}><Badge tom="alta">Movimentação não identificada · {alerta.severidade}</Badge></div>
              <h3>Evento de porta</h3>
              <dl className={styles.dadosAlerta}>
                <div><dt>Porta aberta</dt><dd>{formatarDataHora(alerta.porta_aberta_em)}</dd></div>
                <div><dt>Porta fechada</dt><dd>{formatarDataHora(alerta.porta_fechada_em)}</dd></div>
                <div><dt>Duração</dt><dd>{formatarDuracao(alerta.duracao_segundos)}</dd></div>
                <div><dt>Usuário</dt><dd>{alerta.usuario_biometria_id ?? "Não informado"}</dd></div>
              </dl>
              <p className={styles.mensagemApi}>{alerta.mensagem}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AvaliacoesTermicas({ analise }: Props) {
  return (
    <section className={styles.secao} id="avaliacao-termica" aria-labelledby="titulo-termico">
      <div className={styles.tituloSecao}>
        <div><p className={styles.sobretitulo}>EXPOSIÇÃO REGISTRADA</p><h2 id="titulo-termico">Avaliação térmica por medicamento</h2></div>
        <SeloMotor versao={analise.meta.versao_regras} />
      </div>
      {analise.avaliacoes_termicas.length === 0 ? <p className={styles.vazio}>Nenhuma avaliação térmica retornada.</p> : (
        <div className={styles.tabelaRolagem}>
          <table className={styles.tabelaTermica}>
            <thead><tr><th>Medicamento</th><th>Faixa da bula</th><th>Fora da faixa / limite</th><th>Exposição</th><th>Máx. / mín.</th><th>Período da excursão</th><th>Status</th></tr></thead>
            <tbody>{analise.avaliacoes_termicas.map((avaliacao) => {
              const razao = avaliacao.limite_exposicao_minutos > 0
                ? avaliacao.minutos_fora_da_faixa / avaliacao.limite_exposicao_minutos
                : 0;
              return (
                <tr key={avaliacao.id_medicamento}>
                  <td><strong>{avaliacao.nome}</strong><small>{avaliacao.id_medicamento}</small></td>
                  <td>{formatarNumero(avaliacao.faixa_bula_celsius.min, 1)}–{formatarNumero(avaliacao.faixa_bula_celsius.max, 1)} °C</td>
                  <td>{avaliacao.minutos_fora_da_faixa} / {avaliacao.limite_exposicao_minutos} min</td>
                  <td>
                    <div className={styles.barraExposicao} aria-label={`${Math.round(razao * 100)}% do limite de exposição`}>
                      <span className={razao > 1 ? styles.excesso : ""} style={{ width: `${Math.min(100, Math.max(0, razao * 100))}%` }} />
                    </div>
                    {razao > 1 && <small className={styles.textoExcesso}>Acima do limite</small>}
                  </td>
                  <td><TextoTemperatura valor={avaliacao.temperatura_maxima_registrada} /> / <TextoTemperatura valor={avaliacao.temperatura_minima_registrada} /></td>
                  <td>{periodoExcursao(avaliacao)}</td>
                  <td><Badge tom={tomStatusTermico[avaliacao.status]}>{rotulosStatusTermico[avaliacao.status]}</Badge></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CartaoRecomendacao({ analise, indice }: Props & { indice: number }) {
  const recomendacao = analise.recomendacoes_compra[indice];
  const estoque = recomendacao.estoque;
  const impacto = recomendacao.impacto;
  const confiancaTom: TomBadge = recomendacao.qualidade_dados.nivel_confianca === "ALTO"
    ? "ok"
    : recomendacao.qualidade_dados.nivel_confianca === "MEDIO" ? "media" : "critica";

  return (
    <article className={styles.cartaoRecomendacao}>
      <div className={styles.cabecalhoRecomendacao}>
        <div><span className={styles.idMedicamento}>{recomendacao.id_medicamento}</span><h3>{recomendacao.nome}</h3></div>
        <div className={styles.badgesRecomendacao}>
          <Badge tom={tonsUrgencia[recomendacao.urgencia]}>Urgência {rotulosUrgencia[recomendacao.urgencia]}</Badge>
          <Badge tom={recomendacao.recomendar_compra ? "neutro" : "ok"}>{recomendacao.recomendar_compra ? "Compra recomendada" : "Sem compra recomendada"}</Badge>
        </div>
      </div>
      <div className={styles.resumoRecomendacao}>
        <div><span>Ação</span><strong>{rotulosAcao[recomendacao.acao]}</strong></div>
        <div><span>{recomendacao.faixa_quantidade ? "Faixa de quantidade" : "Quantidade"}</span><strong>{recomendacao.faixa_quantidade ? `${recomendacao.faixa_quantidade.minimo}–${recomendacao.faixa_quantidade.maximo} un. · conservadora ${recomendacao.faixa_quantidade.conservadora}` : `${recomendacao.quantidade_sugerida} un.`}</strong></div>
        <div><span>Custo estimado</span><strong>{formatarBRL(recomendacao.custo_estimado_brl)}</strong></div>
        <div><span>Cobertura / prazo</span><strong>{recomendacao.cobertura_dias === null ? "Desconhecida" : `${recomendacao.cobertura_dias} dias`} / {recomendacao.prazo_reposicao_dias} dias</strong></div>
      </div>
      {recomendacao.fornecedor_recomendado && (
        <div className={styles.fornecedorDestaque}>
          <div>
            <span>Fornecedor recomendado · simulado</span>
            <strong>{recomendacao.fornecedor_recomendado.nome}</strong>
          </div>
          <div>
            <span>Pedido ajustado</span>
            <strong>{recomendacao.fornecedor_recomendado.quantidade_pedida} un.</strong>
          </div>
          <div>
            <span>Entrega</span>
            <strong>{recomendacao.fornecedor_recomendado.prazo_entrega_dias} dias</strong>
          </div>
          {recomendacao.fornecedor_recomendado.dias_sem_estoque_previstos > 0 && (
            <Badge tom="alta">{recomendacao.fornecedor_recomendado.dias_sem_estoque_previstos} dias sem cobertura</Badge>
          )}
          {recomendacao.fornecedor_recomendado.atraso_vs_prazo_reposicao_dias > 0 && (
            <Badge tom="media">{recomendacao.fornecedor_recomendado.atraso_vs_prazo_reposicao_dias} dias além do lead interno</Badge>
          )}
          <Badge tom="neutro">Dados simulados</Badge>
        </div>
      )}
      {recomendacao.cobertura_dias === null && <p className={styles.avisoCobertura}>Cobertura desconhecida: sem consumo médio cadastrado.</p>}
      <details className={styles.detalheRecomendacao}>
        <summary>Detalhes do estoque e justificativas <span aria-hidden="true">＋</span></summary>
        <div className={styles.conteudoDetalhe}>
          <div className={styles.rotuloOrigem}><SeloMotor versao={analise.meta.versao_regras} /></div>
          <section className={styles.grupoEstoque} aria-label={`Detalhamento do estoque de ${recomendacao.nome}`}>
            <h4>Estoque retornado pelo motor</h4>
            <div className={styles.metricasEstoque}>
              <div><span>Bruto</span><strong>{estoque.bruto} un.</strong></div>
              <div><span>Invalidado térmico</span><strong>{estoque.invalidado_termico} un.</strong></div>
              <div><span>Vencido</span><strong>{estoque.vencido} un.</strong></div>
              <div><span>Em risco de vencimento</span><strong>{estoque.em_risco_de_vencimento} un.</strong></div>
              <div className={styles.estoqueUtil}><span>Útil</span><strong>{estoque.util} un.</strong><small>± incerteza: {estoque.margem_incerteza_divergencia} un.</small></div>
              <div><span>Validade mínima exigida</span><strong>{recomendacao.validade_minima_exigida_dias} dias</strong></div>
            </div>
            <p className={styles.notaEstoque}>Valores exibidos individualmente como recebidos; não representam uma relação aritmética entre campos.</p>
          </section>
          <section className={styles.grupoDetalhe}>
            <div className={styles.tituloQualidade}><h4>Consumo e qualidade dos dados</h4><Badge tom="neutro">Dados simulados</Badge></div>
            <div className={styles.consumoResumo}>
              <div><span>Consumo usado</span><strong>{formatarNumero(recomendacao.consumo.consumo_usado, 2)} un./dia</strong><small>{recomendacao.consumo.tendencia.replace("_", " ")}</small></div>
              <div><span>Últimos 7 dias</span><strong>{formatarNumero(recomendacao.consumo.consumo_7d, 1)} un.</strong></div>
              <div><span>Últimos 30 dias</span><strong>{formatarNumero(recomendacao.consumo.consumo_30d, 1)} un.</strong></div>
            </div>
            {recomendacao.consumo.justificativa_fallback && <p className={styles.tradeoffFornecedor}>{recomendacao.consumo.justificativa_fallback}</p>}
            {recomendacao.consumo.atipicos_detectados.length > 0 && (
              <div className={styles.atipicosBox}>
                <strong>Picos isolados excluídos da projeção</strong>
                <ul className={styles.listaPremissas}>{recomendacao.consumo.atipicos_detectados.map((atipico) => <li key={atipico.id_movimento}>{atipico.id_movimento} · {atipico.quantidade} un. · {formatarDataHora(atipico.timestamp)} · {atipico.motivo}</li>)}</ul>
              </div>
            )}
            <div className={styles.qualidadePainel}>
              <div className={styles.tituloQualidade}><strong>Confiança {recomendacao.qualidade_dados.nivel_confianca}</strong><Badge tom={confiancaTom}>{recomendacao.qualidade_dados.nivel_confianca}</Badge></div>
              <p>{recomendacao.qualidade_dados.motivo_confianca}</p>
              <div className={styles.qualidadeNumeros}>
                <span>Saídas com lote: <b>{recomendacao.qualidade_dados.percentual_saidas_lote_identificado}%</b></span>
                <span>Histórico: <b>{recomendacao.qualidade_dados.dias_historico} dias</b></span>
                <span>Manuais/sem leitura: <b>{recomendacao.qualidade_dados.movimentacoes_manuais_ou_sem_leitura}</b></span>
                <span>Divergências abertas: <b>{recomendacao.qualidade_dados.divergencias_abertas}</b></span>
              </div>
            </div>
          </section>
          <section className={styles.grupoDetalhe}>
            <h4>Lotes em risco de vencimento</h4>
            {recomendacao.lotes_em_risco_de_vencimento.length ? (
              <ul className={styles.listaLotes}>{recomendacao.lotes_em_risco_de_vencimento.map((lote) => <li key={lote}>{lote}</li>)}</ul>
            ) : <p className={styles.semLotes}>Nenhum lote listado.</p>}
          </section>
          <section className={styles.grupoDetalhe}>
            <h4>Justificativas do motor</h4>
            {recomendacao.justificativas.length ? (
              <ul className={styles.justificativas}>{recomendacao.justificativas.map((justificativa, posicao) => <li key={`${posicao}-${justificativa}`}>{justificativa}</li>)}</ul>
            ) : <p className={styles.semLotes}>Nenhuma justificativa retornada.</p>}
          </section>
          <section className={styles.grupoDetalhe}>
            <h4>Previsão rastreável</h4>
            <div className={styles.previsaoGrid}>
              <div><span>Ruptura prevista</span><strong>{recomendacao.previsao.data_prevista_ruptura ? formatarDataHora(recomendacao.previsao.data_prevista_ruptura) : "Sem estimativa de consumo"}</strong></div>
              <div><span>Data limite do pedido</span><strong>{recomendacao.previsao.data_limite_pedido ? formatarDataHora(recomendacao.previsao.data_limite_pedido) : "Indeterminada"}</strong></div>
              <div><span>Status do pedido</span><strong>{recomendacao.previsao.pedido_atrasado ? `Atrasado ${recomendacao.previsao.dias_atraso} dias` : "Dentro do prazo"}</strong></div>
              <div><span>Dias sem estoque previstos</span><strong>{recomendacao.previsao.dias_sem_estoque_previstos ?? "Indeterminado"}</strong></div>
              <div><span>Perda por vencimento</span><strong>{recomendacao.previsao.perda_prevista_por_vencimento.unidades} un. · {formatarBRL(recomendacao.previsao.perda_prevista_por_vencimento.valor_brl)}</strong></div>
              <div><span>Perda por invalidação térmica</span><strong>{recomendacao.previsao.perda_por_invalidacao_termica.unidades} un. · {formatarBRL(recomendacao.previsao.perda_por_invalidacao_termica.valor_brl)}</strong></div>
              <div><span>Custo de esperar {recomendacao.previsao.custo_de_esperar.atraso_simulado_dias} dias</span><strong>{recomendacao.previsao.custo_de_esperar.valor_brl === null ? "Indeterminado" : formatarBRL(recomendacao.previsao.custo_de_esperar.valor_brl)}</strong></div>
            </div>
            <ul className={styles.listaPremissas}>{recomendacao.previsao.premissas.map((premissa) => <li key={premissa}>{premissa}</li>)}</ul>
            <h5>Memória de cálculo da quantidade</h5>
            <ul className={styles.listaPremissas}>{recomendacao.justificativa_quantidade.map((passo) => <li key={passo}>{passo}</li>)}</ul>
          </section>
          {recomendacao.recomendar_compra && (
            <section className={styles.grupoFornecedor}>
              <div className={styles.cabecalhoFornecedor}>
                <div><p className={styles.sobretitulo}>CAMADA DE AQUISIÇÃO</p><h4>Fornecedores e critérios</h4></div>
                <Badge tom="neutro">Dados simulados</Badge>
              </div>
              <p className={styles.notaReferencia}>Referência histórica de compra: {recomendacao.preco_referencia_brl === null ? "não disponível" : `${formatarBRL(recomendacao.preco_referencia_brl)}/un.`} {recomendacao.fonte_preco_referencia ?? "Sem fonte de referência."} O custo legado de referência para o pedido é {formatarBRL(recomendacao.custo_referencia_brl)}.</p>
              {recomendacao.fornecedor_recomendado ? (
                <>
                  <div className={styles.destaqueFornecedorDetalhe}>
                    <div><span>Recomendado</span><strong>{recomendacao.fornecedor_recomendado.nome}</strong></div>
                    <div><span>Preço ofertado / efetivo</span><strong>{formatarBRL(recomendacao.fornecedor_recomendado.preco_unitario_brl)} / {formatarBRL(recomendacao.fornecedor_recomendado.preco_efetivo_unitario_brl)} por un.</strong></div>
                    <div><span>Pedido e total calculado</span><strong>{recomendacao.fornecedor_recomendado.quantidade_pedida} un. · {formatarBRL(recomendacao.fornecedor_recomendado.custo_estimado_total_brl)}</strong></div>
                    <div><span>Entrega / cadeia fria</span><strong>{recomendacao.fornecedor_recomendado.prazo_entrega_dias} dias · {recomendacao.fornecedor_recomendado.cadeia_fria_certificada ? "certificada" : "não certificada"}</strong></div>
                    <div><span>Pagamento escolhido</span><strong>{recomendacao.fornecedor_recomendado.pagamento_escolhido === "A_VISTA" ? `À vista (${recomendacao.fornecedor_recomendado.condicoes_pagamento.desconto_a_vista_pct}% de desconto)` : `A prazo · ${recomendacao.fornecedor_recomendado.condicoes_pagamento.prazo_dias} dias`}</strong></div>
                    <div><span>Confiabilidade simulada</span><strong>{recomendacao.fornecedor_recomendado.confiabilidade_entrega_pct}%</strong></div>
                    {recomendacao.fornecedor_recomendado.excesso_por_minimo_pedido > 0 && <div><span>Excesso por mínimo</span><strong>+{recomendacao.fornecedor_recomendado.excesso_por_minimo_pedido} un.</strong></div>}
                  </div>
                  <h5>Por que este fornecedor</h5>
                  <ul className={styles.justificativas}>{recomendacao.justificativa_fornecedor.map((frase) => <li key={frase}>{frase}</li>)}</ul>
                  {recomendacao.por_que_nao_o_mais_barato && <p className={styles.tradeoffFornecedor}>{recomendacao.por_que_nao_o_mais_barato}</p>}
                  <h5>Contribuição dos fatores na pontuação</h5>
                  <div className={styles.fatoresLista}>{recomendacao.fatores_decisao.map((fator) => (
                    <div className={styles.fatorLinha} key={fator.fator}>
                      <div className={styles.fatorRotulo}><strong>{rotulosFator[fator.fator]}</strong><span>Peso {formatarNumero(fator.peso_pct, 0)}% · {fator.valor}</span></div>
                      <div className={styles.fatorBarra} aria-label={`${rotulosFator[fator.fator]}: ${formatarNumero(fator.pontuacao_normalizada * 100, 0)}%`}><span style={{ width: `${Math.min(100, Math.max(0, fator.pontuacao_normalizada * 100))}%` }} /></div>
                      <small>{fator.efeito}</small>
                    </div>
                  ))}</div>
                  {recomendacao.alternativas_fornecedor.length > 0 && (
                    <>
                      <h5>Alternativas elegíveis</h5>
                      <ul className={styles.alternativasFornecedor}>{recomendacao.alternativas_fornecedor.map((alternativa) => <li key={alternativa.id_fornecedor}><strong>{alternativa.nome}</strong>: {formatarBRL(alternativa.custo_estimado_total_brl)} ({alternativa.diferenca_preco_vs_recomendado_brl >= 0 ? "+" : ""}{formatarBRL(alternativa.diferenca_preco_vs_recomendado_brl)}), entrega {alternativa.diferenca_prazo_vs_recomendado_dias >= 0 ? "+" : ""}{alternativa.diferenca_prazo_vs_recomendado_dias} dias vs. recomendada.</li>)}</ul>
                    </>
                  )}
                </>
              ) : <p className={styles.tradeoffFornecedor}>Nenhum fornecedor atende aos critérios eliminatórios. {recomendacao.motivo_sem_fornecedor}</p>}
              {recomendacao.fornecedores_excluidos.length > 0 && (
                <>
                  <h5>Fornecedores excluídos</h5>
                  <ul className={styles.alternativasFornecedor}>{recomendacao.fornecedores_excluidos.map((excluido) => <li key={excluido.id_fornecedor}><strong>{excluido.nome}</strong>: {excluido.motivo}</li>)}</ul>
                </>
              )}
            </section>
          )}
          <section className={styles.grupoDetalhe}>
            <div className={styles.tituloQualidade}><h4>Rastreabilidade por lote</h4><Badge tom="neutro">Dados simulados</Badge></div>
            <p className={styles.notaRastreabilidade}>Movimentações pseudonimizadas; saldos reconstruídos são comparados ao estoque informado.</p>
            <div className={styles.qualidadeNumeros}>
              <span>Saídas sem lote: <b>{recomendacao.rastreabilidade.saidas_sem_lote_nao_atribuidas} un.</b></span>
              <span>Divergências por lote: <b>{recomendacao.rastreabilidade.divergencias_lote_abertas}</b></span>
              <span>Incerteza usada: <b>± {recomendacao.rastreabilidade.margem_incerteza_unidades} un.</b></span>
            </div>
            {!recomendacao.rastreabilidade.dados_lote_disponiveis && <p className={styles.semLotes}>Sem livro de movimentações por lote; aplicada a margem legada.</p>}
            <div className={styles.listaRastreabilidade}>
              {recomendacao.rastreabilidade.lotes.map((lote) => (
                <article className={styles.loteRastreado} key={lote.codigo_lote}>
                  <div className={styles.loteRastreadoTitulo}>
                    <div><strong>{lote.codigo_lote}</strong><span>Validade {formatarData(lote.validade)}</span></div>
                    <Badge tom={lote.divergencia_unidades === 0 ? "ok" : "alta"}>{lote.divergencia_unidades === 0 ? "Saldo reconciliado" : `Divergência ${lote.divergencia_unidades > 0 ? "+" : ""}${lote.divergencia_unidades} un.`}</Badge>
                  </div>
                  <div className={styles.saldosLote}>
                    <span>Estoque informado <b>{lote.saldo_estoque_cofre} un.</b></span>
                    <span>Saldo reconstruído <b>{lote.saldo_reconstruido} un.</b></span>
                  </div>
                  {lote.eventos.length ? (
                    <ol className={styles.eventosLote}>{lote.eventos.map((evento, posicao) => (
                      <li key={`${lote.codigo_lote}-${evento.timestamp}-${evento.tipo}-${posicao}`}>
                        <time>{formatarDataHora(evento.timestamp)}</time>
                        <span><b>{rotulosMovimento[evento.tipo]}</b> · {evento.detalhe}{evento.quantidade === null ? "" : ` · ${evento.quantidade} un.`}{evento.usuario_biometria_id ? ` · ${evento.usuario_biometria_id}` : ""}</span>
                      </li>
                    ))}</ol>
                  ) : <p className={styles.semLotes}>Sem eventos atribuídos a este lote.</p>}
                </article>
              ))}
            </div>
          </section>
          <section className={styles.grupoDetalhe}>
            <h4>Impacto projetado · 30 dias</h4>
            <div className={styles.impactoResumo}>
              <div><span>Capital imobilizado útil</span><strong>{formatarBRL(impacto.capital_imobilizado_brl)}</strong></div>
              <div><span>Capital excedente</span><strong>{formatarBRL(impacto.capital_excedente_brl)}</strong></div>
              <div><span>Falta evitada</span><strong>{impacto.perdas_evitadas.falta.unidades} un. · {formatarBRL(impacto.perdas_evitadas.falta.valor_brl)}</strong></div>
              <div><span>Vencimento evitado</span><strong>{impacto.perdas_evitadas.vencimento.unidades} un. · {formatarBRL(impacto.perdas_evitadas.vencimento.valor_brl)}</strong></div>
            </div>
            <div className={styles.cenariosImpacto}>
              <div><strong>Sem ação</strong><span>{impacto.simulacao_30_dias.sem_acao.dias_sem_estoque} dias sem estoque · {formatarNumero(impacto.simulacao_30_dias.sem_acao.unidades_vencidas)} un. vencidas</span><small>Capital médio parado: {formatarBRL(impacto.simulacao_30_dias.sem_acao.capital_medio_parado_brl)}</small></div>
              <div><strong>Com recomendação</strong><span>{impacto.simulacao_30_dias.com_recomendacao.dias_sem_estoque} dias sem estoque · {formatarNumero(impacto.simulacao_30_dias.com_recomendacao.unidades_vencidas)} un. vencidas</span><small>Capital médio parado: {formatarBRL(impacto.simulacao_30_dias.com_recomendacao.capital_medio_parado_brl)}</small></div>
            </div>
            <GraficoImpacto pontos={impacto.simulacao_30_dias.pontos_diarios} />
            <ul className={styles.listaPremissas}>{impacto.simulacao_30_dias.premissas.map((premissa) => <li key={premissa}>{premissa}</li>)}</ul>
          </section>
        </div>
      </details>
    </article>
  );
}

export default function PainelAnalise({ analise }: Props) {
  const { meta, resumo } = analise;
  const tomGeral: TomBadge = resumo.status_geral === "CRITICO" ? "critica" : resumo.status_geral === "ATENCAO" ? "media" : "ok";
  const rotuloGeral = resumo.status_geral === "CRITICO" ? "Crítico" : resumo.status_geral === "ATENCAO" ? "Atenção" : "Normal";

  return (
    <main className={styles.pagina}>
      <div className={styles.avisoDemonstracao}><span aria-hidden="true">i</span> Análise do Cofre Inteligente · dados locais do projeto</div>
      <header className={styles.cabecalho}>
        <div className={styles.marca}><span className={styles.marcaIcone}>M</span><div><p>MEDICAL SECURITY</p><h1>Medical Security <span>×</span> Bulário Anvisa</h1></div></div>
        <div className={styles.metadados}>
          <div><span>Cofre</span><strong>{meta.cofre_id}</strong></div>
          <div><span>Data de referência</span><strong>{formatarDataHora(meta.data_referencia)}</strong></div>
          <div><span>Análise gerada</span><strong>{formatarDataHora(meta.gerado_em)}</strong></div>
          <div><span>Regras</span><strong>{meta.versao_regras}</strong></div>
          <Badge tom={meta.porta_atualmente_aberta ? "alta" : "ok"}>{meta.porta_atualmente_aberta ? "Porta aberta" : "Porta fechada"}</Badge>
        </div>
      </header>

      <div className={`${styles.faixaStatus} ${styles[`status_${resumo.status_geral.toLowerCase()}`]}`} role="status">
        <Badge tom={tomGeral}>Status geral: {rotuloGeral}</Badge>
        <span>{meta.total_eventos_analisados} eventos analisados</span>
        <span>{meta.ciclos_porta_analisados} ciclos de porta</span>
        <SeloMotor versao={meta.versao_regras} />
      </div>

      <div className={styles.conteudo}>
        <section className={styles.secao} id="resumo" aria-labelledby="titulo-resumo">
          <div className={styles.tituloSecao}>
            <div><p className={styles.sobretitulo}>RESUMO DA ANÁLISE</p><h2 id="titulo-resumo">Visão geral</h2></div>
            <SeloMotor versao={meta.versao_regras} />
          </div>
          <div className={styles.gradeResumo}>
            <CartaoResumo rotulo="Total de alertas" valor={resumo.total_alertas} detalhe="Risco térmico e divergências de estoque" destaque={resumo.total_alertas > 0} />
            <CartaoResumo rotulo="Lotes invalidados" valor={resumo.lotes_invalidados} detalhe="Conforme avaliação térmica" destaque={resumo.lotes_invalidados > 0} />
            <CartaoResumo rotulo="Unidades invalidadas" valor={resumo.unidades_invalidadas} detalhe="Conforme avaliação térmica" />
            <CartaoResumo rotulo="Divergências de estoque" valor={resumo.divergencias_estoque} detalhe="Movimentações não identificadas" />
            <CartaoResumo rotulo="Medicamentos com compra" valor={resumo.medicamentos_com_compra_recomendada} detalhe="Recomendações do motor" />
            <CartaoResumo rotulo="Custo recomendado" valor={formatarBRL(resumo.custo_total_recomendado_brl)} detalhe="Total retornado pela análise" />
            <CartaoResumo rotulo="Próxima ruptura prevista" valor={resumo.proxima_ruptura ? formatarDataHora(resumo.proxima_ruptura) : "Sem estimativa"} detalhe="Derivada da cobertura e do consumo atual" />
          </div>
        </section>

        <PainelAlertas analise={analise} />
        <AvaliacoesTermicas analise={analise} />

        <section className={styles.secao} id="recomendacoes" aria-labelledby="titulo-recomendacoes">
          <div className={styles.tituloSecao}>
            <div><p className={styles.sobretitulo}>DECISÕES DE ESTOQUE</p><h2 id="titulo-recomendacoes">Recomendações de compra</h2></div>
            <SeloMotor versao={meta.versao_regras} />
          </div>
          {analise.recomendacoes_compra.length === 0 ? <p className={styles.vazio}>Nenhuma recomendação de compra retornada.</p> : (
            <div className={styles.listaRecomendacoes}>
              {analise.recomendacoes_compra.map((recomendacao, indice) => (
                <CartaoRecomendacao key={`${recomendacao.id_medicamento}-${indice}`} analise={analise} indice={indice} />
              ))}
            </div>
          )}
        </section>
      </div>
      <footer className={styles.rodape}><span>Medical Security × Bulário Anvisa</span><span>Fonte dos indicadores: Motor Einsan · {meta.versao_regras}</span></footer>
    </main>
  );
}