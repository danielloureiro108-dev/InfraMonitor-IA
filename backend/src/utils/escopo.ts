import { query } from "../db";

export interface EscopoUsuario {
  restrito: boolean;
  empresaIds: string[];
  unidadeIds: string[];
}

/**
 * Carrega os clientes/unidades que um usuário pode ver. Administradores e
 * usuários sem nenhum vínculo cadastrado não são restritos (veem tudo,
 * comportamento padrão do sistema).
 */
export async function carregarEscopo(usuarioId: string, perfil: string): Promise<EscopoUsuario> {
  if (perfil === "administrador") return { restrito: false, empresaIds: [], unidadeIds: [] };

  const [{ rows: empresas }, { rows: unidades }] = await Promise.all([
    query<{ empresa_id: string }>(`SELECT empresa_id FROM usuario_clientes_permitidos WHERE usuario_id = $1`, [usuarioId]),
    query<{ unidade_id: string }>(`SELECT unidade_id FROM usuario_unidades_permitidas WHERE usuario_id = $1`, [usuarioId]),
  ]);

  const empresaIds = empresas.map((r) => r.empresa_id);
  const unidadeIds = unidades.map((r) => r.unidade_id);
  return { restrito: empresaIds.length > 0 || unidadeIds.length > 0, empresaIds, unidadeIds };
}

/**
 * Gera a condição SQL "(coluna_empresa = ANY($n) OR coluna_unidade = ANY($m))"
 * para restringir uma consulta ao escopo do usuário, empilhando os parâmetros
 * no array `valores` já em uso pela rota (mesmo padrão de $n incremental usado
 * nas outras rotas). Retorna null quando o usuário não é restrito.
 */
export function condicaoEscopo(
  escopo: EscopoUsuario,
  valores: any[],
  colunaEmpresa: string,
  colunaUnidade: string
): string | null {
  if (!escopo.restrito) return null;
  valores.push(escopo.empresaIds);
  const nEmpresa = valores.length;
  valores.push(escopo.unidadeIds);
  const nUnidade = valores.length;
  return `(${colunaEmpresa} = ANY($${nEmpresa}::uuid[]) OR ${colunaUnidade} = ANY($${nUnidade}::uuid[]))`;
}

/** Verifica se um cliente específico está dentro do escopo do usuário. */
export function empresaNoEscopo(escopo: EscopoUsuario, empresaId: string): boolean {
  return !escopo.restrito || escopo.empresaIds.includes(empresaId);
}

/** Verifica se um registro (com empresa_id/unidade_id próprios) está dentro do escopo do usuário. */
export function linhaNoEscopo(escopo: EscopoUsuario, empresaId?: string | null, unidadeId?: string | null): boolean {
  if (!escopo.restrito) return true;
  return (!!empresaId && escopo.empresaIds.includes(empresaId)) || (!!unidadeId && escopo.unidadeIds.includes(unidadeId));
}
