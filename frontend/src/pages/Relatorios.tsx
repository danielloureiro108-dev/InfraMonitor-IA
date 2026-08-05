import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FileDown, Loader2, FileText } from "lucide-react";
import { api } from "../lib/api";
import { AppLayout } from "../components/layout/AppLayout";
import { Card } from "../components/ui/Card";
import { Empresa, Equipamento, Alerta } from "../types";

interface LinhaDisponibilidade {
  id: string;
  nome: string;
  ip: string;
  status: string;
  categoria_nome: string | null;
  total_amostras: number;
  amostras_online: number;
  disponibilidade_pct: number | string | null;
  latencia_media_ms: number | string | null;
}

const TIPOS = [
  { valor: "disponibilidade", rotulo: "Disponibilidade", descricao: "Percentual de uptime e latência média por equipamento no período." },
  { valor: "inventario", rotulo: "Inventário de Equipamentos", descricao: "Lista completa dos equipamentos cadastrados para o cliente (situação atual)." },
  { valor: "alertas", rotulo: "Alertas", descricao: "Histórico de alertas abertos/confirmados/resolvidos no período." },
];

function formatarDataBr(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function slug(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function Relatorios() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [tipo, setTipo] = useState("disponibilidade");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => { api.get<Empresa[]>("/org/empresas").then(setEmpresas); }, []);

  const empresaSelecionada = empresas.find((e) => e.id === empresaId) || null;

  function criarDocumentoBase(tituloRelatorio: string): jsPDF {
    const doc = new jsPDF();
    const empresa = empresaSelecionada!;

    if (empresa.logo_url) {
      try {
        doc.addImage(empresa.logo_url, "PNG", 14, 10, 18, 18);
      } catch {
        // Se por algum motivo a imagem não puder ser desenhada, o relatório segue sem o logo.
      }
    }

    const xTexto = empresa.logo_url ? 36 : 14;
    doc.setFontSize(15);
    doc.setTextColor(30, 30, 40);
    doc.text(empresa.nome, xTexto, 18);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 110);
    doc.text(tituloRelatorio, xTexto, 24);

    doc.setDrawColor(67, 56, 202);
    doc.setLineWidth(0.8);
    doc.line(14, 30, 196, 30);

    const periodoTexto = inicio && fim ? `Período: ${formatarDataBr(inicio)} a ${formatarDataBr(fim)}` : "Período: últimos 30 dias";
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 130);
    doc.text(periodoTexto, 14, 36);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 196, 36, { align: "right" });

    return doc;
  }

  function adicionarRodape(doc: jsPDF) {
    const paginas = doc.getNumberOfPages();
    for (let i = 1; i <= paginas; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 160);
      doc.text("Gerado por InfraMonitor AI", 14, 290);
      doc.text(`Página ${i} de ${paginas}`, 196, 290, { align: "right" });
    }
  }

  async function gerarDisponibilidade() {
    const params = new URLSearchParams({ empresa_id: empresaId });
    if (inicio) params.set("inicio", inicio);
    if (fim) params.set("fim", fim);
    const linhas = await api.get<LinhaDisponibilidade[]>(`/relatorios/disponibilidade?${params.toString()}`);

    const doc = criarDocumentoBase("Relatório de Disponibilidade");
    autoTable(doc, {
      startY: 42,
      head: [["Equipamento", "IP", "Categoria", "Status", "Disponibilidade", "Latência média"]],
      body: linhas.map((l) => [
        l.nome,
        l.ip,
        l.categoria_nome || "—",
        l.status,
        l.total_amostras > 0 ? `${l.disponibilidade_pct}%` : "sem dados no período",
        l.latencia_media_ms ? `${l.latencia_media_ms} ms` : "—",
      ]),
      headStyles: { fillColor: [67, 56, 202] },
      styles: { fontSize: 9 },
    });
    adicionarRodape(doc);
    doc.save(`disponibilidade-${slug(empresaSelecionada!.nome)}.pdf`);
  }

  async function gerarInventario() {
    const equipamentos = await api.get<Equipamento[]>(`/equipamentos?empresa_id=${empresaId}`);

    const doc = criarDocumentoBase("Relatório de Inventário");
    autoTable(doc, {
      startY: 42,
      head: [["Equipamento", "IP", "Categoria", "Fabricante", "Modelo", "Sistema Operacional", "Patrimônio"]],
      body: equipamentos.map((e) => [
        e.nome, e.ip, e.categoria_nome || "—", e.fabricante || "—", e.modelo || "—", e.sistema_operacional || "—", e.patrimonio || "—",
      ]),
      headStyles: { fillColor: [67, 56, 202] },
      styles: { fontSize: 8 },
    });
    adicionarRodape(doc);
    doc.save(`inventario-${slug(empresaSelecionada!.nome)}.pdf`);
  }

  async function gerarAlertas() {
    const params = new URLSearchParams({ empresa_id: empresaId });
    if (inicio) params.set("inicio", inicio);
    if (fim) params.set("fim", fim);
    const alertas = await api.get<Alerta[]>(`/alertas?${params.toString()}`);

    const doc = criarDocumentoBase("Relatório de Alertas");
    autoTable(doc, {
      startY: 42,
      head: [["Quando", "Equipamento", "Tipo", "Severidade", "Status", "Mensagem"]],
      body: alertas.map((a) => [
        new Date(a.criado_em).toLocaleString("pt-BR"),
        `${a.equipamento_nome} (${a.equipamento_ip})`,
        a.tipo, a.severidade, a.status, a.mensagem,
      ]),
      headStyles: { fillColor: [67, 56, 202] },
      styles: { fontSize: 8 },
      columnStyles: { 5: { cellWidth: 55 } },
    });
    adicionarRodape(doc);
    doc.save(`alertas-${slug(empresaSelecionada!.nome)}.pdf`);
  }

  async function gerarPdf() {
    if (!empresaId) {
      setErro("Selecione um cliente antes de gerar o relatório.");
      return;
    }
    setErro(null);
    setGerando(true);
    try {
      if (tipo === "disponibilidade") await gerarDisponibilidade();
      else if (tipo === "inventario") await gerarInventario();
      else await gerarAlertas();
    } catch (e: any) {
      setErro(e.message || "Não foi possível gerar o relatório.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <AppLayout titulo="Relatórios">
      <Card className="max-w-2xl">
        <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <FileText size={16} className="text-brand" /> Gerar relatório em PDF
        </h3>
        <p className="text-xs text-foreground-subtle mb-5">
          O relatório sai com o logo e o nome do cliente selecionado no cabeçalho. Cadastre o logo em Configurações → Clientes.
        </p>

        <div className="space-y-4">
          <div>
            <label className="label">Cliente *</label>
            <select className="input" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
              <option value="">Selecione um cliente…</option>
              {empresas.map((emp) => <option key={emp.id} value={emp.id}>{emp.nome}</option>)}
            </select>
            {empresaSelecionada && !empresaSelecionada.logo_url && (
              <p className="text-xs text-foreground-subtle mt-1">
                Esse cliente ainda não tem logo cadastrado — o relatório sai só com o nome. Adicione um logo em Configurações → Clientes para deixá-lo com a marca do cliente.
              </p>
            )}
          </div>

          <div>
            <label className="label">Tipo de relatório</label>
            <div className="grid grid-cols-1 gap-2">
              {TIPOS.map((t) => (
                <label
                  key={t.valor}
                  className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                    tipo === t.valor ? "border-brand bg-brand/5" : "border-surface-border hover:border-brand/50"
                  }`}
                >
                  <input type="radio" name="tipo" className="mt-1" checked={tipo === t.valor} onChange={() => setTipo(t.valor)} />
                  <div>
                    <p className="text-sm text-foreground font-medium">{t.rotulo}</p>
                    <p className="text-xs text-foreground-subtle">{t.descricao}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {tipo !== "inventario" && (
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="label">De</label>
                <input type="date" className="input" value={inicio} onChange={(e) => setInicio(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="label">Até</label>
                <input type="date" className="input" value={fim} onChange={(e) => setFim(e.target.value)} />
              </div>
            </div>
          )}

          {erro && <p className="text-sm text-red-400">{erro}</p>}

          <button className="btn-primary w-full" onClick={gerarPdf} disabled={gerando}>
            {gerando ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
            {gerando ? "Gerando…" : "Gerar PDF"}
          </button>
        </div>
      </Card>
    </AppLayout>
  );
}
