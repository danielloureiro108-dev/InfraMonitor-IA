import { StatusEquipamento } from "../../types";
import clsx from "clsx";

const ROTULOS: Record<StatusEquipamento, string> = {
  online: "Online",
  offline: "Offline",
  instavel: "Instável",
  desconhecido: "Desconhecido",
};

export function StatusBadge({ status }: { status: StatusEquipamento }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
      <span className={clsx("status-dot", `status-dot--${status}`)} />
      {ROTULOS[status]}
    </span>
  );
}
