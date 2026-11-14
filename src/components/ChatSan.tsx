'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCcw, SendHorizontal, X } from 'lucide-react';
import { SanIcone } from '@/components/SanIcone';
import styles from './ChatSan.module.css';

type Mensagem = { id: number; autor: 'san' | 'usuario'; texto: string; hora: string };
type Resumo = { rotulo: string; valor: string };

type Props = {
  titulo: string;
  mensagemInicial: string;
  /** Dados-chave da recomendação, exibidos como cartões no topo da conversa. */
  resumo?: Resumo[];
  sugestoes?: string[];
  /** Gera a resposta simulada do San para a pergunta do usuário. */
  responder: (pergunta: string) => string;
  onClose: () => void;
};

const agora = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

/** Chat lateral que simula uma conversa com o San (sem chamada real a IA). */
export function ChatSan({ titulo, mensagemInicial, resumo = [], sugestoes = [], responder, onClose }: Props) {
  const inicial = (): Mensagem[] => [{ id: 0, autor: 'san', texto: mensagemInicial, hora: agora() }];
  const [mensagens, setMensagens] = useState<Mensagem[]>(inicial);
  const [texto, setTexto] = useState('');
  const [digitando, setDigitando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const proximoId = useRef(1);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [mensagens, digitando]);
  useEffect(() => { campo.current?.focus(); }, []);
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onClose]);

  const ajustarAltura = () => {
    const el = campo.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const enviar = (bruto: string) => {
    const pergunta = bruto.trim();
    if (!pergunta || digitando) return;
    const idUsuario = proximoId.current++;
    setMensagens((atual) => [...atual, { id: idUsuario, autor: 'usuario', texto: pergunta, hora: agora() }]);
    setTexto('');
    requestAnimationFrame(ajustarAltura);
    setDigitando(true);
    timer.current = setTimeout(() => {
      const idSan = proximoId.current++;
      setMensagens((atual) => [...atual, { id: idSan, autor: 'san', texto: responder(pergunta), hora: agora() }]);
      setDigitando(false);
    }, 800);
  };

  const reiniciar = () => {
    if (timer.current) clearTimeout(timer.current);
    proximoId.current = 1;
    setDigitando(false);
    setTexto('');
    setMensagens(inicial());
    requestAnimationFrame(ajustarAltura);
    campo.current?.focus();
  };

  return (
    <>
      <div className={styles.fundo} onClick={onClose} aria-hidden="true" />
      <aside className={styles.painel} role="complementary" aria-label="Conversa com o San">
        <header className={styles.topo}>
          <div className={styles.avatar}><SanIcone size={58} /></div>
          <div className={styles.identidade}>
            <b>San</b>
            <span><i className={styles.online} />Assistente de compras · simulação</span>
          </div>
          <button type="button" className={styles.acao} onClick={reiniciar} aria-label="Reiniciar conversa" title="Reiniciar conversa"><RotateCcw size={17} /></button>
          <button type="button" className={styles.acao} onClick={onClose} aria-label="Fechar conversa" title="Fechar (Esc)"><X size={19} /></button>
        </header>

        <section className={styles.contexto} aria-label="Contexto da conversa">
          <small>Conversando sobre</small>
          <strong>{titulo}</strong>
          {resumo.length > 0 && (
            <div className={styles.cartoes}>
              {resumo.map((r) => (
                <div key={r.rotulo}><span>{r.rotulo}</span><b>{r.valor}</b></div>
              ))}
            </div>
          )}
        </section>

        <div className={styles.mensagens} aria-live="polite">
          <div className={styles.dia}><span>Hoje</span></div>
          {mensagens.map((m) => (
            <div key={m.id} className={`${styles.linha} ${m.autor === 'san' ? styles.linhaSan : styles.linhaUsuario}`}>
              {m.autor === 'san' && <div className={styles.miniAvatar}><SanIcone size={26} animado={false} /></div>}
              <div className={styles.conteudo}>
                <div className={`${styles.balao} ${m.autor === 'san' ? styles.san : styles.usuario}`}>{m.texto}</div>
                <time className={styles.hora}>{m.autor === 'san' ? 'San · ' : ''}{m.hora}</time>
              </div>
            </div>
          ))}
          {digitando && (
            <div className={`${styles.linha} ${styles.linhaSan}`} role="status" aria-label="San está digitando">
              <div className={styles.miniAvatar}><SanIcone size={26} animado={false} /></div>
              <div className={`${styles.balao} ${styles.san} ${styles.digitando}`}><i /><i /><i /></div>
            </div>
          )}
          <div ref={fim} />
        </div>

        <footer className={styles.rodape}>
          {sugestoes.length > 0 && (
            <div className={styles.sugestoes}>
              {sugestoes.map((s) => (
                <button key={s} type="button" disabled={digitando} onClick={() => enviar(s)}>{s}</button>
              ))}
            </div>
          )}
          <form className={styles.entrada} onSubmit={(e) => { e.preventDefault(); enviar(texto); }}>
            <textarea
              ref={campo}
              rows={1}
              value={texto}
              onChange={(e) => { setTexto(e.target.value); ajustarAltura(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(texto); } }}
              placeholder="Pergunte algo ao San…"
              aria-label="Mensagem para o San"
            />
            <button type="submit" className={styles.enviar} disabled={!texto.trim() || digitando} aria-label="Enviar mensagem"><SendHorizontal size={18} /></button>
          </form>
          <p className={styles.aviso}>Respostas simuladas a partir dos dados desta recomendação.</p>
        </footer>
      </aside>
    </>
  );
}