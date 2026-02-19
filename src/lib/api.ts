import { supabase } from './supabase';
import type { Database } from '../types/database';

type ConfigKey = 'taxa_entrega' | 'quantidade_mesas';

export async function getConfig(key: ConfigKey): Promise<number> {
  const { data } = await supabase.from('config').select('value').eq('key', key).single();
  const v = data?.value;
  return typeof v === 'number' ? v : Number(v) ?? 0;
}

export async function setConfig(key: ConfigKey, value: number) {
  await supabase.from('config').upsert({ key, value, updated_at: new Date().toISOString() });
}

export async function getMesas() {
  const { data, error } = await supabase.from('mesas').select('*').order('numero');
  if (error) throw error;
  return data as Database['public']['Tables']['mesas']['Row'][];
}

export async function initMesas(quantidade: number) {
  const mesasExistentes = await getMesas();
  if (mesasExistentes.length > 0) {
    const maxNum = Math.max(...mesasExistentes.map((m) => m.numero), 0);
    const viagem = mesasExistentes.find((m) => m.is_viagem);
    const nums = Array.from({ length: quantidade }, (_, i) => i + 1);
    const toInsert = nums.filter((n) => !mesasExistentes.some((m) => m.numero === n)).map((numero) => ({ numero, nome: `Mesa ${numero}`, is_viagem: false }));
    if (!viagem) toInsert.push({ numero: 0, nome: 'VIAGEM', is_viagem: true });
    if (toInsert.length) await supabase.from('mesas').insert(toInsert);
  } else {
    const rows = Array.from({ length: quantidade }, (_, i) => ({ numero: i + 1, nome: `Mesa ${i + 1}`, is_viagem: false }));
    rows.push({ numero: 0, nome: 'VIAGEM', is_viagem: true });
    await supabase.from('mesas').insert(rows);
  }
  await setConfig('quantidade_mesas', quantidade);
  return getMesas();
}

export async function getComandaByMesa(mesaId: string) {
  const { data } = await supabase.from('comandas').select('*').eq('mesa_id', mesaId).eq('aberta', true).single();
  return data as Database['public']['Tables']['comandas']['Row'] | null;
}

export async function openComanda(mesaId: string, atendenteId: string, nomeCliente: string) {
  const { data, error } = await supabase.from('comandas').insert({ mesa_id: mesaId, atendente_id: atendenteId, nome_cliente: nomeCliente }).select().single();
  if (error) throw error;
  return data as Database['public']['Tables']['comandas']['Row'];
}

export async function closeComanda(comandaId: string, formaPagamento: string) {
  await supabase.from('comandas').update({ aberta: false, forma_pagamento: formaPagamento, encerrada_em: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', comandaId);
}

export async function getComandaWithPedidos(comandaId: string) {
  const { data: comanda } = await supabase.from('comandas').select('*').eq('id', comandaId).single();
  if (!comanda) return null;
  const { data: pedidos } = await supabase.from('pedidos').select('*, pedido_itens(*, produtos(*))').eq('comanda_id', comandaId).order('created_at', { ascending: false });
  return { comanda, pedidos: pedidos ?? [] };
}

export async function getProdutos(ativoOnly = false) {
  let q = supabase.from('produtos').select('*').order('codigo');
  if (ativoOnly) q = q.eq('ativo', true);
  const { data, error } = await q;
  if (error) throw error;
  return data as Database['public']['Tables']['produtos']['Row'][];
}

export async function nextPedidoNumero(): Promise<number> {
  const { data, error } = await supabase.rpc('next_pedido_numero');
  if (error) throw error;
  return data as number;
}

export async function createPedidoPresencial(comandaId: string, itens: { produto_id: string; quantidade: number; valor_unitario: number; observacao?: string }[]) {
  const numero = await nextPedidoNumero();
  const { data: pedido, error: e1 } = await supabase.from('pedidos').insert({ numero, comanda_id: comandaId, origem: 'presencial', status: 'novo_pedido' }).select().single();
  if (e1) throw e1;
  await supabase.from('pedido_itens').insert(itens.map((i) => ({ pedido_id: pedido.id, produto_id: i.produto_id, quantidade: i.quantidade, valor_unitario: i.valor_unitario, observacao: i.observacao ?? null })));
  return pedido;
}

export async function createPedidoViagem(nomeCliente: string, atendenteId: string, itens: { produto_id: string; quantidade: number; valor_unitario: number; observacao?: string }[]) {
  const numero = await nextPedidoNumero();
  const mesaViagem = (await supabase.from('mesas').select('id').eq('is_viagem', true).single()).data;
  if (!mesaViagem) throw new Error('Mesa VIAGEM não encontrada');
  const { data: comanda, error: ec } = await supabase.from('comandas').insert({ mesa_id: mesaViagem.id, atendente_id: atendenteId, nome_cliente: nomeCliente, aberta: true }).select().single();
  if (ec) throw ec;
  const { data: pedido, error: e1 } = await supabase.from('pedidos').insert({ numero, comanda_id: comanda.id, origem: 'viagem', status: 'novo_pedido', cliente_nome: nomeCliente }).select().single();
  if (e1) throw e1;
  await supabase.from('pedido_itens').insert(itens.map((i) => ({ pedido_id: pedido.id, produto_id: i.produto_id, quantidade: i.quantidade, valor_unitario: i.valor_unitario, observacao: i.observacao ?? null })));
  return { pedido, comanda };
}

export async function updatePedidoStatus(pedidoId: string, status: 'novo_pedido' | 'em_preparacao' | 'finalizado' | 'cancelado') {
  await supabase.from('pedidos').update({ status, updated_at: new Date().toISOString() }).eq('id', pedidoId);
}

export async function getPedidosByComanda(comandaId: string) {
  const { data } = await supabase.from('pedidos').select('*, pedido_itens(*, produtos(*))').eq('comanda_id', comandaId).order('created_at', { ascending: false });
  return (data ?? []) as any[];
}

export async function getPedidosCozinha() {
  const { data } = await supabase.from('pedidos').select('*, pedido_itens(*, produtos(*)), comandas(nome_cliente)').in('status', ['novo_pedido', 'em_preparacao', 'finalizado']).order('created_at');
  return (data ?? []) as any[];
}

export async function getPedidosViagemAbertos() {
  const { data: mesaViagem } = await supabase.from('mesas').select('id').eq('is_viagem', true).single();
  if (!mesaViagem) return [];
  const { data } = await supabase.from('pedidos').select('*, pedido_itens(*, produtos(*))').eq('origem', 'viagem').neq('status', 'cancelado').order('created_at', { ascending: false });
  return (data ?? []) as any[];
}

export async function getPedidosOnlinePendentes() {
  const { data } = await supabase.from('pedidos').select('*, pedido_itens(*, produtos(*))').eq('origem', 'online').eq('status', 'aguardando_aceite').order('created_at');
  return (data ?? []) as any[];
}

export async function acceptPedidoOnline(pedidoId: string) {
  await supabase.from('pedidos').update({ status: 'novo_pedido', updated_at: new Date().toISOString() }).eq('id', pedidoId);
}

export async function createPedidoOnline(payload: {
  cliente_nome: string;
  cliente_whatsapp: string;
  cliente_endereco: string;
  forma_pagamento: string;
  troco_para?: number;
  observacoes?: string;
  cupom_codigo?: string;
  itens: { produto_id: string; quantidade: number; valor_unitario: number; observacao?: string }[];
}) {
  const taxa = await getConfig('taxa_entrega');
  const numero = await nextPedidoNumero();
  let desconto = 0;
  if (payload.cupom_codigo) {
    const { data: cupom } = await supabase.from('cupons').select('*').eq('codigo', payload.cupom_codigo).eq('ativo', true).single();
    if (cupom && new Date(cupom.valido_ate) >= new Date() && cupom.usos_restantes > 0) {
      const subTotal = payload.itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
      desconto = (subTotal * Number(cupom.porcentagem)) / 100;
    }
  }
  const { data: pedido, error: e1 } = await supabase.from('pedidos').insert({
    numero,
    comanda_id: null,
    origem: 'online',
    status: 'aguardando_aceite',
    cliente_nome: payload.cliente_nome,
    cliente_whatsapp: payload.cliente_whatsapp,
    cliente_endereco: payload.cliente_endereco,
    forma_pagamento: payload.forma_pagamento,
    troco_para: payload.troco_para ?? null,
    observacoes: payload.observacoes ?? null,
    desconto,
    taxa_entrega: taxa,
  }).select().single();
  if (e1) throw e1;
  await supabase.from('pedido_itens').insert(payload.itens.map((i) => ({ pedido_id: pedido.id, produto_id: i.produto_id, quantidade: i.quantidade, valor_unitario: i.valor_unitario, observacao: i.observacao ?? null })));
  return pedido;
}

export async function getTotalComanda(comandaId: string): Promise<{ itens: { descricao: string; codigo: string; quantidade: number; valor: number }[]; total: number }> {
  const { data: pedidos } = await supabase.from('pedidos').select('id').eq('comanda_id', comandaId).neq('status', 'cancelado');
  if (!pedidos?.length) return { itens: [], total: 0 };
  const { data: itens } = await supabase.from('pedido_itens').select('*, produtos(codigo, descricao)').in('pedido_id', pedidos.map((p) => p.id));
  const list: { descricao: string; codigo: string; quantidade: number; valor: number }[] = [];
  let total = 0;
  for (const i of itens ?? []) {
    const prod = (i as any).produtos;
    const linha = { descricao: prod?.descricao ?? '', codigo: prod?.codigo ?? '', quantidade: i.quantidade, valor: i.quantidade * i.valor_unitario };
    list.push(linha);
    total += linha.valor;
  }
  return { itens: list, total };
}
