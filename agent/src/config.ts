import fs from "fs";
import path from "path";

export interface AgentConfig {
  backendUrl: string;
  agentToken: string;
  intervaloPadraoSegundos: number;
  netflow: { ativo: boolean; porta: number };
  syslog: { ativo: boolean; porta: number };
}

const PADRAO: AgentConfig = {
  backendUrl: "http://localhost:4000",
  agentToken: "",
  intervaloPadraoSegundos: 60,
  netflow: { ativo: false, porta: 2055 },
  syslog: { ativo: false, porta: 1514 },
};

/**
 * Procura "agent-config.json" na pasta atual (ou ao lado do .exe quando
 * compilado com pkg — process.execPath aponta pro binário nesse caso).
 */
export function carregarConfig(): AgentConfig {
  const candidatos = [
    path.join(process.cwd(), "agent-config.json"),
    path.join(path.dirname(process.execPath), "agent-config.json"),
  ];

  for (const caminho of candidatos) {
    if (fs.existsSync(caminho)) {
      const conteudo = JSON.parse(fs.readFileSync(caminho, "utf8"));
      return { ...PADRAO, ...conteudo };
    }
  }

  console.error(
    "[config] Nenhum agent-config.json encontrado. Copie agent-config.example.json para agent-config.json (na mesma pasta do executável) e preencha backendUrl/agentToken."
  );
  process.exit(1);
}
