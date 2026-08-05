import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Server, Map, History, BellRing, ScanSearch, Settings, Waves, FileText,
} from "lucide-react";
import clsx from "clsx";

const ITENS = [
  { to: "/", label: "Dashboard", icone: LayoutDashboard, fim: true },
  { to: "/equipamentos", label: "Equipamentos", icone: Server },
  { to: "/mapa", label: "Mapa", icone: Map },
  { to: "/trafego", label: "Tráfego", icone: Waves },
  { to: "/historico", label: "Histórico", icone: History },
  { to: "/alertas", label: "Alertas", icone: BellRing },
  { to: "/relatorios", label: "Relatórios", icone: FileText },
  { to: "/descoberta", label: "Descoberta", icone: ScanSearch },
  { to: "/configuracoes", label: "Configurações", icone: Settings },
];

export function Sidebar() {
  return (
    <aside className="w-60 shrink-0 bg-surface-raised border-r border-surface-border h-screen sticky top-0 flex flex-col">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-surface-border">
        <img src="/favicon.svg" alt="" className="w-7 h-7 rounded-lg" />
        <span className="font-semibold text-foreground tracking-tight">InfraMonitor AI</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {ITENS.map(({ to, label, icone: Icone, fim }) => (
          <NavLink
            key={to}
            to={to}
            end={fim}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand/15 text-brand"
                  : "text-foreground-muted hover:text-foreground hover:bg-foreground/5"
              )
            }
          >
            <Icone size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-surface-border text-xs text-foreground-subtle">
        InfraMonitor AI v1.0 · MVP
      </div>
    </aside>
  );
}
