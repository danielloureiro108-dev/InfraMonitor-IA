import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppLayout({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <Topbar titulo={titulo} />
        <main className="p-6 max-w-[1600px] mx-auto">{children}</main>
      </div>
    </div>
  );
}
