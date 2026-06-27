import { useState, useEffect, useRef, useCallback } from "react";
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from "recharts";
import {
  Thermometer, Wind, Droplets, Wifi, WifiOff, Cpu,
  CloudRain, Sun, CloudSnow, Zap, Settings, Activity,
  LayoutDashboard, CalendarDays, MonitorSpeaker, ShieldCheck,
  ChevronUp, ChevronDown, Power, AlertTriangle, CheckCircle2,
  Clock, MapPin, RefreshCw, Bell, Minus, Plus, ToggleLeft, ToggleRight,
  BarChart2, Gauge, Menu, X, Moon, SunMedium,
} from "lucide-react";

// ─── Fonts ────────────────────────────────────────────────────────────────
const F = {
  ui:   { fontFamily: "'Oxanium', sans-serif" },
  data: { fontFamily: "'JetBrains Mono', monospace" },
};

// ─── Colours (raw, for recharts & inline) ────────────────────────────────
function makeColors(dark: boolean) {
  return {
    teal:   "#00bcd4",
    amber:  "#ff9800",
    green:  "#4caf50",
    red:    "#f44336",
    purple: "#9c27b0",
    dim:    dark ? "#4a6a80" : "#6a8a9a",
    mid:    dark ? "#7a9ab0" : "#3a5a70",
    fg:     dark ? "#c8d8e4" : "#0d1e2c",
    bg:     dark ? "#080e14" : "#f0f4f8",
    card:   dark ? "#0d1620" : "#ffffff",
    muted:  dark ? "#111c28" : "#e4ecf2",
    border: dark ? "rgba(0,188,212,0.08)" : "rgba(0,120,150,0.12)",
  };
}
// default; overridden per-render via useMemo in App
const C = makeColors(true);

// ─── Helpers ──────────────────────────────────────────────────────────────
function rand(min: number, max: number, dp = 1) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(dp));
}
function now() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

// ─── Seed 24-hour forecast ────────────────────────────────────────────────
function makeForecast() {
  const base = 22;
  return Array.from({ length: 25 }, (_, i) => {
    const h = (new Date().getHours() + i) % 24;
    const label = `${String(h).padStart(2, "0")}:00`;
    const outdoor = base + 8 * Math.sin((i / 24) * Math.PI * 2 - 1) + rand(-1, 1);
    const reactive = base + Math.max(0, (outdoor - 26) * 0.7) + rand(-0.3, 0.3);
    const climai   = base + Math.max(0, (outdoor - 28) * 0.2) + rand(-0.2, 0.2);
    return {
      label,
      outdoor: parseFloat(outdoor.toFixed(1)),
      reactive: parseFloat(reactive.toFixed(1)),
      climai:   parseFloat(climai.toFixed(1)),
    };
  });
}

// ─── MQTT log seed ────────────────────────────────────────────────────────
const seedLogs = [
  { t: "—", topic: "climai/forecast",   msg: "FETCH  api=OpenWeatherMap loc=Chennai,IN" },
  { t: "—", topic: "climai/predict",    msg: "HEATWAVE_ETA=2h delta=+7.2°C confidence=91%" },
  { t: "—", topic: "climai/cmd/ac",     msg: "PRE_COOL target=22°C mode=gradual duty=40%" },
  { t: "—", topic: "climai/esp32/ack",  msg: "IR_SENT 0xB24F OK latency=1.1s" },
  { t: "—", topic: "climai/indoor",     msg: "temp=24.1°C hum=51% → within range" },
];

// ─── Automation rules ─────────────────────────────────────────────────────
const defaultRules = [
  { id: 1, condition: "Outdoor forecast > 34°C within 2h",  action: "Pre-cool to 22°C (gradual)", enabled: true,  triggered: 3 },
  { id: 2, condition: "Outdoor forecast < 14°C within 1h",  action: "Pre-heat to 24°C (gentle)",  enabled: true,  triggered: 0 },
  { id: 3, condition: "Humidity > 75% sustained 30m",        action: "Activate dehumidify mode",   enabled: true,  triggered: 1 },
  { id: 4, condition: "Storm front detected < 90min",        action: "Seal ventilation, Cool +2°C",enabled: false, triggered: 0 },
  { id: 5, condition: "Indoor > target + 2°C",               action: "Boost fan to HIGH speed",    enabled: true,  triggered: 7 },
];

// ─── Tiny components ──────────────────────────────────────────────────────
function Pill({
  label, color = C.teal,
}: { label: string; color?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-widest border"
      style={{ ...F.data, color, borderColor: `${color}30`, background: `${color}10` }}
    >
      {label}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] uppercase tracking-[0.18em]" style={{ ...F.data, color: C.dim }}>
      {children}
    </span>
  );
}

function Divider() {
  return <div className="border-t border-border w-full" />;
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-border bg-card px-3 py-2 text-xs" style={F.data}>
      <div className="mb-1" style={{ color: C.dim }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ color: C.fg }}>{p.value}°C</span>
        </div>
      ))}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, unit, sub, color = C.teal, alert,
}: {
  icon: any; label: string; value: string | number; unit: string;
  sub?: string; color?: string; alert?: boolean;
}) {
  return (
    <div
      className="border bg-card p-4 flex flex-col gap-3 hover:border-primary/20 transition-colors"
      style={{ borderColor: alert ? `${C.amber}30` : C.border }}
    >
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Icon size={13} style={{ color: alert ? C.amber : color }} />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-700 leading-none" style={{ ...F.ui, color, fontWeight: 700 }}>
          {value}
        </span>
        <span className="text-sm" style={{ ...F.data, color: C.mid }}>{unit}</span>
      </div>
      {sub && <div className="text-[11px]" style={{ ...F.data, color: C.dim }}>{sub}</div>}
    </div>
  );
}

// ─── Gauge ring ──────────────────────────────────────────────────────────
function GaugeRing({
  value, max, color, label, unit,
}: { value: number; max: number; color: string; label: string; unit: string }) {
  const pct = Math.min(value / max, 1);
  const r = 36, circ = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={88} height={88} className="-rotate-90">
        <circle cx={44} cy={44} r={r} fill="none" stroke={C.muted} strokeWidth={6} />
        <circle
          cx={44} cy={44} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="flex flex-col items-center -mt-14 mb-6">
        <span className="text-xl font-700" style={{ ...F.ui, color, fontWeight: 700 }}>
          {value}<span className="text-sm">{unit}</span>
        </span>
      </div>
      <Label>{label}</Label>
    </div>
  );
}

// ─── MQTT Log ─────────────────────────────────────────────────────────────
function MQTTLog({ logs }: { logs: typeof seedLogs }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs]);

  return (
    <div className="border border-border bg-card flex flex-col" style={{ minHeight: 220 }}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4caf50] animate-pulse" />
          <Label>MQTT Live Feed · HiveMQ</Label>
        </div>
        <Label>SUB: climai/#</Label>
      </div>
      <div
        ref={ref}
        className="flex-1 overflow-y-auto p-3 space-y-1.5"
        style={{ maxHeight: 200 }}
      >
        {logs.map((l, i) => (
          <div key={i} className="flex gap-2 text-[11px] leading-relaxed" style={F.data}>
            <span style={{ color: C.dim, minWidth: 60 }}>{l.t}</span>
            <span style={{ color: C.teal, minWidth: 140 }}>{l.topic}</span>
            <span style={{ color: C.mid }}>{l.msg}</span>
          </div>
        ))}
        <span className="text-[11px] animate-pulse" style={{ ...F.data, color: C.teal }}>▋</span>
      </div>
    </div>
  );
}

// ─── Device control ───────────────────────────────────────────────────────
function DeviceControl({
  acOn, setAcOn, target, setTarget, fanSpeed, setFanSpeed, mode, setMode,
}: {
  acOn: boolean; setAcOn: (v: boolean) => void;
  target: number; setTarget: (v: number) => void;
  fanSpeed: "LOW" | "MED" | "HIGH" | "AUTO";
  setFanSpeed: (v: "LOW" | "MED" | "HIGH" | "AUTO") => void;
  mode: "COOL" | "HEAT" | "FAN" | "AUTO";
  setMode: (v: "COOL" | "HEAT" | "FAN" | "AUTO") => void;
}) {
  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <Label>Device Control · ESP32-01</Label>
        <div className="flex items-center gap-1.5 text-[10px]" style={{ ...F.data, color: C.green }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#4caf50]" />IR LINKED
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 gap-4">
        {/* Power */}
        <div className="col-span-2 flex items-center justify-between border border-border p-3">
          <div>
            <div className="text-sm font-600" style={{ ...F.ui, fontWeight: 600, color: acOn ? C.teal : C.dim }}>
              {acOn ? "SYSTEM ACTIVE" : "SYSTEM OFF"}
            </div>
            <div className="text-[10px] mt-0.5" style={{ ...F.data, color: C.dim }}>
              {acOn ? "Predictive mode engaged" : "Click to activate"}
            </div>
          </div>
          <button
            onClick={() => setAcOn(!acOn)}
            className="w-10 h-10 border flex items-center justify-center transition-all"
            style={{
              borderColor: acOn ? C.teal : C.dim,
              background: acOn ? `${C.teal}15` : "transparent",
              color: acOn ? C.teal : C.dim,
            }}
          >
            <Power size={16} />
          </button>
        </div>

        {/* Target temp */}
        <div className="border border-border p-3">
          <Label>Target Temp</Label>
          <div className="flex items-center justify-between mt-2">
            <button
              onClick={() => setTarget(Math.max(16, target - 1))}
              className="w-7 h-7 border border-border flex items-center justify-center hover:border-primary/40 transition-colors"
              style={{ color: C.mid }}
            >
              <Minus size={12} />
            </button>
            <span className="text-2xl font-700" style={{ ...F.ui, color: C.teal, fontWeight: 700 }}>
              {target}°C
            </span>
            <button
              onClick={() => setTarget(Math.min(30, target + 1))}
              className="w-7 h-7 border border-border flex items-center justify-center hover:border-primary/40 transition-colors"
              style={{ color: C.mid }}
            >
              <Plus size={12} />
            </button>
          </div>
        </div>

        {/* Mode */}
        <div className="border border-border p-3">
          <Label>Mode</Label>
          <div className="grid grid-cols-2 gap-1 mt-2">
            {(["COOL", "HEAT", "FAN", "AUTO"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="py-1 text-[10px] border transition-all"
                style={{
                  ...F.data,
                  borderColor: mode === m ? C.teal : C.border,
                  color: mode === m ? C.teal : C.dim,
                  background: mode === m ? `${C.teal}12` : "transparent",
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Fan speed */}
        <div className="col-span-2 border border-border p-3">
          <Label>Fan Speed</Label>
          <div className="grid grid-cols-4 gap-1 mt-2">
            {(["AUTO", "LOW", "MED", "HIGH"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFanSpeed(s)}
                className="py-1.5 text-[10px] border transition-all"
                style={{
                  ...F.data,
                  borderColor: fanSpeed === s ? C.teal : C.border,
                  color: fanSpeed === s ? C.teal : C.dim,
                  background: fanSpeed === s ? `${C.teal}12` : "transparent",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Forecast chart ───────────────────────────────────────────────────────
function ForecastChart({ data, id = "a" }: { data: ReturnType<typeof makeForecast>; id?: string }) {
  const gT = `gTeal_${id}`;
  const gA = `gAmber_${id}`;
  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <Label>24-Hour Temperature Forecast</Label>
        <div className="flex items-center gap-4 text-[10px]" style={F.data}>
          <span style={{ color: C.teal }}>— Hushaar AI indoor</span>
          <span style={{ color: C.amber }}>— Reactive indoor</span>
          <span style={{ color: "#ffffff30" }}>– – Outdoor</span>
        </div>
      </div>
      <div className="p-4">
        {/* Gradient defs outside recharts to avoid its internal key collision */}
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <defs>
            <linearGradient id={gT} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C.teal}  stopOpacity={0.18} />
              <stop offset="95%" stopColor={C.teal}  stopOpacity={0} />
            </linearGradient>
            <linearGradient id={gA} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C.amber} stopOpacity={0.12} />
              <stop offset="95%" stopColor={C.amber} stopOpacity={0} />
            </linearGradient>
          </defs>
        </svg>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -28 }}>
            <CartesianGrid stroke={C.border} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fontFamily: "JetBrains Mono", fill: C.dim }}
              axisLine={false} tickLine={false}
              interval={3}
            />
            <YAxis
              tick={{ fontSize: 9, fontFamily: "JetBrains Mono", fill: C.dim }}
              axisLine={false} tickLine={false}
              tickFormatter={(v) => `${v}°`}
            />
            <Tooltip content={<ChartTip />} />
            <ReferenceLine y={26} stroke={`${C.amber}40`} strokeDasharray="4 4" />
            <Area type="monotone" dataKey="outdoor"  name="Outdoor"  stroke="rgba(255,255,255,0.18)" fill="transparent" strokeDasharray="5 3" dot={false} />
            <Area type="monotone" dataKey="reactive" name="Reactive" stroke={C.amber} fill={`url(#${gA})`} strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="climai"   name="Hushaar AI"  stroke={C.teal}  fill={`url(#${gT})`} strokeWidth={2}   dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Prediction engine panel ──────────────────────────────────────────────
function PredictionPanel({
  outdoor, indoor, target,
}: { outdoor: number; indoor: number; target: number }) {
  const gap = outdoor - 26;
  const threat = gap > 6 ? "HIGH" : gap > 2 ? "MEDIUM" : "LOW";
  const tColor = threat === "HIGH" ? C.red : threat === "MEDIUM" ? C.amber : C.green;

  const actions = [
    {
      done: true,
      label: "Weather data ingested",
      detail: `OpenWeatherMap · ${outdoor.toFixed(1)}°C outdoor`,
    },
    {
      done: true,
      label: "Heatwave trajectory computed",
      detail: `Peak in ~2h · Δ+${Math.max(0, gap).toFixed(1)}°C above comfort`,
    },
    {
      done: threat !== "LOW",
      label: "Pre-cool command dispatched",
      detail: `MQTT → ESP32 · target ${target}°C · gradual ramp`,
      pending: threat === "LOW",
    },
    {
      done: false,
      label: "Indoor target achieved",
      detail: `Current ${indoor.toFixed(1)}°C → ${target}°C · ETA ~18min`,
      pending: true,
    },
  ];

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <Label>Prediction Engine · Status</Label>
        <Pill label={threat} color={tColor} />
      </div>
      <div className="p-4 space-y-3">
        {actions.map((a, i) => (
          <div key={i} className="flex gap-3 items-start">
            <div
              className="w-4 h-4 border flex items-center justify-center shrink-0 mt-0.5"
              style={{
                borderColor: a.done ? C.teal : a.pending ? C.amber : C.border,
                background: a.done ? `${C.teal}15` : "transparent",
              }}
            >
              {a.done
                ? <CheckCircle2 size={10} color={C.teal} />
                : a.pending
                ? <Clock size={9} color={C.amber} />
                : <div className="w-1.5 h-1.5 rounded-full" style={{ background: C.dim }} />
              }
            </div>
            <div>
              <div className="text-xs font-500" style={{ ...F.ui, fontWeight: 500, color: a.done ? C.fg : C.mid }}>
                {a.label}
              </div>
              <div className="text-[10px]" style={{ ...F.data, color: C.dim }}>{a.detail}</div>
            </div>
          </div>
        ))}
      </div>

      {threat !== "LOW" && (
        <div
          className="mx-4 mb-4 flex items-start gap-2 border p-2.5"
          style={{ borderColor: `${C.amber}30`, background: `${C.amber}08` }}
        >
          <AlertTriangle size={12} style={{ color: C.amber }} className="shrink-0 mt-0.5" />
          <div className="text-[10px] leading-relaxed" style={{ ...F.data, color: C.amber }}>
            HEATWAVE IMMINENT · Outdoor forecast peaks at {(outdoor + gap * 0.6).toFixed(1)}°C in ~2h.
            Pre-cool sequence initiated automatically.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Automation rules table ───────────────────────────────────────────────
function AutomationTable({
  rules, toggle,
}: {
  rules: typeof defaultRules;
  toggle: (id: number) => void;
}) {
  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <Label>Automation Rules</Label>
        <Label>{rules.filter((r) => r.enabled).length} / {rules.length} active</Label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]" style={F.data}>
          <thead>
            <tr className="border-b border-border">
              {["#", "Condition", "Action", "Triggered", ""].map((h) => (
                <th key={h} className="text-left px-4 py-2" style={{ color: C.dim }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr
                key={r.id}
                className="border-b border-border hover:bg-secondary/50 transition-colors"
              >
                <td className="px-4 py-2.5" style={{ color: C.dim }}>
                  {String(r.id).padStart(2, "0")}
                </td>
                <td className="px-4 py-2.5 max-w-xs" style={{ color: r.enabled ? C.fg : C.dim }}>
                  {r.condition}
                </td>
                <td className="px-4 py-2.5" style={{ color: r.enabled ? C.teal : C.dim }}>
                  {r.action}
                </td>
                <td className="px-4 py-2.5" style={{ color: r.triggered > 0 ? C.amber : C.dim }}>
                  {r.triggered}×
                </td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => toggle(r.id)}
                    className="transition-colors"
                    style={{ color: r.enabled ? C.teal : C.dim }}
                  >
                    {r.enabled
                      ? <ToggleRight size={18} />
                      : <ToggleLeft size={18} />
                    }
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard",  icon: LayoutDashboard, label: "Dashboard"  },
  { id: "forecast",   icon: CalendarDays,    label: "Forecast"   },
  { id: "devices",    icon: MonitorSpeaker,  label: "Devices"    },
  { id: "automation", icon: ShieldCheck,     label: "Automation" },
  { id: "settings",   icon: Settings,        label: "Settings"   },
];

function Sidebar({
  tab, setTab, open, setOpen,
}: {
  tab: string; setTab: (t: string) => void; open: boolean; setOpen: (v: boolean) => void;
}) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40
          flex flex-col border-r border-border bg-card
          transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          w-52
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Gauge size={16} style={{ color: C.teal }} />
            <span className="font-700 tracking-tight text-sm" style={{ ...F.ui, fontWeight: 700, color: C.fg }}>
              Hushaar <span style={{ color: C.teal }}>AI</span>
            </span>
          </div>
          <button className="md:hidden" onClick={() => setOpen(false)}>
            <X size={14} style={{ color: C.dim }} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2">
          {NAV.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => { setTab(id); setOpen(false); }}
              className="flex items-center gap-3 px-3 py-2 text-xs transition-all"
              style={{
                ...F.ui,
                fontWeight: tab === id ? 600 : 400,
                color: tab === id ? C.teal : C.mid,
                background: tab === id ? `${C.teal}10` : "transparent",
                borderLeft: tab === id ? `2px solid ${C.teal}` : "2px solid transparent",
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>

        {/* Bottom status */}
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2 text-[10px]" style={{ ...F.data, color: C.dim }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#4caf50] animate-pulse" />
            MQTT connected
          </div>
          <div className="text-[10px] mt-1" style={{ ...F.data, color: C.dim }}>
            Chennai, IN · v2.1.4
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── Settings tab ─────────────────────────────────────────────────────────
function SettingsTab({
  target, setTarget, interval, setInterval,
}: {
  target: number; setTarget: (v: number) => void;
  interval: number; setInterval: (v: number) => void;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="border border-border bg-card p-5 space-y-5">
        <Label>System Configuration</Label>
        <Divider />
        {[
          { label: "Location", value: "Chennai, India", type: "text" },
          { label: "Weather API", value: "OpenWeatherMap · Active", type: "text" },
          { label: "MQTT Broker", value: "broker.hivemq.com:8883", type: "text" },
          { label: "Device ID", value: "ESP32-CLIMAI-01", type: "text" },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between">
            <Label>{label}</Label>
            <span className="text-xs" style={{ ...F.data, color: C.fg }}>{value}</span>
          </div>
        ))}
      </div>

      <div className="border border-border bg-card p-5 space-y-5">
        <Label>Prediction Parameters</Label>
        <Divider />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Default target temp</Label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTarget(Math.max(16, target - 1))}
                className="w-6 h-6 border border-border flex items-center justify-center"
                style={{ color: C.mid }}
              >
                <Minus size={10} />
              </button>
              <span className="text-sm w-12 text-center" style={{ ...F.data, color: C.teal }}>
                {target}°C
              </span>
              <button
                onClick={() => setTarget(Math.min(30, target + 1))}
                className="w-6 h-6 border border-border flex items-center justify-center"
                style={{ color: C.mid }}
              >
                <Plus size={10} />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>Fetch interval</Label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setInterval(Math.max(5, interval - 5))}
                className="w-6 h-6 border border-border flex items-center justify-center"
                style={{ color: C.mid }}
              >
                <Minus size={10} />
              </button>
              <span className="text-sm w-16 text-center" style={{ ...F.data, color: C.teal }}>
                {interval}min
              </span>
              <button
                onClick={() => setInterval(Math.min(60, interval + 5))}
                className="w-6 h-6 border border-border flex items-center justify-center"
                style={{ color: C.mid }}
              >
                <Plus size={10} />
              </button>
            </div>
          </div>
          {[
            { label: "Heatwave threshold", value: "34°C outdoor forecast" },
            { label: "Pre-cool lead time", value: "2 hours before peak" },
            { label: "Comfort band", value: "21°C – 25°C" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <Label>{label}</Label>
              <span className="text-xs" style={{ ...F.data, color: C.fg }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── App shell ────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark]           = useState(true);
  const [tab, setTab]             = useState("dashboard");
  const [sideOpen, setSideOpen]   = useState(false);
  const [time, setTime]           = useState(now());
  const [indoor, setIndoor]       = useState(24.1);
  const [outdoor, setOutdoor]     = useState(31.8);
  const [humidity, setHumidity]   = useState(61);
  const [acOn, setAcOn]           = useState(true);
  const [target, setTarget]       = useState(22);
  const [fanSpeed, setFanSpeed]   = useState<"LOW" | "MED" | "HIGH" | "AUTO">("AUTO");
  const [mode, setMode]           = useState<"COOL" | "HEAT" | "FAN" | "AUTO">("COOL");
  const [logs, setLogs]           = useState(seedLogs.map((l) => ({ ...l, t: now() })));
  const [forecast]                = useState(makeForecast);
  const [rules, setRules]         = useState(defaultRules);
  const [fetchInterval, setFetchInterval] = useState(15);

  // Recompute palette on theme change and push to CSS vars
  const TC = makeColors(dark);
  useEffect(() => {
    const r = document.documentElement.style;
    if (dark) {
      r.setProperty("--background", "#080e14");
      r.setProperty("--foreground", "#c8d8e4");
      r.setProperty("--card", "#0d1620");
      r.setProperty("--card-foreground", "#c8d8e4");
      r.setProperty("--secondary", "#111c28");
      r.setProperty("--muted", "#111c28");
      r.setProperty("--muted-foreground", "#4a6a80");
      r.setProperty("--border", "rgba(0,188,212,0.08)");
      r.setProperty("--input-background", "#111c28");
    } else {
      r.setProperty("--background", "#f0f4f8");
      r.setProperty("--foreground", "#0d1e2c");
      r.setProperty("--card", "#ffffff");
      r.setProperty("--card-foreground", "#0d1e2c");
      r.setProperty("--secondary", "#e4ecf2");
      r.setProperty("--muted", "#e4ecf2");
      r.setProperty("--muted-foreground", "#6a8a9a");
      r.setProperty("--border", "rgba(0,120,150,0.12)");
      r.setProperty("--input-background", "#e4ecf2");
    }
  }, [dark]);

  // Live sensor tick
  useEffect(() => {
    const t = setInterval(() => {
      setTime(now());
      setIndoor((v)   => parseFloat((v + rand(-0.05, 0.05)).toFixed(1)));
      setOutdoor((v)  => parseFloat((v + rand(-0.1, 0.15)).toFixed(1)));
      setHumidity((v) => Math.min(95, Math.max(30, v + rand(-0.3, 0.4))));
    }, 2000);
    return () => clearInterval(t);
  }, []);

  // MQTT log ticker
  useEffect(() => {
    const templates = [
      () => ({ topic: "climai/indoor",   msg: `temp=${indoor.toFixed(1)}°C hum=${Math.round(humidity)}% → nominal` }),
      () => ({ topic: "climai/outdoor",  msg: `temp=${outdoor.toFixed(1)}°C forecast=RISING` }),
      () => ({ topic: "climai/esp32",    msg: `heartbeat OK latency=0.${rand(8,15,0)}s rssi=-${rand(52,68,0)}dBm` }),
      () => ({ topic: "climai/cmd/ac",   msg: `HOLD target=${target}°C mode=${mode} fan=${fanSpeed}` }),
    ];
    const t = setInterval(() => {
      const fn = templates[Math.floor(Math.random() * templates.length)];
      setLogs((prev) => [...prev.slice(-30), { t: now(), ...fn() }]);
    }, 3500);
    return () => clearInterval(t);
  }, [indoor, outdoor, humidity, target, mode, fanSpeed]);

  const toggleRule = useCallback((id: number) => {
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }, []);

  const acStatus = acOn
    ? indoor <= target + 1 ? "OPTIMAL" : "COOLING"
    : "OFF";
  const acColor = acStatus === "OPTIMAL" ? C.green : acStatus === "COOLING" ? C.teal : C.dim;

  // Mutate module-level C so all child components pick up the right palette
  Object.assign(C, TC);

  return (
    <div
      className="flex h-screen overflow-hidden bg-background"
      style={{ ...F.ui, color: TC.fg }}
    >
      <Sidebar tab={tab} setTab={setTab} open={sideOpen} setOpen={setSideOpen} />

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Topbar */}
        <header className="flex items-center justify-between px-5 h-12 border-b border-border shrink-0 gap-4">
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setSideOpen(true)}>
              <Menu size={16} style={{ color: TC.mid }} />
            </button>
            <div className="flex items-center gap-1.5 text-[11px]" style={F.data}>
              <MapPin size={11} style={{ color: TC.teal }} />
              <span style={{ color: TC.mid }}>Chennai, IN</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px]" style={{ ...F.data, color: TC.dim }}>
              <RefreshCw size={10} />
              <span>Next fetch in {fetchInterval}min</span>
            </div>
            <div className="text-[11px]" style={{ ...F.data, color: TC.mid }}>{time}</div>
            <Pill label={acStatus} color={acColor} />
            <button
              onClick={() => setDark((d) => !d)}
              className="w-7 h-7 border flex items-center justify-center transition-colors hover:border-primary/40"
              style={{ borderColor: TC.border, color: TC.mid }}
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {dark ? <SunMedium size={13} /> : <Moon size={13} />}
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── DASHBOARD ── */}
          {tab === "dashboard" && (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                  icon={Thermometer} label="Indoor Temp"
                  value={indoor.toFixed(1)} unit="°C"
                  sub={`Target ${target}°C · ${indoor <= target + 1 ? "✓ On target" : "Cooling…"}`}
                  color={indoor > target + 2 ? C.amber : C.teal}
                />
                <StatCard
                  icon={Sun} label="Outdoor Temp"
                  value={outdoor.toFixed(1)} unit="°C"
                  sub="OpenWeatherMap · live"
                  color={outdoor > 34 ? C.red : outdoor > 28 ? C.amber : C.green}
                  alert={outdoor > 32}
                />
                <StatCard
                  icon={Droplets} label="Humidity"
                  value={Math.round(humidity)} unit="%"
                  sub={humidity > 70 ? "High — dehumidify soon" : "Comfortable"}
                  color={humidity > 75 ? C.amber : C.teal}
                />
                <StatCard
                  icon={Wifi} label="System Status"
                  value={acOn ? "ON" : "OFF"} unit=""
                  sub={`Mode: ${mode} · Fan: ${fanSpeed}`}
                  color={acColor}
                />
              </div>

              {/* Main 2-col grid */}
              <div className="grid lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 space-y-5">
                  <ForecastChart data={forecast} id="dash" />
                  <MQTTLog logs={logs} />
                </div>
                <div className="space-y-5">
                  <PredictionPanel outdoor={outdoor} indoor={indoor} target={target} />
                  <DeviceControl
                    acOn={acOn} setAcOn={setAcOn}
                    target={target} setTarget={setTarget}
                    fanSpeed={fanSpeed} setFanSpeed={setFanSpeed}
                    mode={mode} setMode={setMode}
                  />
                </div>
              </div>

              {/* Gauges row */}
              <div className="border border-border bg-card p-5">
                <div className="mb-4"><Label>Live Sensor Readings</Label></div>
                <div className="flex flex-wrap justify-around gap-6">
                  <GaugeRing value={parseFloat(indoor.toFixed(1))}  max={40} color={C.teal}   label="Indoor °C"  unit="°" />
                  <GaugeRing value={parseFloat(outdoor.toFixed(1))} max={45} color={C.amber}  label="Outdoor °C" unit="°" />
                  <GaugeRing value={Math.round(humidity)}           max={100} color={C.purple} label="Humidity %"  unit="%" />
                  <GaugeRing value={target}                         max={30}  color={C.green}  label="Target °C"  unit="°" />
                </div>
              </div>
            </>
          )}

          {/* ── FORECAST ── */}
          {tab === "forecast" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {["Now", "+6h", "+12h", "+24h"].map((t, i) => {
                  const d = forecast[i * 6];
                  return (
                    <div key={t} className="border border-border bg-card p-4">
                      <Label>{t}</Label>
                      <div className="text-2xl font-700 mt-2" style={{ ...F.ui, color: C.amber, fontWeight: 700 }}>
                        {d?.outdoor ?? "—"}°
                      </div>
                      <div className="text-[11px] mt-1" style={{ ...F.data, color: C.dim }}>
                        Hushaar AI indoor: {d?.climai ?? "—"}°C
                      </div>
                    </div>
                  );
                })}
              </div>
              <ForecastChart data={forecast} id="fcast" />
              <div className="border border-border bg-card p-4">
                <div className="mb-3"><Label>Satellite Forecast Summary</Label></div>
                <div className="space-y-2">
                  {[
                    { time: "Next 2h",   event: "Temperature rising to 35–36°C",          severity: "HIGH",   action: "Pre-cool initiated at 22°C target" },
                    { time: "Next 6h",   event: "Peak heat plateau — sustained 36°C+",     severity: "HIGH",   action: "Maintain cooling, monitor indoor drift" },
                    { time: "Next 12h",  event: "Temperature dropping, wind picking up",   severity: "LOW",    action: "Ease cooling, transition to fan-only" },
                    { time: "Next 24h",  event: "Overnight — mild 22°C expected",          severity: "LOW",    action: "System idle, minimal actuation" },
                  ].map(({ time, event, severity, action }) => (
                    <div key={time} className="flex gap-4 border-b border-border pb-2 last:border-0 last:pb-0">
                      <span className="text-[10px] shrink-0 w-16 pt-0.5" style={{ ...F.data, color: C.dim }}>{time}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs" style={{ ...F.ui, color: C.fg }}>{event}</span>
                          <Pill label={severity} color={severity === "HIGH" ? C.red : C.green} />
                        </div>
                        <div className="text-[10px]" style={{ ...F.data, color: C.teal }}>{action}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── DEVICES ── */}
          {tab === "devices" && (
            <div className="grid md:grid-cols-2 gap-5">
              <DeviceControl
                acOn={acOn} setAcOn={setAcOn}
                target={target} setTarget={setTarget}
                fanSpeed={fanSpeed} setFanSpeed={setFanSpeed}
                mode={mode} setMode={setMode}
              />
              <div className="space-y-5">
                <div className="border border-border bg-card p-5">
                  <div className="mb-4"><Label>ESP32 Hardware Status</Label></div>
                  <div className="space-y-3">
                    {[
                      { k: "Device ID",       v: "ESP32-CLIMAI-01" },
                      { k: "Firmware",        v: "v2.1.4 · up to date" },
                      { k: "WiFi SSID",       v: "HomeNet_5G" },
                      { k: "RSSI",            v: "-58 dBm · Strong" },
                      { k: "IR Library",      v: "IRremoteESP8266 · Ready" },
                      { k: "Last Command",    v: `PRE_COOL ${target}°C · ${time}` },
                      { k: "Uptime",          v: "3d 14h 22m" },
                    ].map(({ k, v }) => (
                      <div key={k} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                        <Label>{k}</Label>
                        <span className="text-xs" style={{ ...F.data, color: C.fg }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <MQTTLog logs={logs} />
              </div>
            </div>
          )}

          {/* ── AUTOMATION ── */}
          {tab === "automation" && (
            <div className="space-y-5">
              <AutomationTable rules={rules} toggle={toggleRule} />
              <PredictionPanel outdoor={outdoor} indoor={indoor} target={target} />
            </div>
          )}

          {/* ── SETTINGS ── */}
          {tab === "settings" && (
            <SettingsTab
              target={target} setTarget={setTarget}
              interval={fetchInterval} setInterval={setFetchInterval}
            />
          )}

        </main>
      </div>
    </div>
  );
}
