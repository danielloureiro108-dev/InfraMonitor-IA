import { Moon, Sun, LogOut } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../../hooks/useTheme";

export function Topbar({ titulo }: { titulo: string }) {
  const { usuario, logout } = useAuth();
  const { escuro, definirTema } = useTheme();

  return (
    <header className="h-16 border-b border-surface-border flex items-center justify-between px-6 sticky top-0 bg-surface/80 backdrop-blur z-10">
      <h1 className="text-lg font-semibold text-foreground">{titulo}</h1>

      <div className="flex items-center gap-4">
        <button onClick={() => definirTema(!escuro)} className="btn-secondary !px-2 !py-2" title="Alternar tema">
          {escuro ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-surface-border">
          <div className="text-right leading-tight">
            <p className="text-sm font-medium text-foreground">{usuario?.nome}</p>
            <p className="text-xs text-foreground-subtle capitalize">{usuario?.perfil}</p>
          </div>
          <button onClick={logout} className="btn-secondary !px-2 !py-2" title="Sair">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
