/**
 * Brand marks. RFA wordmark + Foundation triangle are vector redraws of the supplied artwork
 * (replace with the official SVGs from the designer if available — keep the same props).
 */
import Image from 'next/image'

type MarkProps = { className?: string; ink?: string; paper?: string; title?: string }

export function Crest({ className = 'h-10 w-auto' }: { className?: string }) {
  return <Image src="/brand/rowville-eagles-crest.png" alt="Rowville Eagles FC crest" width={566} height={706} className={className} priority />
}

/** Foundation triangle — three slanted bars. */
export function FoundationMark({ className = 'h-10 w-auto', ink = 'currentColor', title = 'Foundation' }: MarkProps) {
  return (
    <svg viewBox="30 115 1185 1020" className={className} role="img" aria-label={title}>
      <g fill={ink}>
        <polygon points="633,125 1085,912 870,916 524,299" />
        <polygon points="505,337 611,516 251,1125 38,1126" />
        <polygon points="392,955 1107,954 1203,1124 288,1125" />
      </g>
    </svg>
  )
}

/** RFA — Rowville Foundation Academy wordmark. `paper` must match the background (fills the outlined R). */
export function RfaLogo({ className = 'h-10 w-auto', ink = 'currentColor', paper = 'transparent', title = 'Rowville Foundation Academy' }: MarkProps) {
  return (
    <svg viewBox="150 555 1490 645" className={className} role="img" aria-label={title}>
      {/* F */}
      <polygon fill={ink} points="866,604 1277,604 1221,706 963,706 963,810 1159,810 1105,905 963,905 963,1143 846,1143 846,940 900,820 905,700" />
      {/* R (outlined) */}
      <path
        d="M309,592 H785 C860,592 888,690 888,770 C888,860 830,913 755,913 H652 L815,1160 H644 L473,950 L344,1160 H202 L397,835 H735 C780,835 802,800 802,770 C802,738 778,721 745,721 H231 Z"
        fill={paper}
        stroke={ink}
        strokeWidth="34"
        strokeLinejoin="miter"
      />
      {/* A (triangle) */}
      <g fill={ink}>
        <polygon points="1252,732 1308,826 1119,1148 1007,1148" />
        <polygon points="1320,620 1558,1035 1446,1037 1264,712" />
        <polygon points="1194,1057 1570,1057 1621,1148 1139,1148" />
      </g>
    </svg>
  )
}
