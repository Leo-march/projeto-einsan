import styles from './SanIcone.module.css';

type Props = {
    size?: number;
    className?: string;
    title?: string;
    /** Liga as animações do pinguim (piscar, nariz escorrendo e espirro). Padrão: ligado. */
    animado?: boolean;
};

/**
 * San, o pinguim do cofre refrigerado. De cachecol azul e resfriadinho,
 * ele pisca, deixa o nariz escorrer e, de tempos em tempos, espirra.
 */
export function SanIcone({ size = 48, className, title, animado = true }: Props) {
    const a = (nome: string) => (animado ? styles[nome] : undefined);

    return (
        <svg
            width={Math.round((size * 56) / 60)}
            height={size}
            viewBox="4 4 56 60"
            className={[styles.svg, className].filter(Boolean).join(' ')}
            role={title ? 'img' : undefined}
            aria-label={title}
            aria-hidden={title ? undefined : true}
            focusable="false"
        >
            {title && <title>{title}</title>}
            {/* Sombra no chão */}
            <ellipse cx="32" cy="61.2" rx="17" ry="2.3" fill="#0b2545" opacity=".18" />

            {/* Corpo, asas e pés */}
            <g className={a('corpo')}>
                <g className={a('asaE')}>
                    <ellipse cx="14.5" cy="43" rx="4.2" ry="9.5" transform="rotate(16 14.5 43)" fill="#0f2a52" />
                </g>
                <g className={a('asaD')}>
                    <ellipse cx="49.5" cy="43" rx="4.2" ry="9.5" transform="rotate(-16 49.5 43)" fill="#0f2a52" />
                </g>
                <ellipse cx="32" cy="42" rx="17.5" ry="17" fill="#0f2a52" />
                <ellipse cx="32" cy="45" rx="11.5" ry="13" fill="#f4faff" />
                <ellipse cx="24" cy="58" rx="6" ry="2.6" fill="#ff9f1c" />
                <ellipse cx="40" cy="58" rx="6" ry="2.6" fill="#ff9f1c" />
            </g>

            {/* Cabeça: rosto, olhos, bico e o nariz escorrendo */}
            <g className={a('cabeca')}>
                <circle cx="32" cy="25" r="14.5" fill="#0f2a52" />
                <ellipse cx="24" cy="15" rx="6" ry="3" transform="rotate(-25 24 15)" fill="#fff" opacity=".12" />
                <ellipse cx="26" cy="26.5" rx="6.6" ry="7.6" fill="#f4faff" />
                <ellipse cx="38" cy="26.5" rx="6.6" ry="7.6" fill="#f4faff" />
                <circle cx="23" cy="30" r="2.1" fill="#ff8fa3" opacity=".55" />
                <circle cx="41" cy="30" r="2.1" fill="#ff8fa3" opacity=".55" />
                <g className={a('olhos')}>
                    <g className={a('apertar')}>
                        <circle cx="27" cy="25.5" r="2.4" fill="#0b1a33" />
                        <circle cx="37" cy="25.5" r="2.4" fill="#0b1a33" />
                        <circle cx="27.8" cy="24.6" r=".8" fill="#fff" />
                        <circle cx="37.8" cy="24.6" r=".8" fill="#fff" />
                    </g>
                </g>
                <path d="M29 29.2H35L32 33.6Z" fill="#ff9f1c" stroke="#ff9f1c" strokeWidth="1.6" strokeLinejoin="round" />
                <path
                    className={a('gota')}
                    style={animado ? undefined : { transform: 'scaleY(.6)', transformOrigin: '34px 30.6px' }}
                    d="M34.2 30.6C34.2 30.6 32.9 32.9 32.9 34.2a1.3 1.3 0 0 0 2.6 0C35.5 32.9 34.2 30.6 34.2 30.6Z"
                    fill="#a9dcff"
                    stroke="#6bb8f5"
                    strokeWidth=".5"
                />
            </g>

            {/* Cachecol */}
            <g className={a('corpo')}>
                <path d="M17.2 38.2Q32 45 46.8 38.2L47.4 43.6Q32 51 16.6 43.6Z" fill="#1d6fe0" />
                <path d="M17 41Q32 48 47.2 41" fill="none" stroke="#8fc2ff" strokeWidth="1.6" />
                <path d="M40 46L46.5 46.4L47.2 55.5Q43.6 57.2 40.5 55.5Z" fill="#1d6fe0" />
                <path d="M40.3 51.4Q43.8 52.8 47 51.4" fill="none" stroke="#8fc2ff" strokeWidth="1.4" />
            </g>

            {/* Gotículas do espirro (só na versão animada) */}
            {animado && (
                <g>
                    <circle className={a('g1')} cx="32" cy="34" r="1.7" fill="#bfe3ff" stroke="#6bb8f5" strokeWidth=".5" />
                    <circle className={a('g2')} cx="32" cy="34" r="1.4" fill="#bfe3ff" stroke="#6bb8f5" strokeWidth=".5" />
                    <circle className={a('g3')} cx="32" cy="34" r="1.7" fill="#bfe3ff" stroke="#6bb8f5" strokeWidth=".5" />
                    <circle className={a('g4')} cx="32" cy="34" r="1.1" fill="#bfe3ff" stroke="#6bb8f5" strokeWidth=".4" />
                    <circle className={a('g5')} cx="32" cy="34" r="1.1" fill="#bfe3ff" stroke="#6bb8f5" strokeWidth=".4" />
                </g>
            )}
        </svg>
    );
}