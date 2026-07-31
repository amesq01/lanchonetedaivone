import type { ProdutoWithCategorias } from '../types/database';

type ProdutoComMinimo = { quantidade_minima?: number | null } | null | undefined;

/** Quantidade mínima de pedido do produto (loja online, mesa e viagem). Default 1. */
export function quantidadeMinimaProduto(produto: ProdutoComMinimo): number {
  const n = Number(produto?.quantidade_minima);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

/** Alias mantido para a loja online. */
export const quantidadeMinimaLoja = quantidadeMinimaProduto;

/** Se algum item estiver abaixo do mínimo, retorna a mensagem de erro; senão null. */
export function mensagemQuantidadeMinima(
  itens: {
    produto: {
      quantidade_minima?: number | null;
      nome?: string | null;
      descricao?: string | null;
    };
    quantidade: number;
  }[],
): string | null {
  for (const item of itens) {
    const min = quantidadeMinimaProduto(item.produto);
    if (item.quantidade < min) {
      const nome = (item.produto.nome?.trim() || item.produto.descricao || 'este produto').trim();
      return `Pedido mínimo de ${min} unidades para ${nome}.`;
    }
  }
  return null;
}

/** Produto não pode ser vendido na loja online: inativo no admin ou estoque ≤ 0. */
export function produtoIndisponivelNoCardapio(p: Pick<ProdutoWithCategorias, 'ativo' | 'quantidade'>): boolean {
  if (p.ativo === false) return true;
  return Number(p.quantidade ?? 0) <= 0;
}
