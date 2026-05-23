import { supabase } from './supabase';
import type { CaixaCategoria, CaixaSaida } from '../types/database';

const TIMEZONE_BR = 'America/Sao_Paulo';

export type CaixaCategoriaRow = CaixaCategoria;

export type CaixaSaidaRow = CaixaSaida & {
  categoria_nome: string;
};

export type FluxoPorCategoria = {
  categoria_id: string;
  categoria_nome: string;
  total: number;
};

export type RelatorioFluxoCaixa = {
  resumo: {
    entradasVendas: number;
    pedidosCount: number;
    saidasTotal: number;
    saldo: number;
  };
  porCategoria: FluxoPorCategoria[];
  saidas: CaixaSaidaRow[];
};

function parseUtcInstant(s: string): number {
  if (s.includes('T')) return new Date(s).getTime();
  return new Date(s.replace(' ', 'T') + 'Z').getTime();
}

/** Converte intervalo UTC (ISO ou YYYY-MM-DD HH:mm:ss) em datas de calendário em Brasília. */
export function utcRangeToBrDateBounds(desde: string, ate: string): { desdeDate: string; ateDate: string } {
  const desdeMs = parseUtcInstant(desde);
  const ateMs = parseUtcInstant(ate);
  const opts: Intl.DateTimeFormatOptions = { timeZone: TIMEZONE_BR, year: 'numeric', month: '2-digit', day: '2-digit' };
  const fmt = (ms: number) => {
    const parts = new Intl.DateTimeFormat('en-CA', opts).formatToParts(new Date(ms));
    const y = parts.find((p) => p.type === 'year')!.value;
    const m = parts.find((p) => p.type === 'month')!.value;
    const d = parts.find((p) => p.type === 'day')!.value;
    return `${y}-${m}-${d}`;
  };
  return { desdeDate: fmt(desdeMs), ateDate: fmt(ateMs) };
}

const PEDIDOS_PAGE = 1000;
const ITENS_IN_CHUNK = 150;

async function fetchPedidosFinalizadosPeriodo(
  desdeIso: string,
  ateIso: string
): Promise<{ id: string; desconto: number; taxa_entrega: number }[]> {
  const all: { id: string; desconto: number; taxa_entrega: number }[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('pedidos')
      .select('id, desconto, taxa_entrega')
      .eq('status', 'finalizado')
      .gte('encerrado_em', desdeIso)
      .lte('encerrado_em', ateIso)
      .order('encerrado_em', { ascending: true })
      .range(offset, offset + PEDIDOS_PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as { id: string; desconto: number; taxa_entrega: number }[];
    all.push(...batch);
    if (batch.length < PEDIDOS_PAGE) break;
    offset += PEDIDOS_PAGE;
  }
  return all;
}

async function fetchItensDosPedidos(
  pedidoIds: string[]
): Promise<{ pedido_id: string; quantidade: number; valor_unitario: number }[]> {
  const all: { pedido_id: string; quantidade: number; valor_unitario: number }[] = [];
  for (let i = 0; i < pedidoIds.length; i += ITENS_IN_CHUNK) {
    const chunk = pedidoIds.slice(i, i + ITENS_IN_CHUNK);
    const { data, error } = await supabase
      .from('pedido_itens')
      .select('pedido_id, quantidade, valor_unitario')
      .in('pedido_id', chunk);
    if (error) throw error;
    all.push(...((data ?? []) as { pedido_id: string; quantidade: number; valor_unitario: number }[]));
  }
  return all;
}

/** Receita líquida de pedidos finalizados no período (encerrado_em), igual ao relatório financeiro. */
export async function calcularEntradasVendas(
  desdeIso: string,
  ateIso: string
): Promise<{ total: number; pedidosCount: number }> {
  const pedidos = await fetchPedidosFinalizadosPeriodo(desdeIso, ateIso);
  if (!pedidos.length) return { total: 0, pedidosCount: 0 };

  const pedidoIds = pedidos.map((p) => p.id);
  const itens = await fetchItensDosPedidos(pedidoIds);

  const subtotalPorPedido: Record<string, number> = {};
  for (const i of itens) {
    subtotalPorPedido[i.pedido_id] = (subtotalPorPedido[i.pedido_id] ?? 0) + i.quantidade * Number(i.valor_unitario);
  }

  let total = 0;
  for (const p of pedidos) {
    const sub = subtotalPorPedido[p.id] ?? 0;
    const desc = Number(p.desconto ?? 0);
    const taxa = Number(p.taxa_entrega ?? 0);
    total += Math.max(0, sub - desc + taxa);
  }
  return { total, pedidosCount: pedidos.length };
}

export async function getCaixaCategorias(): Promise<CaixaCategoriaRow[]> {
  const { data, error } = await supabase.from('caixa_categorias').select('*').order('ordem').order('nome');
  if (error) throw error;
  return (data ?? []) as CaixaCategoriaRow[];
}

export async function saveCaixaCategoria(payload: {
  id?: string;
  nome: string;
  ativo?: boolean;
}): Promise<void> {
  const nome = payload.nome.trim();
  if (!nome) throw new Error('Informe o nome da categoria.');
  if (payload.id) {
    const { error } = await (supabase as any)
      .from('caixa_categorias')
      .update({ nome, ativo: payload.ativo ?? true })
      .eq('id', payload.id);
    if (error) throw error;
  } else {
    const { data: maxOrd } = await supabase.from('caixa_categorias').select('ordem').order('ordem', { ascending: false }).limit(1);
    const ordem = ((maxOrd?.[0] as { ordem?: number } | undefined)?.ordem ?? 0) + 1;
    const { error } = await (supabase as any).from('caixa_categorias').insert({ nome, ordem, ativo: true });
    if (error) throw error;
  }
}

export async function deleteCaixaCategoria(id: string): Promise<void> {
  const { data: uso } = await supabase.from('caixa_saidas').select('id').eq('categoria_id', id).limit(1);
  if ((uso ?? []).length > 0) {
    throw new Error('Não é possível excluir: categoria com lançamentos de saída.');
  }
  const { error } = await supabase.from('caixa_categorias').delete().eq('id', id);
  if (error) throw error;
}

export async function getCaixaSaidas(desdeIso: string, ateIso: string): Promise<CaixaSaidaRow[]> {
  const { desdeDate, ateDate } = utcRangeToBrDateBounds(desdeIso, ateIso);
  const { data, error } = await supabase
    .from('caixa_saidas')
    .select('*, caixa_categorias(nome)')
    .gte('data', desdeDate)
    .lte('data', ateDate)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    categoria_id: row.categoria_id,
    data: row.data,
    valor: Number(row.valor),
    descricao: row.descricao,
    created_at: row.created_at,
    updated_at: row.updated_at,
    categoria_nome: row.caixa_categorias?.nome ?? '-',
  }));
}

export async function saveCaixaSaida(payload: {
  id?: string;
  categoria_id: string;
  data: string;
  valor: number;
  descricao?: string | null;
}): Promise<void> {
  const valor = Math.max(0.01, Number(payload.valor));
  const data = payload.data.slice(0, 10);
  if (!payload.categoria_id || !data) throw new Error('Categoria e data são obrigatórias.');
  const now = new Date().toISOString();
  const row = {
    categoria_id: payload.categoria_id,
    data,
    valor,
    descricao: payload.descricao?.trim() || null,
    updated_at: now,
  };
  if (payload.id) {
    const { error } = await (supabase as any).from('caixa_saidas').update(row).eq('id', payload.id);
    if (error) throw error;
  } else {
    const { error } = await (supabase as any).from('caixa_saidas').insert(row);
    if (error) throw error;
  }
}

export async function deleteCaixaSaida(id: string): Promise<void> {
  const { error } = await supabase.from('caixa_saidas').delete().eq('id', id);
  if (error) throw error;
}

export async function getRelatorioFluxoCaixa(desdeIso: string, ateIso: string): Promise<RelatorioFluxoCaixa> {
  const [{ total: entradasVendas, pedidosCount }, saidas] = await Promise.all([
    calcularEntradasVendas(desdeIso, ateIso),
    getCaixaSaidas(desdeIso, ateIso),
  ]);

  const agg = new Map<string, FluxoPorCategoria>();
  let saidasTotal = 0;
  for (const s of saidas) {
    saidasTotal += s.valor;
    const cur = agg.get(s.categoria_id) ?? {
      categoria_id: s.categoria_id,
      categoria_nome: s.categoria_nome,
      total: 0,
    };
    cur.total += s.valor;
    agg.set(s.categoria_id, cur);
  }

  const porCategoria = [...agg.values()].sort((a, b) => b.total - a.total);
  const saldo = entradasVendas - saidasTotal;

  return {
    resumo: {
      entradasVendas,
      pedidosCount,
      saidasTotal,
      saldo,
    },
    porCategoria,
    saidas,
  };
}
