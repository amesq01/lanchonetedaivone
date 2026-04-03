import type { ProdutoWithCategorias } from '../types/database';

/** Produto não pode ser vendido na loja online: inativo no admin ou estoque ≤ 0. */
export function produtoIndisponivelNoCardapio(p: Pick<ProdutoWithCategorias, 'ativo' | 'quantidade'>): boolean {
  if (p.ativo === false) return true;
  return Number(p.quantidade ?? 0) <= 0;
}
