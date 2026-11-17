const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export const PlusIcon = ({ size = 18 }: { size?: number }) => (
  <svg {...base} width={size} height={size} strokeWidth={2.4}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const PencilIcon = () => (
  <svg {...base} width={15} height={15}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
    <path d="m13.5 6.5 4 4" />
  </svg>
);

/** Circle with a line through it. */
export const BanIcon = () => (
  <svg {...base} width={15} height={15}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M6 18 18 6" />
  </svg>
);

export const ArchiveIcon = () => (
  <svg {...base} width={16} height={16}>
    <rect x="3" y="4" width="18" height="5" rx="1.5" />
    <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" />
  </svg>
);

export const PlayIcon = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 4.8v14.4a1 1 0 0 0 1.5.86l12-7.2a1 1 0 0 0 0-1.72l-12-7.2A1 1 0 0 0 8 4.8z" />
  </svg>
);

export const PauseIcon = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor">
    <rect x="5" y="4" width="5" height="16" rx="1.4" />
    <rect x="14" y="4" width="5" height="16" rx="1.4" />
  </svg>
);

export const TrashIcon = () => (
  <svg {...base} width={15} height={15}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
);

export const RestoreIcon = () => (
  <svg {...base} width={15} height={15}>
    <path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v5h5" />
  </svg>
);

export const ChevronIcon = () => (
  <svg {...base} width={16} height={16}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const BrushIcon = () => (
  <svg {...base} width={17} height={17}>
    <defs>
      <linearGradient id="brush-grad" x1="3" y1="21" x2="21" y2="3" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#f97316" />
        <stop offset="0.5" stopColor="#ec4899" />
        <stop offset="1" stopColor="#8b5cf6" />
      </linearGradient>
    </defs>
    <g stroke="url(#brush-grad)">
      <path d="M18.4 3.6a2 2 0 0 1 2.8 2.8L12 15.6l-3.4-3.4 9.8-8.6z" fill="url(#brush-grad)" fillOpacity={0.22} />
      <path d="M8.6 12.2C6 12.4 5 14 5 16c0 1.4-.8 2.6-2 3.2 3.8 1.4 8.4.6 9.6-3.8" fill="url(#brush-grad)" fillOpacity={0.22} />
    </g>
  </svg>
);

export const AlarmIcon = ({ size = 14 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <circle cx="12" cy="13" r="7" />
    <path d="M12 9.5V13l2.5 1.5M4 5 2 7M20 5l2 2" />
  </svg>
);

export const StopIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
    <rect x="5" y="5" width="14" height="14" rx="3" />
  </svg>
);

export const EyeIcon =() => (
  <svg {...base} width={15} height={15}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EyeOffIcon = () => (
  <svg {...base} width={15} height={15}>
    <path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.5 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4.4-1M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
  </svg>
);

export const CheckIcon = ({ size = 13 }: { size?: number }) => (
  <svg {...base} width={size} height={size} strokeWidth={2.6}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

/** Four corner arrows pointing outwards: "expand". */
export const ExpandIcon = () => (
  <svg {...base} width={16} height={16}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </svg>
);

/** Four corner arrows pointing inwards: "collapse". */
export const CollapseIcon = () => (
  <svg {...base} width={16} height={16}>
    <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
  </svg>
);

export const HelpIcon = () => (
  <svg {...base} width={16} height={16}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.4 9.4a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.3-2.6 3.9M12 17.2v.1" />
  </svg>
);
