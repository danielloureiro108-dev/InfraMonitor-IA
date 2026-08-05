export interface ItemTrafego {
  chave: string; // IP ou nome de aplicação
  bytes: number;
  pct: number;
}

export interface EstatisticasTrafego {
  periodo: string;
  totalBytes: number;
  topIps: ItemTrafego[];
  topAplicacoes: ItemTrafego[];
}

function formatarBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

const PORTAS_SENSIVEIS = ["Telnet", "SMB", "RDP", "VNC"];

/** Gera insights por regras simples, sem depender de nenhuma API externa. Sempre disponível. */
function gerarInsightsHeuristicos(stats: EstatisticasTrafego): string[] {
  const insights: string[] = [];

  if (stats.totalBytes === 0) {
    return ["Ainda não há tráfego suficiente coletado neste período para gerar sugestões."];
  }

  const maiorIp = stats.topIps[0];
  if (maiorIp && maiorIp.pct > 40) {
    insights.push(
      `O IP ${maiorIp.chave} concentrou ${maiorIp.pct.toFixed(0)}% de todo o tráfego do período (${formatarBytes(maiorIp.bytes)}). Vale investigar se é um comportamento esperado (backup, servidor de arquivos) ou um consumo fora do padrão.`
    );
  }

  const aplicacaoSensivel = stats.topAplicacoes.find((a) => PORTAS_SENSIVEIS.some((p) => a.chave.includes(p)));
  if (aplicacaoSensivel) {
    insights.push(
      `Foi identificado tráfego de "${aplicacaoSensivel.chave}" (${formatarBytes(aplicacaoSensivel.bytes)}). Esse tipo de serviço costuma ser um alvo comum em movimentação lateral — confirme se o acesso está restrito à rede interna e aos hosts que realmente precisam dele.`
    );
  }

  const topAplicacao = stats.topAplicacoes[0];
  if (topAplicacao) {
    insights.push(`A aplicação com maior volume no período foi "${topAplicacao.chave}", responsável por ${topAplicacao.pct.toFixed(0)}% do tráfego (${formatarBytes(topAplicacao.bytes)}).`);
  }

  if (stats.topIps.length >= 5) {
    const top5Pct = stats.topIps.slice(0, 5).reduce((soma, ip) => soma + ip.pct, 0);
    if (top5Pct > 80) {
      insights.push(`Os 5 IPs mais ativos concentram ${top5Pct.toFixed(0)}% de todo o tráfego — a rede está com poucos "grandes consumidores" dominando o volume.`);
    }
  }

  if (insights.length === 0) {
    insights.push("O tráfego do período está distribuído de forma equilibrada entre os IPs e aplicações monitorados, sem nenhum ponto fora do padrão.");
  }

  return insights;
}

/** Usa a API da Anthropic para gerar uma análise mais rica, quando ANTHROPIC_API_KEY está configurada. */
async function gerarInsightsComClaude(stats: EstatisticasTrafego): Promise<string[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const resumo = `
Período analisado: ${stats.periodo}
Tráfego total: ${formatarBytes(stats.totalBytes)}

Top IPs por volume:
${stats.topIps.slice(0, 8).map((i) => `- ${i.chave}: ${formatarBytes(i.bytes)} (${i.pct.toFixed(1)}%)`).join("\n")}

Top aplicações por volume (heurística por porta):
${stats.topAplicacoes.slice(0, 8).map((a) => `- ${a.chave}: ${formatarBytes(a.bytes)} (${a.pct.toFixed(1)}%)`).join("\n")}
`.trim();

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: `Você é um analista de rede. Com base nestes dados agregados de tráfego (NetFlow/Syslog) de uma infraestrutura corporativa, escreva de 3 a 5 observações curtas e acionáveis em português do Brasil, em formato de lista, sem introdução nem conclusão. Foque em: concentração de tráfego, possíveis anomalias, riscos de segurança e sugestões de próximos passos. Seja direto e específico usando os números fornecidos.\n\n${resumo}`,
          },
        ],
      }),
    });

    if (!resp.ok) return null;
    const data: any = await resp.json();
    const texto = data.content?.map((b: any) => b.text).filter(Boolean).join("\n") || "";
    return texto
      .split("\n")
      .map((l: string) => l.replace(/^[-•*]\s*/, "").trim())
      .filter((l: string) => l.length > 0);
  } catch {
    return null;
  }
}

export async function gerarInsights(stats: EstatisticasTrafego): Promise<{ fonte: "ia" | "heuristica"; insights: string[] }> {
  const viaIA = await gerarInsightsComClaude(stats);
  if (viaIA && viaIA.length > 0) return { fonte: "ia", insights: viaIA };
  return { fonte: "heuristica", insights: gerarInsightsHeuristicos(stats) };
}
