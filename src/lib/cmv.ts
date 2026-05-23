import { supabase } from './supabase';
import type { Insumo, UnidadeInsumo } from '../types/database';
import { precoVenda } from '../types/database';
import type { ProdutoWithCategorias } from '../types/database';

export type InsumoRow = Insumo;

export type FichaTecnicaLinha = {
  insumo_id: string;
  insumo_nome: string;
  unidade: string;
  custo_unitario: number;
  quantidade: number;
  custo_linha: number;
};

export type CmvPorProduto = {
  produto_id: string;
  codigo: string;
  nome: string;
  quantidadeVendida: number;
  receita: number;
  custoUnitarioFicha: number;
  cmv: number;
  margem: number;
  semFicha: boolean;
};

export type CmvPorCategoria = {
  categoria_id: string;
  categoria_nome: string;
  quantidadeVendida: number;
  receita: number;
  cmv: number;
  margem: number;
};

export type CmvPorOrigem = {
  origem: 'presencial' | 'online' | 'viagem';
  receita: number;
  cmv: number;
  margem: number;
  pedidos: number;
};

export type RelatorioCmv = {
  resumo: {
    receitaLiquida: number;
    receitaItens: number;
    descontos: number;
    taxasEntrega: number;
    cmvTotal: number;
    margemBruta: number;
    margemPercent: number;
    pedidosCount: number;
  };
  porProduto: CmvPorProduto[];
  porCategoria: CmvPorCategoria[];
  porOrigem: CmvPorOrigem[];
  semFicha: { produto_id: string; codigo: string; nome: string; quantidadeVendida: number }[];
};

export function calcularCustoFicha(
  linhas: { quantidade: number; custo_unitario: number }[]
): number {
  return linhas.reduce((s, l) => s + Number(l.quantidade) * Number(l.custo_unitario), 0);
}

export async function getInsumos(): Promise<InsumoRow[]> {
  const { data, error } = await supabase.from('insumos').select('*').order('nome');
  if (error) throw error;
  return (data ?? []) as InsumoRow[];
}

export async function saveInsumo(payload: {
  id?: string;
  nome: string;
  unidade: UnidadeInsumo;
  custo_unitario: number;
  ativo: boolean;
}): Promise<void> {
  const now = new Date().toISOString();
  const row = {
    nome: payload.nome.trim(),
    unidade: payload.unidade,
    custo_unitario: Math.max(0, Number(payload.custo_unitario)),
    ativo: payload.ativo,
    updated_at: now,
  };
  if (payload.id) {
    const { error } = await (supabase as any).from('insumos').update(row).eq('id', payload.id);
    if (error) throw error;
  } else {
    const { error } = await (supabase as any).from('insumos').insert(row);
    if (error) throw error;
  }
}

export async function deleteInsumo(insumoId: string): Promise<void> {
  const { data: uso } = await supabase.from('produto_insumos').select('produto_id').eq('insumo_id', insumoId).limit(1);
  if ((uso ?? []).length > 0) {
    throw new Error('Não é possível excluir: insumo usado em ficha técnica de produto.');
  }
  const { error } = await supabase.from('insumos').delete().eq('id', insumoId);
  if (error) throw error;
}

export async function getFichaTecnicaProduto(produtoId: string): Promise<FichaTecnicaLinha[]> {
  const { data, error } = await supabase
    .from('produto_insumos')
    .select('quantidade, insumo_id, insumos(id, nome, unidade, custo_unitario)')
    .eq('produto_id', produtoId);
  if (error) throw error;
  return (data ?? []).map((row: any) => {
    const ins = row.insumos as { nome: string; unidade: string; custo_unitario: number };
    const custo_unitario = Number(ins.custo_unitario);
    const quantidade = Number(row.quantidade);
    return {
      insumo_id: row.insumo_id,
      insumo_nome: ins.nome,
      unidade: ins.unidade,
      custo_unitario,
      quantidade,
      custo_linha: quantidade * custo_unitario,
    };
  });
}

export async function saveFichaTecnicaProduto(
  produtoId: string,
  linhas: { insumo_id: string; quantidade: number }[]
): Promise<void> {
  await (supabase as any).from('produto_insumos').delete().eq('produto_id', produtoId);
  const validas = linhas.filter((l) => l.insumo_id && Number(l.quantidade) > 0);
  if (validas.length > 0) {
    const { error } = await (supabase as any).from('produto_insumos').insert(
      validas.map((l) => ({
        produto_id: produtoId,
        insumo_id: l.insumo_id,
        quantidade: Number(l.quantidade),
      }))
    );
    if (error) throw error;
  }
}

async function loadCustoUnitarioPorProduto(produtoIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!produtoIds.length) return map;
  const { data, error } = await supabase
    .from('produto_insumos')
    .select('produto_id, quantidade, insumos(custo_unitario)')
    .in('produto_id', produtoIds);
  if (error) throw error;
  const acc = new Map<string, number>();
  for (const row of data ?? []) {
    const pid = (row as any).produto_id as string;
    const qtd = Number((row as any).quantidade);
    const custo = Number((row as any).insumos?.custo_unitario ?? 0);
    acc.set(pid, (acc.get(pid) ?? 0) + qtd * custo);
  }
  for (const [pid, v] of acc) map.set(pid, v);
  return map;
}

const PEDIDOS_PAGE = 1000;
const ITENS_IN_CHUNK = 150;

async function fetchPedidosCmvPeriodo(
  desdeIso: string,
  ateIso: string
): Promise<{ id: string; origem: string; desconto: number; taxa_entrega: number }[]> {
  const all: { id: string; origem: string; desconto: number; taxa_entrega: number }[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('pedidos')
      .select('id, origem, desconto, taxa_entrega')
      .eq('status', 'finalizado')
      .gte('encerrado_em', desdeIso)
      .lte('encerrado_em', ateIso)
      .order('encerrado_em', { ascending: true })
      .range(offset, offset + PEDIDOS_PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as { id: string; origem: string; desconto: number; taxa_entrega: number }[];
    all.push(...batch);
    if (batch.length < PEDIDOS_PAGE) break;
    offset += PEDIDOS_PAGE;
  }
  return all;
}

export async function getRelatorioCmv(desdeIso: string, ateIso: string): Promise<RelatorioCmv> {
  const pedidos = await fetchPedidosCmvPeriodo(desdeIso, ateIso);

  if (!pedidos.length) {
    return {
      resumo: {
        receitaLiquida: 0,
        receitaItens: 0,
        descontos: 0,
        taxasEntrega: 0,
        cmvTotal: 0,
        margemBruta: 0,
        margemPercent: 0,
        pedidosCount: 0,
      },
      porProduto: [],
      porCategoria: [],
      porOrigem: [],
      semFicha: [],
    };
  }

  const pedidoIds = pedidos.map((p) => p.id);
  const pedidoOrigem = new Map(pedidos.map((p) => [p.id, p.origem as 'presencial' | 'online' | 'viagem']));

  const itens: { pedido_id: string; produto_id: string; quantidade: number; valor_unitario: number }[] = [];
  for (let i = 0; i < pedidoIds.length; i += ITENS_IN_CHUNK) {
    const chunk = pedidoIds.slice(i, i + ITENS_IN_CHUNK);
    const { data: itensData, error: itensErr } = await supabase
      .from('pedido_itens')
      .select('pedido_id, produto_id, quantidade, valor_unitario')
      .in('pedido_id', chunk);
    if (itensErr) throw itensErr;
    itens.push(...((itensData ?? []) as typeof itens));
  }

  const subtotalPorPedido: Record<string, number> = {};
  for (const i of itens) {
    subtotalPorPedido[i.pedido_id] = (subtotalPorPedido[i.pedido_id] ?? 0) + i.quantidade * Number(i.valor_unitario);
  }

  let receitaLiquida = 0;
  let descontos = 0;
  let taxasEntrega = 0;
  for (const p of pedidos) {
    const sub = subtotalPorPedido[p.id] ?? 0;
    const desc = Number(p.desconto ?? 0);
    const taxa = Number(p.taxa_entrega ?? 0);
    descontos += desc;
    taxasEntrega += taxa;
    receitaLiquida += Math.max(0, sub - desc + taxa);
  }

  const receitaItens = itens.reduce((s, i) => s + i.quantidade * Number(i.valor_unitario), 0);

  const produtoIds = [...new Set(itens.map((i) => i.produto_id))];
  const custoPorProduto = await loadCustoUnitarioPorProduto(produtoIds);

  const { data: produtosData } = await supabase
    .from('produtos')
    .select('id, codigo, nome, descricao, produto_categorias(categoria_id, categorias(id, nome))')
    .in('id', produtoIds);
  const produtoInfo = new Map<string, { codigo: string; nome: string; categorias: { id: string; nome: string }[] }>();
  for (const p of produtosData ?? []) {
    const row = p as any;
    const cats = (row.produto_categorias ?? []).map((pc: any) => ({
      id: pc.categorias?.id ?? pc.categoria_id,
      nome: pc.categorias?.nome ?? 'Sem categoria',
    }));
    produtoInfo.set(row.id, {
      codigo: row.codigo,
      nome: row.nome?.trim() || row.descricao,
      categorias: cats.length ? cats : [{ id: '_sem', nome: 'Sem categoria' }],
    });
  }

  const aggProduto = new Map<
    string,
    { quantidadeVendida: number; receita: number; cmv: number }
  >();
  const aggOrigem = new Map<string, { receita: number; cmv: number; pedidos: Set<string> }>();
  for (const origem of ['presencial', 'online', 'viagem'] as const) {
    aggOrigem.set(origem, { receita: 0, cmv: 0, pedidos: new Set() });
  }

  let cmvTotal = 0;

  for (const item of itens) {
    const qtd = Number(item.quantidade);
    const receitaLinha = qtd * Number(item.valor_unitario);
    const custoUnit = custoPorProduto.get(item.produto_id) ?? 0;
    const cmvLinha = qtd * custoUnit;
    cmvTotal += cmvLinha;

    const cur = aggProduto.get(item.produto_id) ?? { quantidadeVendida: 0, receita: 0, cmv: 0 };
    cur.quantidadeVendida += qtd;
    cur.receita += receitaLinha;
    cur.cmv += cmvLinha;
    aggProduto.set(item.produto_id, cur);

    const origem = pedidoOrigem.get(item.pedido_id) ?? 'presencial';
    const o = aggOrigem.get(origem)!;
    o.receita += receitaLinha;
    o.cmv += cmvLinha;
    o.pedidos.add(item.pedido_id);
  }

  const porProduto: CmvPorProduto[] = [];
  const semFicha: RelatorioCmv['semFicha'] = [];

  for (const [produtoId, agg] of aggProduto) {
    const info = produtoInfo.get(produtoId);
    const custoUnitarioFicha = custoPorProduto.get(produtoId) ?? 0;
    const semFichaFlag = custoUnitarioFicha <= 0;
    const codigo = info?.codigo ?? '-';
    const nome = info?.nome ?? '-';
    if (semFichaFlag && agg.quantidadeVendida > 0) {
      semFicha.push({ produto_id: produtoId, codigo, nome, quantidadeVendida: agg.quantidadeVendida });
    }
    porProduto.push({
      produto_id: produtoId,
      codigo,
      nome,
      quantidadeVendida: agg.quantidadeVendida,
      receita: agg.receita,
      custoUnitarioFicha: custoUnitarioFicha,
      cmv: agg.cmv,
      margem: agg.receita - agg.cmv,
      semFicha: semFichaFlag,
    });
  }
  porProduto.sort((a, b) => b.cmv - a.cmv);

  const aggCat = new Map<string, CmvPorCategoria>();
  for (const row of porProduto) {
    const info = produtoInfo.get(row.produto_id);
    const cats = info?.categorias ?? [{ id: '_sem', nome: 'Sem categoria' }];
    for (const cat of cats) {
      const cur = aggCat.get(cat.id) ?? {
        categoria_id: cat.id,
        categoria_nome: cat.nome,
        quantidadeVendida: 0,
        receita: 0,
        cmv: 0,
        margem: 0,
      };
      cur.quantidadeVendida += row.quantidadeVendida;
      cur.receita += row.receita;
      cur.cmv += row.cmv;
      cur.margem = cur.receita - cur.cmv;
      aggCat.set(cat.id, cur);
    }
  }
  const porCategoria = [...aggCat.values()].sort((a, b) => b.cmv - a.cmv);

  const porOrigem: CmvPorOrigem[] = (['presencial', 'online', 'viagem'] as const).map((origem) => {
    const o = aggOrigem.get(origem)!;
    return {
      origem,
      receita: o.receita,
      cmv: o.cmv,
      margem: o.receita - o.cmv,
      pedidos: o.pedidos.size,
    };
  });

  const margemBruta = receitaLiquida - cmvTotal;
  const margemPercent = receitaLiquida > 0 ? (margemBruta / receitaLiquida) * 100 : 0;

  return {
    resumo: {
      receitaLiquida,
      receitaItens,
      descontos,
      taxasEntrega,
      cmvTotal,
      margemBruta,
      margemPercent,
      pedidosCount: pedidos.length,
    },
    porProduto,
    porCategoria,
    porOrigem,
    semFicha: semFicha.sort((a, b) => b.quantidadeVendida - a.quantidadeVendida),
  };
}

export function margemTeoricaProduto(produto: Pick<ProdutoWithCategorias, 'valor' | 'em_promocao' | 'valor_promocional'>, custoFicha: number): number | null {
  const preco = precoVenda(produto);
  if (preco <= 0) return null;
  return ((preco - custoFicha) / preco) * 100;
}
