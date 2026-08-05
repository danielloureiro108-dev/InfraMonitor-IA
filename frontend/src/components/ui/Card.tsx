import { ReactNode } from "react";
import clsx from "clsx";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("card", className)}>{children}</div>;
}

export function KpiCard({
  titulo,
  valor,
  sufixo,
  icone,
}: {
  titulo: string;
  valor: string | number;
  sufixo?: string;
  icone?: ReactNode;
}) {
  return (
    <Card className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-foreground-muted uppercase tracking-wide">{titulo}</p>
        <p className="mt-2 text-2xl font-semibold text-foreground font-mono">
          {valor}
          {sufixo && <span className="text-sm text-foreground-muted ml-1">{sufixo}</span>}
        </p>
      </div>
      {icone && <div className="text-brand">{icone}</div>}
    </Card>
  );
}
