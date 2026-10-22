// Components of the Claude Design system (design-system-fb04106c), ported to
// typed React. Icons come from the bundled lucide-react instead of a CDN.
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  FileCheck,
  FileText,
  FileUp,
  FileX,
  FolderOpen,
  Info,
  LoaderCircle,
  LogOut,
  Pencil,
  RefreshCw,
  TriangleAlert,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";

const ICONS = {
  "arrow-right": ArrowRight,
  "chevron-right": ChevronRight,
  "circle-alert": CircleAlert,
  "circle-check": CircleCheck,
  "file-check": FileCheck,
  "file-text": FileText,
  "file-up": FileUp,
  "file-x": FileX,
  "folder-open": FolderOpen,
  info: Info,
  "loader-circle": LoaderCircle,
  "log-out": LogOut,
  pencil: Pencil,
  "refresh-cw": RefreshCw,
  "triangle-alert": TriangleAlert,
  upload: Upload,
  x: X,
} satisfies Record<string, LucideIcon>;
export type IconName = keyof typeof ICONS;
export function Icon({
  name,
  size = 20,
  color = "currentColor",
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  style?: CSSProperties;
}) {
  const C = ICONS[name];
  return (
    <C
      aria-hidden="true"
      size={size}
      color={color}
      strokeWidth={2}
      style={{ flex: "none", ...style }}
    />
  );
}

const SHAPES = [
  "62% 38% 46% 54% / 60% 44% 56% 40%",
  "42% 58% 70% 30% / 45% 45% 55% 55%",
  "55% 45% 38% 62% / 38% 62% 38% 62%",
  "70% 30% 50% 50% / 30% 50% 50% 70%",
  "48% 52% 64% 36% / 58% 34% 66% 42%",
];
const SHAPE_COLORS = {
  teal: "var(--shape-1)",
  sun: "var(--shape-2)",
  coral: "var(--shape-3)",
  lilac: "var(--shape-4)",
  mint: "var(--shape-5)",
};
export function Blob({
  shape = 1,
  color = "teal",
  size = 320,
  rotate = 0,
}: {
  shape?: number;
  color?: keyof typeof SHAPE_COLORS;
  size?: number;
  rotate?: number;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flex: "none",
        borderRadius: SHAPES[(shape - 1) % SHAPES.length],
        background: SHAPE_COLORS[color],
        transform: `rotate(${rotate}deg)`,
        pointerEvents: "none",
      }}
    />
  );
}

const SIZES = {
  sm: { h: 40, px: 20, fs: 14, ic: 16, gap: 6 },
  md: { h: 52, px: 28, fs: 16, ic: 18, gap: 8 },
  lg: { h: 64, px: 40, fs: 18, ic: 20, gap: 10 },
};
const VARIANTS = {
  primary: {
    bg: "var(--action-primary)",
    hov: "var(--action-primary-hover)",
    fg: "var(--text-inverse)",
    bd: "transparent",
  },
  secondary: {
    bg: "var(--action-secondary)",
    hov: "var(--action-secondary-hover)",
    fg: "var(--text-inverse)",
    bd: "transparent",
  },
  outline: {
    bg: "var(--paper-0)",
    hov: "var(--paper-50)",
    fg: "var(--text-strong)",
    bd: "var(--ink-900)",
  },
  neutral: {
    bg: "var(--action-neutral)",
    hov: "var(--action-neutral-hover)",
    fg: "var(--text-strong)",
    bd: "transparent",
  },
  ghost: {
    bg: "transparent",
    hov: "var(--paper-100)",
    fg: "var(--text-strong)",
    bd: "transparent",
  },
};
export function Button({
  children,
  variant = "primary",
  size = "md",
  iconLeft,
  iconRight,
  disabled = false,
  loading = false,
  onClick,
  style,
}: {
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  iconLeft?: IconName;
  iconRight?: IconName;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  const [hov, setHov] = useState(false);
  const [press, setPress] = useState(false);
  const s = SIZES[size],
    v = VARIANTS[variant];
  const off = disabled || loading;
  return (
    <button
      type="button"
      disabled={off}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => {
        setHov(false);
        setPress(false);
      }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: s.gap,
        height: s.h,
        padding: `0 ${s.px}px`,
        borderRadius: "var(--radius-pill)",
        border: `var(--border-w-strong) solid ${off && variant !== "ghost" ? "transparent" : v.bd}`,
        background: off
          ? variant === "ghost"
            ? "transparent"
            : "var(--paper-200)"
          : hov
            ? v.hov
            : v.bg,
        color: off ? "var(--text-disabled)" : v.fg,
        fontFamily: "var(--font-jp)",
        fontWeight: 700,
        fontSize: s.fs,
        letterSpacing: "var(--ls-ui)",
        lineHeight: 1,
        whiteSpace: "nowrap",
        cursor: off ? "not-allowed" : "pointer",
        transform: press && !off ? "scale(.97)" : "none",
        transition:
          "background var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)",
        ...style,
      }}
    >
      {loading ? (
        <Icon
          name="loader-circle"
          size={s.ic}
          style={{ animation: "ds-spin 0.9s linear infinite" }}
        />
      ) : (
        iconLeft && <Icon name={iconLeft} size={s.ic} />
      )}
      <span>{children}</span>
      {iconRight && !loading && (
        <Icon
          name={iconRight}
          size={s.ic}
          style={{
            transform: hov && !off ? "translateX(3px)" : "none",
            transition: "transform var(--dur-base) var(--ease-out)",
          }}
        />
      )}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  size = 40,
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  size?: number;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: 0,
        display: "inline-grid",
        placeItems: "center",
        padding: 0,
        background: hov ? "var(--paper-100)" : "transparent",
        color: "var(--text-strong)",
        cursor: "pointer",
        transition: "background var(--dur-fast) var(--ease-out)",
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.45)} />
    </button>
  );
}

const TAG_TONES = {
  teal: ["var(--teal-600)", "var(--teal-50)"],
  coral: ["var(--coral-600)", "var(--coral-100)"],
  sun: ["var(--sun-700)", "var(--sun-100)"],
  lilac: ["var(--lilac-600)", "var(--lilac-100)"],
  mint: ["var(--mint-600)", "var(--mint-100)"],
  ink: ["var(--ink-700)", "var(--paper-100)"],
};
export type TagTone = keyof typeof TAG_TONES;
export function Tag({
  children,
  tone = "teal",
}: {
  children: ReactNode;
  tone?: TagTone;
}) {
  const [fg] = TAG_TONES[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 24,
        padding: "0 10px",
        borderRadius: "var(--radius-pill)",
        fontFamily: "var(--font-jp)",
        fontWeight: 700,
        fontSize: 12,
        letterSpacing: "var(--ls-ui)",
        lineHeight: 1,
        whiteSpace: "nowrap",
        color: fg,
        border: `var(--border-w) solid ${fg}`,
      }}
    >
      {children}
    </span>
  );
}

// "review" (要確認) is this app's addition to the design's statuses.
const STATUS = {
  done: [
    "達成",
    "var(--status-done-fg)",
    "var(--status-done-bg)",
    "var(--status-done-fill)",
  ],
  near: [
    "あと少し",
    "var(--status-near-fg)",
    "var(--status-near-bg)",
    "var(--status-near-fill)",
  ],
  short: [
    "不足",
    "var(--status-short-fg)",
    "var(--status-short-bg)",
    "var(--status-short-fill)",
  ],
  review: [
    "要確認",
    "var(--status-info-fg)",
    "var(--status-info-bg)",
    "var(--status-info-fill)",
  ],
  none: [
    "未判定",
    "var(--status-none-fg)",
    "var(--status-none-bg)",
    "var(--status-none-fill)",
  ],
};
export type Status = keyof typeof STATUS;
export function StatusBadge({
  status = "done",
  children,
  size = "md",
}: {
  status?: Status;
  children?: ReactNode;
  size?: "md" | "lg";
}) {
  const [txt, fg, bg, dot] = STATUS[status];
  const lg = size === "lg";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: lg ? 10 : 8,
        height: lg ? 40 : 30,
        padding: lg ? "0 18px" : "0 12px",
        borderRadius: "var(--radius-pill)",
        background: bg,
        color: fg,
        fontFamily: "var(--font-jp)",
        fontWeight: 700,
        fontSize: lg ? 16 : 13,
        letterSpacing: "var(--ls-ui)",
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: lg ? 10 : 8,
          height: lg ? 10 : 8,
          borderRadius: "50%",
          background: dot,
          flex: "none",
        }}
      />
      {children ?? txt}
    </span>
  );
}

const NUM_SIZES = {
  sm: [24, 14],
  md: [40, 18],
  lg: [64, 24],
  xl: [96, 32],
} as const;
export function StatNumber({
  value,
  total,
  unit,
  size = "lg",
  align = "left",
}: {
  value: ReactNode;
  total?: ReactNode;
  unit?: string;
  size?: keyof typeof NUM_SIZES;
  align?: "left" | "center";
}) {
  const [n, sub] = NUM_SIZES[size];
  return (
    <div
      className={"stat-number " + size}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align === "center" ? "center" : "flex-start",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: Math.max(4, n * 0.08),
          lineHeight: 1,
          color: "var(--text-strong)",
          whiteSpace: "nowrap",
        }}
      >
        <span
          className="stat-value"
          style={{
            fontFamily: "var(--font-num)",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </span>
        {total != null && (
          <span
            style={{
              fontFamily: "var(--font-num)",
              fontWeight: 500,
              fontSize: sub,
              color: "var(--text-subtle)",
            }}
          >
            / {total}
          </span>
        )}
        {unit && (
          <span
            style={{
              fontFamily: "var(--font-jp)",
              fontWeight: 700,
              fontSize: sub * 0.8,
              letterSpacing: "var(--ls-ui)",
              color: "var(--text-muted)",
            }}
          >
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}

const FILL = {
  teal: "var(--teal-500)",
  done: "var(--status-done-fill)",
  near: "var(--status-near-fill)",
  short: "var(--status-short-fill)",
  review: "var(--status-info-fill)",
  none: "var(--status-none-fill)",
};
const BAR_H = { sm: 6, md: 10, lg: 16 };
export function ProgressBar({
  value,
  max,
  tone = "teal",
  size = "md",
  marker,
  animate = true,
  label,
}: {
  value: number;
  max: number;
  tone?: keyof typeof FILL;
  size?: keyof typeof BAR_H;
  marker?: number;
  animate?: boolean;
  label?: string;
}) {
  const [shown, setShown] = useState(animate ? 0 : value);
  useEffect(() => {
    if (!animate) {
      setShown(value);
      return;
    }
    const t = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(t);
  }, [value, animate]);
  const pct = Math.max(0, Math.min(100, (shown / (max || 1)) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      style={{
        position: "relative",
        height: BAR_H[size],
        borderRadius: "var(--radius-pill)",
        background: "var(--paper-200)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: pct + "%",
          borderRadius: "inherit",
          background: FILL[tone],
          transition: animate
            ? "width var(--dur-progress) var(--ease-out)"
            : "none",
        }}
      />
      {marker != null && (
        <div
          title="必要ライン"
          style={{
            position: "absolute",
            top: -4,
            bottom: -4,
            left: `calc(${(marker / (max || 1)) * 100}% - 1px)`,
            width: 2,
            borderRadius: 2,
            background: "var(--ink-900)",
          }}
        />
      )}
    </div>
  );
}

export function ProgressRing({
  value,
  max = 100,
  size = 160,
  stroke = 14,
  children,
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(t);
  }, [value]);
  const r = (size - stroke) / 2,
    c = 2 * Math.PI * r,
    pct = Math.max(0, Math.min(1, shown / max));
  return (
    <div
      style={{ position: "relative", width: size, height: size, flex: "none" }}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--paper-200)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={FILL.teal}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{
            transition: "stroke-dashoffset var(--dur-progress) var(--ease-out)",
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// One requirement as a pill row. Layout lives in style.css (.req-row) so it
// can stack on narrow screens.
export function RequirementRow({
  name,
  category,
  categoryTone = "teal",
  earned,
  required,
  unit = "単位",
  status,
  lack,
  open,
  onClick,
}: {
  name: string;
  category?: string;
  categoryTone?: TagTone;
  earned: ReactNode;
  required: ReactNode;
  unit?: string;
  status: Status;
  lack?: string;
  open?: boolean;
  onClick?: () => void;
}) {
  const ratio =
    typeof earned === "number" && typeof required === "number"
      ? [earned, required]
      : null;
  return (
    <div
      className={"req-row" + (onClick ? " clickable" : "")}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-expanded={onClick ? !!open : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="req-name">
        {category && <Tag tone={categoryTone}>{category}</Tag>}
        <span>{name}</span>
      </div>
      <div className="req-bar">
        {ratio && (
          <ProgressBar
            value={ratio[0]}
            max={ratio[1]}
            tone={status}
            size="sm"
            label={name}
          />
        )}
      </div>
      <span className="req-value">
        <strong>{earned}</strong>
        <small>
          / {required}
          {unit !== "単位" ? ` ${unit}` : ""}
        </small>
      </span>
      <span className="req-badge">
        <StatusBadge status={status}>
          {status === "done" ? "達成" : status === "review" ? "要確認" : lack}
        </StatusBadge>
      </span>
      {onClick ? (
        <Icon
          name="chevron-right"
          size={20}
          color="var(--text-subtle)"
          style={{
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform var(--dur-base) var(--ease-out)",
          }}
        />
      ) : (
        <span />
      )}
    </div>
  );
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="tablist" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {items.map((it) => (
        <Tab
          key={it.value}
          label={it.label}
          on={it.value === value}
          onClick={() => onChange(it.value)}
        />
      ))}
    </div>
  );
}
function Tab({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: 40,
        padding: "0 20px",
        border: 0,
        borderRadius: "var(--radius-pill)",
        display: "inline-flex",
        alignItems: "center",
        background: on
          ? "var(--ink-900)"
          : hov
            ? "var(--paper-200)"
            : "var(--paper-100)",
        color: on ? "var(--text-inverse)" : "var(--text-muted)",
        fontFamily: "var(--font-jp)",
        fontWeight: 700,
        fontSize: 14,
        letterSpacing: "var(--ls-ui)",
        cursor: "pointer",
        transition: "background var(--dur-fast) var(--ease-out)",
      }}
    >
      {label}
    </button>
  );
}

export function Toast({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div
      role="status"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        minHeight: 56,
        padding: "0 12px 0 22px",
        borderRadius: "var(--radius-pill)",
        background: "var(--ink-900)",
        color: "var(--text-inverse)",
        boxShadow: "var(--shadow-float)",
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: "var(--ls-ui)",
      }}
    >
      <Icon name="circle-check" size={20} color="var(--mint-300)" />
      <span style={{ paddingRight: onClose ? 0 : 10 }}>{children}</span>
      {onClose && (
        <button
          type="button"
          aria-label="閉じる"
          onClick={onClose}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: 0,
            background: "transparent",
            color: "var(--ink-300)",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon name="x" size={18} />
        </button>
      )}
    </div>
  );
}

const ALERT = {
  info: ["info", "var(--status-info-fg)", "var(--status-info-bg)"],
  near: ["triangle-alert", "var(--status-near-fg)", "var(--status-near-bg)"],
  short: ["circle-alert", "var(--status-short-fg)", "var(--status-short-bg)"],
} as const;
export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: keyof typeof ALERT;
  title?: string;
  children?: ReactNode;
}) {
  const [ic, fg, bg] = ALERT[tone];
  return (
    <div
      role={tone === "info" ? "status" : "alert"}
      style={{
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        padding: "20px 24px",
        borderRadius: "var(--radius-lg)",
        background: bg,
        color: "var(--text-body)",
      }}
    >
      <Icon name={ic} size={22} color={fg} style={{ marginTop: 2 }} />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {title && (
          <div
            style={{
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: "var(--ls-ui)",
              color: fg,
              lineHeight: 1.5,
            }}
          >
            {title}
          </div>
        )}
        {children && (
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.8,
              letterSpacing: "var(--ls-body)",
            }}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

export function FileDropzone({
  onFile,
  error,
  description,
}: {
  onFile: (f: File) => void;
  error?: string;
  description: string;
}) {
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const take = (list: FileList | null) => {
    const f = list?.[0];
    if (f) onFile(f);
  };
  const bd = error
    ? "var(--coral-400)"
    : drag
      ? "var(--teal-500)"
      : "var(--ink-300)";
  return (
    <div
      className="dropzone"
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        take(e.dataTransfer.files);
      }}
      style={{
        border: `2px dashed ${bd}`,
        background: error
          ? "var(--coral-100)"
          : drag
            ? "var(--teal-50)"
            : "var(--paper-50)",
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: drag ? "var(--teal-500)" : "var(--paper-0)",
          color: drag ? "#fff" : "var(--teal-600)",
          display: "grid",
          placeItems: "center",
          transform: drag ? "translateY(-6px)" : "none",
          transition: "all var(--dur-base) var(--ease-spring)",
        }}
      >
        <Icon name="file-up" size={34} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            font: "var(--text-h3-font)",
            letterSpacing: "var(--ls-heading)",
            color: "var(--text-strong)",
          }}
        >
          {drag ? "はなしてアップロード" : "成績PDFをここにドロップ"}
        </div>
        <div
          role={error ? "alert" : undefined}
          style={{
            fontSize: 14,
            lineHeight: 1.8,
            letterSpacing: "var(--ls-body)",
            color: error ? "var(--coral-700)" : "var(--text-muted)",
          }}
        >
          {error || description}
        </div>
      </div>
      <Button
        variant="secondary"
        iconLeft="folder-open"
        onClick={() => ref.current?.click()}
      >
        ファイルを選択
      </Button>
      <input
        ref={ref}
        type="file"
        accept="application/pdf,.pdf"
        aria-label="成績PDF"
        hidden
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

const FILE_STATUS = {
  analyzing: ["成績を読み取り中", "var(--teal-700)", "teal"],
  done: ["読み取り完了", "var(--status-done-fg)", "done"],
  error: ["読み取りエラー", "var(--status-short-fg)", "short"],
} as const;
export function FileItem({
  name,
  size,
  status,
  progress = 0,
  message,
  onRemove,
}: {
  name: string;
  size: string;
  status: keyof typeof FILE_STATUS;
  progress?: number;
  message?: string;
  onRemove?: () => void;
}) {
  const [label, color, tone] = FILE_STATUS[status];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "18px 18px 18px 22px",
        borderRadius: "var(--radius-lg)",
        background: "var(--paper-0)",
        border: "var(--border-w) solid var(--border-subtle)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          flex: "none",
          borderRadius: "var(--radius-md)",
          background:
            status === "error" ? "var(--coral-100)" : "var(--teal-50)",
          color: status === "error" ? "var(--coral-600)" : "var(--teal-600)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Icon
          name={
            status === "done"
              ? "file-check"
              : status === "error"
                ? "file-x"
                : "file-text"
          }
          size={24}
        />
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: "var(--ls-body)",
              color: "var(--text-strong)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "var(--ls-ui)",
              color,
              whiteSpace: "nowrap",
            }}
          >
            {message || label}
            {status === "analyzing" && (
              <span
                style={{
                  fontFamily: "var(--font-num)",
                  marginLeft: 8,
                  letterSpacing: 0,
                }}
              >
                {Math.round(progress)}%
              </span>
            )}
          </span>
        </div>
        {status === "analyzing" ? (
          <ProgressBar
            value={progress}
            max={100}
            size="sm"
            tone={tone}
            animate={false}
            label="読み取りの進み具合"
          />
        ) : (
          <span
            style={{
              fontFamily: "var(--font-num)",
              fontSize: 13,
              color: "var(--text-subtle)",
            }}
          >
            {size}
          </span>
        )}
      </div>
      {onRemove && <IconButton icon="x" label="取り消す" onClick={onRemove} />}
    </div>
  );
}

// Entrance and hover motion shared by the screens' decorative shapes.
export function useEntered() {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [entered, setEntered] = useState(!!reduced);
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setEntered(true), 80);
    return () => clearTimeout(t);
  }, [reduced]);
  return entered;
}
export function Shape({
  entered,
  hover,
  delay,
  moved,
  className,
  children,
}: {
  entered: boolean;
  hover: boolean;
  delay: number;
  moved: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <div
      className={"shape " + className}
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? "none" : "scale(0.4)",
        transition: `opacity 1000ms var(--ease-out) ${delay}ms, transform 1200ms var(--ease-out) ${delay}ms`,
      }}
    >
      <div
        style={{
          transform: hover ? moved : "none",
          transition: "transform 700ms var(--ease-out)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
