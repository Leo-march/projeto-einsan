type Props = { size?: number; className?: string; title?: string };

/**
 * Marca da plataforma: um cofre congelado. O contorno herda a cor do texto (`currentColor`),
 * a tampa de gelo e o floco de neve no disco da porta ficam em azul-gelo.
 */
export function CofreIcone({ size = 28, className, title }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {/* Corpo e pés do cofre */}
        <rect x="3" y="3" width="18" height="17.5" rx="3" />
        <path d="M7 20.5V22.3M17 20.5V22.3" />
        {/* Disco da porta */}
        <circle cx="12" cy="13.4" r="4.4" strokeWidth="1.5" />
        {/* Floco de neve no disco */}
        <g stroke="#8fc2ff" strokeWidth="1.4">
          <path d="M12 10.7V16.1" />
          <path d="M9.66 14.75L14.34 12.05" />
          <path d="M14.34 14.75L9.66 12.05" />
        </g>
      </g>
      {/* Tampa de gelo escorrendo */}
      <path
        d="M3 7V6A3 3 0 0 1 6 3H18A3 3 0 0 1 21 6V7C20.3 7 20.1 8.8 19.1 8.8S17.9 7 17 7 15.8 8.2 14.8 8.2 13.6 7 12.6 7 11.4 9.2 10.2 9.2 9.3 7 8.3 7 7.2 8.4 6 8.4 4 7 3 7Z"
        fill="#8fc2ff"
      />
    </svg>
  );
}