
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '@/context/Store';
import { Badge, Card, DataTable, Modal, Sel, type Col } from '@/components/ui';
import { buscarMovimentacoes, registrarMovimentacao, ApiError } from '@/services/api';
import { dataHoraBR, loteLabel, qtdComSinal, tipoMovLabel, tipoMovTone } from '@/utils/apiHelpers';
import type { MovimentacaoApi, NovaMovimentacao, TipoMovApi } from '@/types/api';

// Todos os tipos continuam disponíveis no filtro da tabela.
const TIPOS = Object.keys(tipoMovLabel) as TipoMovApi[];

// Tipos permitidos somente para registrar novas movimentações.
const TIPOS_FORM = TIPOS.filter(
  (t) => t !== 'SAIDA_TRANSFERENCIA' && t !== 'AJUSTE_INVENTARIO'
);

// Novas movimentações são registradas automaticamente como MANUAL.
const vazio = (id: string): NovaMovimentacao => ({
  tipo: 'ENTRADA_COMPRA',
  id_medicamento: id,
  codigo_lote: '',
  quantidade: 1,
  origem_registro: 'MANUAL',
});

export default function Movimentacoes() {
  const { estoque, recarregarApi, toast } = useStore();

  const itens = estoque?.itens ?? [];
  const nomeDe = (id: string) =>
    itens.find((i) => i.id_medicamento === id)?.nome ?? id;

  const lotesDoMed = (id: string) =>
    itens.find((i) => i.id_medicamento === id)?.lotes ?? [];

  const [tipo, setTipo] = useState('Todos'),
    [med, setMed] = useState('Todos'),
    [de, setDe] = useState(''),
    [ate, setAte] = useState('');

  const [rows, setRows] = useState<MovimentacaoApi[]>([]),
    [carr, setCarr] = useState(true),
    [erro, setErro] = useState('');

  const [form, setForm] = useState<NovaMovimentacao | null>(null),
    [enviando, setEnviando] = useState(false),
    [erroForm, setErroForm] = useState('');

  // Recupera o medicamento informado pela URL, quando existir.
  useEffect(() => {
    const m = new URLSearchParams(location.search).get('m');
    if (m) setMed(m);
  }, []);

  // Tipo e medicamento são filtrados no servidor.
  // O intervalo de datas é aplicado localmente.
  const carregar = useCallback(async () => {
    setCarr(true);

    try {
      const r = await buscarMovimentacoes({
        tipo: tipo === 'Todos' ? undefined : tipo,
        id_medicamento: med === 'Todos' ? undefined : med,
        limite: 500,
      });

      setRows(r.movimentacoes);
      setErro('');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarr(false);
    }
  }, [tipo, med]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Converte a data para o padrão brasileiro.
  const dia = (iso: string) =>
    new Date(iso).toLocaleDateString('sv-SE', {
      timeZone: 'America/Sao_Paulo',
    });

  // Aplica os filtros de data.
  const filtradas = rows.filter(
    (m) =>
      (!de || dia(m.timestamp) >= de) &&
      (!ate || dia(m.timestamp) <= ate)
  );

  // Registra uma nova movimentação.
  const enviar = async () => {
    if (!form || enviando) return;

    // Quem fez e o motivo são campos obrigatórios.
    if (!form.usuario_id?.trim() || !form.observacao?.trim()) {
      setErroForm('Informe quem fez a movimentação e o motivo.');
      return;
    }

    setEnviando(true);
    setErroForm('');

    try {
      const body: NovaMovimentacao = {
        ...form,
        validade: form.validade || undefined,
        usuario_id: form.usuario_id?.trim(),
        observacao: form.observacao?.trim(),
      };

      await registrarMovimentacao(body);

      setForm(null);
      toast('Movimentação registrada');

      // Atualiza os dados somente depois da confirmação da API.
      await Promise.all([recarregarApi(), carregar()]);
    } catch (e) {
      const a = e as ApiError;

      setErroForm(
        [a.message, ...(a.detalhes ?? [])].join(' ')
      );
    } finally {
      setEnviando(false);
    }
  };

  // Colunas da tabela de movimentações.
  const cols: Col<MovimentacaoApi>[] = [
    {
      label: 'Data e horário',
      val: (m) => m.timestamp,
      render: (m) => dataHoraBR(m.timestamp),
    },
    {
      label: 'Medicamento',
      val: (m) => nomeDe(m.id_medicamento),
      render: (m) => <b>{nomeDe(m.id_medicamento)}</b>,
    },
    {
      label: 'Tipo',
      val: (m) => m.tipo,
      render: (m) => (
        <Badge tone={tipoMovTone[m.tipo]}>
          {tipoMovLabel[m.tipo]}
        </Badge>
      ),
    },
    {
      label: 'Quantidade',
      val: (m) => m.quantidade,
      render: (m) => qtdComSinal(m.tipo, m.quantidade),
    },
    {
      label: 'Lote',
      val: (m) => m.codigo_lote,
    },
    {
      label: 'Saldo do lote',
      val: (m) => m.saldo_lote_apos,
    },
    {
      label: 'Responsável',
      val: (m) => m.usuario_id ?? '-',
    },
    {
      label: 'Motivo',
      val: (m) => m.observacao ?? '-',
    },
  ];

  // Atualiza os campos do formulário.
  const set = <K extends keyof NovaMovimentacao>(
    k: K,
    v: NovaMovimentacao[K]
  ) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <Card>
      {erro && (
        <div className="note">
          Não foi possível carregar as movimentações ({erro}).{' '}
          <button
            className="btn"
            onClick={() => void carregar()}
          >
            Tentar novamente
          </button>
        </div>
      )}

      <div className="bar">
        {/* O filtro mantém todos os tipos de movimentação. */}
        <Sel
          label="Tipo"
          value={tipo}
          onChange={setTipo}
          opts={['Todos', ...TIPOS]}
        />

        <Sel
          label="Medicamento"
          value={med}
          onChange={setMed}
          opts={[
            'Todos',
            ...itens.map((i) => i.id_medicamento),
          ]}
        />

        <label>
          De
          <input
            type="date"
            value={de}
            onChange={(e) => setDe(e.target.value)}
          />
        </label>

        <label>
          Até
          <input
            type="date"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
          />
        </label>

        <button
          className="btn pri push"
          disabled={!itens.length}
          onClick={() => {
            setErroForm('');
            setForm(vazio(itens[0]?.id_medicamento ?? ''));
          }}
        >
          <Plus size={16} style={{ verticalAlign: -3 }} /> Registrar movimentação
        </button>
      </div>

      {carr && !rows.length ? (
        <p className="j">Carregando…</p>
      ) : (
        <DataTable
          rows={filtradas}
          cols={cols}
          pageSize={10}
        />
      )}

      {form && (
        <Modal
          title="Registrar movimentação"
          onClose={() => !enviando && setForm(null)}
          wide
        >
          <div className="form">
            <label>
              Tipo
              <select
                value={form.tipo}
                onChange={(e) =>
                  setForm((f) =>
                    f
                      ? {
                          ...f,
                          tipo: e.target.value as TipoMovApi,
                          id_recebimento: undefined,
                        }
                      : f
                  )
                }
              >
                {TIPOS_FORM.map((t) => (
                  <option key={t} value={t}>
                    {tipoMovLabel[t]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Medicamento
              <select
                value={form.id_medicamento}
                onChange={(e) =>
                  setForm((f) =>
                    f
                      ? {
                          ...f,
                          id_medicamento: e.target.value,
                          codigo_lote: '',
                          id_recebimento: undefined,
                        }
                      : f
                  )
                }
              >
                {itens.map((i) => (
                  <option key={i.id_medicamento} value={i.id_medicamento}>
                    {i.nome}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Lote
              <input
                value={form.codigo_lote}
                onChange={(e) =>
                  setForm((f) =>
                    f
                      ? {
                          ...f,
                          codigo_lote: e.target.value,
                          id_recebimento: undefined,
                        }
                      : f
                  )
                }
                list="lotes-do-med"
              />
              <datalist id="lotes-do-med">
                {lotesDoMed(form.id_medicamento).map((l) => (
                  <option
                    key={l.id_recebimento}
                    value={l.codigo_lote}
                    label={`Recebido em ${dataHoraBR(l.primeira_entrada)}`}
                  />
                ))}
              </datalist>
            </label>

            {!form.tipo.startsWith('ENTRADA') && (
              <label>
                Recebimento de origem
                <select
                  value={form.id_recebimento ?? ''}
                  onChange={(e) =>
                    set('id_recebimento', e.target.value || undefined)
                  }
                >
                  <option value="">Selecione o recebimento</option>
                  {lotesDoMed(form.id_medicamento)
                    .filter((l) => l.codigo_lote === form.codigo_lote)
                    .map((l) => (
                      <option key={l.id_recebimento} value={l.id_recebimento}>
                        {l.codigo_lote} · {dataHoraBR(l.primeira_entrada)} ·{' '}
                        {l.quantidade} un. · {loteLabel[l.status]}
                      </option>
                    ))}
                </select>
              </label>
            )}

            <label>
              Quantidade
              <input
                type="number"
                step={1}
                value={form.quantidade}
                onChange={(e) =>
                  set('quantidade', Math.trunc(+e.target.value))
                }
              />
            </label>

            {form.tipo.startsWith('ENTRADA') && (
              <label>
                Validade (obrigatória em cada recebimento)
                <input
                  type="date"
                  value={form.validade ?? ''}
                  onChange={(e) => set('validade', e.target.value)}
                />
              </label>
            )}

            <label>
              Quem fez
              <input
                value={form.usuario_id ?? ''}
                onChange={(e) => set('usuario_id', e.target.value)}
              />
            </label>

            <label className="full">
              Por que fez
              <textarea
                rows={3}
                value={form.observacao ?? ''}
                onChange={(e) => set('observacao', e.target.value)}
              />
            </label>

            {erroForm && (
              <p className="note full" role="alert">
                {erroForm}
              </p>
            )}

            <div className="acts full">
              <button
                className="btn"
                disabled={enviando}
                onClick={() => setForm(null)}
              >
                Cancelar
              </button>

              <button
                className="btn pri"
                disabled={enviando}
                onClick={() => void enviar()}
              >
                {enviando ? 'Enviando…' : 'Registrar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}
