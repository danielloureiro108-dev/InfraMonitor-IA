# InfraMonitor AI — Agente (proxy de monitoramento)

Agente leve para instalar dentro da rede de um cliente quando o servidor do InfraMonitor AI não consegue alcançar os equipamentos diretamente (rede atrás de NAT/firewall, VPN não disponível etc.). O agente roda **dentro** da rede local, faz o ping/SNMP nos equipamentos e envia os resultados para o backend via HTTPS — funcionando como um "proxy" de monitoramento.

Funções:
- Busca a lista de equipamentos cadastrados no InfraMonitor (via API, com token) e monitora cada um respeitando o intervalo configurado no cadastro.
- Ping ICMP real (usa o `ping.exe` nativo do Windows por baixo dos panos — não precisa rodar como administrador).
- Consulta SNMP real (v1/v2c) para hostname/descrição/uptime.
- Opcional: relay local de NetFlow v5 e Syslog (útil quando os exportadores desses dados só alcançam a rede local, não a internet).

## Pré-requisitos

- [Node.js 20+](https://nodejs.org) instalado **apenas na máquina onde você vai compilar** o agente (a máquina final que vai rodar o agente só precisa do `.exe` gerado, não precisa ter Node instalado).

## 1. Configurar

```bash
cd agent
npm install
cp agent-config.example.json agent-config.json
```

Edite `agent-config.json`:

```json
{
  "backendUrl": "http://SEU-SERVIDOR:4000",
  "agentToken": "o-mesmo-valor-de-AGENT_TOKEN-do-.env-do-backend",
  "intervaloPadraoSegundos": 60,
  "netflow": { "ativo": false, "porta": 2055 },
  "syslog": { "ativo": false, "porta": 1514 }
}
```

No backend, defina `AGENT_TOKEN` no `.env` (qualquer string longa e aleatória) e suba de novo o container — sem isso, os endpoints do agente ficam desabilitados (retornam 503).

## 2. Rodar em modo desenvolvimento (testar antes de compilar)

```bash
npm run dev
```

## 3. Compilar para um `.exe` do Windows

```bash
npm run build:win
```

Isso gera `InfraMonitorAgent.exe` na pasta `agent/`. Copie esse arquivo **junto com** o `agent-config.json` para a máquina Windows de destino (os dois arquivos precisam estar na mesma pasta).

Para Linux, use `npm run build:linux` (gera um binário `InfraMonitorAgent`, mesma lógica).

## 4. Rodar no Windows

Teste primeiro rodando manualmente:

```powershell
.\InfraMonitorAgent.exe
```

Você deve ver os logs de ping/SNMP dos equipamentos no console.

## 5. Deixar rodando como serviço do Windows (inicia sozinho com o PC)

O jeito mais simples é usar o [NSSM](https://nssm.cc/) (Non-Sucking Service Manager), gratuito:

```powershell
# Baixe o NSSM (nssm.cc) e extraia, depois:
.\nssm.exe install InfraMonitorAgent "C:\caminho\completo\InfraMonitorAgent.exe"
.\nssm.exe set InfraMonitorAgent AppDirectory "C:\caminho\completo"
.\nssm.exe start InfraMonitorAgent
```

Alternativa sem instalar nada extra: crie uma tarefa no **Agendador de Tarefas do Windows** que executa o `.exe` "Ao fazer logon" ou "Na inicialização do sistema".

## Segurança

- O `agentToken` dá acesso de leitura à lista de equipamentos (incluindo a community SNMP em texto puro, necessária para o agente conseguir falar SNMP localmente) e permite gravar resultados de monitoramento. Trate-o como uma senha.
- Use sempre HTTPS em produção (`backendUrl` com `https://`) para o token e os dados não trafegarem em texto puro pela internet.
