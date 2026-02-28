import { supabase } from './supabase';
import type { Database } from '../types/database';

type ConfigKey = 'taxa_entrega' | 'quantidade_mesas';

export async function getConfig(key: ConfigKey): Promise<number> {
  const { data } = await supabase.from('config').select('value').eq('key', key).single();
  const row = data as { value?: unknown } | null;
  const v = row?.value;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function setConfig(key: ConfigKey, value: number) {
  await (supabase as any).from('config').upsert({ key, value, updated_at: new Date().toISOString() });
}

export async function getMesas() {
  const { data, error } = await supabase.from('mesas').select('*').order('numero');
  if (error) throw error;
  return data as Database['public']['Tables']['mesas']['Row'][];
}

export async function initMesas(quantidade: number) {
  const mesasExistentes = await getMesas();
  if (mesasExistentes.length > 0) {
    const viagem = mesasExistentes.find((m) => m.is_viagem);
    const nums = Array.from({ length: quantidade }, (_, i) => i + 1);
    const toInsert = nums.filter((n) => !mesasExistentes.some((m) => m.numero === n)).map((numero) => ({ numero, nome: `Mesa ${numero}`, is_viagem: false }));
    if (!viagem) toInsert.push({ numero: 0, nome: 'VIAGEM', is_viagem: true });
    if (toInsert.length) await (supabase as any).from('mesas').insert(toInsert);
  } else {
    const rows = Array.from({ length: quantidade }, (_, i) => ({ numero: i + 1, nome: `Mesa ${i + 1}`, is_viagem: false }));
    rows.push({ numero: 0, nome: 'VIAGEM', is_viagem: true });
    await (supabase as any).from('mesas').insert(rows);
  }
  await setConfig('quantidade_mesas', quantidade);
  return getMesas();
}

export async function getComandaByMesa(mesaId: string) {
  const { data } = await supabase.from('comandas').select('*').eq('mesa_id', mesaId).eq('aberta', true).maybeSingle();
  return data as Database['public']['Tables']['comandas']['Row'] | null;
}

/** Mesa IDs que têm comanda aberta (uma única requisição em vez de N) */
export async function getMesaIdsComComandaAberta(): Promise<Set<string>> {
  const { data } = await supabase.from('comandas').select('mesa_id').eq('aberta', true);
  const rows = (data ?? []) as { mesa_id: string }[];
  return new Set(rows.map((r) => r.mesa_id));
}

/** Mesa IDs que têm comanda aberta com pelo menos um pedido não finalizado/cancelado */
export async function getMesasIdsComPedidosAbertos(): Promise<Set<string>> {
  const { data: comandasData } = await supabase.from('comandas').select('id, mesa_id').eq('aberta', true);
  const comandas = (comandasData ?? []) as { id: string; mesa_id: string }[];
  if (!comandas.length) return new Set();
  const ids = comandas.map((c) => c.id);
  const { data: pedidosData } = await supabase.from('pedidos').select('comanda_id').in('comanda_id', ids).in('status', ['novo_pedido', 'em_preparacao', 'aguardando_aceite']);
  const pedidos = (pedidosData ?? []) as { comanda_id: string }[];
  const comandasComPedido = new Set(pedidos.map((p) => p.comanda_id));
  const mesaIds = new Set<string>();
  comandas.forEach((c) => { if (comandasComPedido.has(c.id)) mesaIds.add(c.mesa_id); });
  return mesaIds;
}

/** Se há pedidos de viagem em aberto (não finalizados/cancelados) */
export async function getViagemTemPedidosAbertos(): Promise<boolean> {
  const { data } = await supabase.from('pedidos').select('id').eq('origem', 'viagem').in('status', ['novo_pedido', 'em_preparacao', 'aguardando_aceite']).limit(1);
  return (data?.length ?? 0) > 0;
}

/** Mesa IDs (presencial) que têm comanda aberta com pelo menos um pedido finalizado = conta pendente de encerramento */
export async function getMesasIdsComContaPendente(): Promise<Set<string>> {
  const { data: comandasData } = await supabase.from('comandas').select('id, mesa_id').eq('aberta', true);
  const comandas = (comandasData ?? []) as { id: string; mesa_id: string }[];
  if (!comandas.length) return new Set();
  const ids = comandas.map((c) => c.id);
  const { data: pedidosData } = await supabase.from('pedidos').select('comanda_id').in('comanda_id', ids).eq('status', 'finalizado');
  const pedidos = (pedidosData ?? []) as { comanda_id: string }[];
  const comandasComFinalizado = new Set(pedidos.map((p) => p.comanda_id));
  const mesaIds = new Set<string>();
  comandas.forEach((c) => { if (comandasComFinalizado.has(c.id)) mesaIds.add(c.mesa_id); });
  return mesaIds;
}

/** Contagens para badges da sidebar admin: mesas (conta pendente), viagem (pedidos prontos p/ encerrar), online (aguardando aceite + em andamento + finalizados p/ encerrar), cozinha (novo + em preparação). */
export async function getAdminSidebarCounts(): Promise<{ mesas: number; viagem: number; online: number; cozinha: number }> {
  const [mesasSet, viagemList, onlineList, cozinhaList] = await Promise.all([
    getMesasIdsComContaPendente(),
    getPedidosViagemAbertos(),
    getPedidosOnlineTodos(),
    getPedidosCozinha(),
  ]);
  const comandaAberta = (p: any) => (Array.isArray(p.comandas) ? p.comandas[0]?.aberta : p.comandas?.aberta) !== false;
  const viagem = (viagemList as any[]).filter((p) => p.status === 'finalizado' && comandaAberta(p)).length;
  const online = (onlineList as any[]).filter(
    (p) => p.status === 'aguardando_aceite' || p.status === 'novo_pedido' || p.status === 'em_preparacao' || (p.status === 'finalizado' && !p.encerrado_em)
  ).length;
  const cozinha = (cozinhaList as any[]).filter((p) => p.status === 'novo_pedido' || p.status === 'em_preparacao').length;
  return { mesas: mesasSet.size, viagem, online, cozinha };
}

export async function openComanda(mesaId: string, atendenteId: string, nomeCliente: string) {
  const { data, error } = await (supabase as any).from('comandas').insert({ mesa_id: mesaId, atendente_id: atendenteId, nome_cliente: nomeCliente }).select().single();
  if (error) throw error;
  return data as Database['public']['Tables']['comandas']['Row'];
}

export async function closeComanda(comandaId: string, formaPagamento: string) {
  const now = new Date().toISOString();
  await (supabase as any).from('comandas').update({ aberta: false, forma_pagamento: formaPagamento, encerrada_em: now, updated_at: now }).eq('id', comandaId);
  await (supabase as any).from('pedidos').update({ encerrado_em: now, forma_pagamento: formaPagamento, updated_at: now }).eq('comanda_id', comandaId).neq('status', 'cancelado');
}

export async function getComandaWithPedidos(comandaId: string) {
  const { data: comanda } = await supabase.from('comandas').select('*').eq('id', comandaId).maybeSingle();
  if (!comanda) return null;
  const { data: pedidos } = await supabase.from('pedidos').select('*, pedido_itens(*, produtos(*))').eq('comanda_id', comandaId).order('created_at', { ascending: false });
  return { comanda, pedidos: pedidos ?? [] };
}

export async function getCategorias() {
  const { data, error } = await supabase.from('categorias').select('*').order('ordem');
  if (error) throw error;
  return (data ?? []) as Database['public']['Tables']['categorias']['Row'][];
}

export async function getProdutos(ativoOnly = false) {
  let q = supabase.from('produtos').select('*, categorias(nome)').order('codigo');
  if (ativoOnly) q = q.eq('ativo', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as (Database['public']['Tables']['produtos']['Row'] & { categorias: { nome: string } | null })[];
}

export async function nextPedidoNumero(): Promise<number> {
  const { data, error } = await supabase.rpc('next_pedido_numero');
  if (error) throw error;
  return data as number;
}

export async function createPedidoPresencial(comandaId: string, itens: { produto_id: string; quantidade: number; valor_unitario: number; observacao?: string }[]) {
  const numero = await nextPedidoNumero();
  const { data: pedido, error: e1 } = await (supabase as any).from('pedidos').insert({ numero, comanda_id: comandaId, origem: 'presencial', status: 'novo_pedido' }).select().single();
  if (e1) throw e1;
  const ped = pedido as { id: string };
  await (supabase as any).from('pedido_itens').insert(itens.map((i) => ({ pedido_id: ped.id, produto_id: i.produto_id, quantidade: i.quantidade, valor_unitario: i.valor_unitario, observacao: i.observacao ?? null })));
  return pedido;
}

export async function createPedidoViagem(nomeCliente: string, atendenteId: string, itens: { produto_id: string; quantidade: number; valor_unitario: number; observacao?: string }[]) {
  const numero = await nextPedidoNumero();
  const { data: mesaViagem } = await supabase.from('mesas').select('id').eq('is_viagem', true).single();
  if (!mesaViagem) throw new Error('Mesa VIAGEM não encontrada');
  const mesa = mesaViagem as { id: string };
  const { data: comanda, error: ec } = await (supabase as any).from('comandas').insert({ mesa_id: mesa.id, atendente_id: atendenteId, nome_cliente: nomeCliente, aberta: true }).select().single();
  if (ec) throw ec;
  const com = comanda as { id: string };
  const ids = [...new Set(itens.map((i) => i.produto_id))];
  const { data: produtos } = await supabase.from('produtos').select('id, vai_para_cozinha').in('id', ids);
  const byId: Record<string, { vai_para_cozinha: boolean }> = {};
  (produtos ?? []).forEach((p: any) => { byId[p.id] = p; });
  const temItemParaCozinha = itens.some((i) => Boolean(byId[i.produto_id]?.vai_para_cozinha));
  const status = temItemParaCozinha ? 'novo_pedido' : 'finalizado';
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = { numero, comanda_id: com.id, origem: 'viagem', status, cliente_nome: nomeCliente };
  if (status === 'finalizado') payload.encerrado_em = now;
  const { data: pedido, error: e1 } = await (supabase as any).from('pedidos').insert(payload).select().single();
  if (e1) throw e1;
  const ped = pedido as { id: string };
  await (supabase as any).from('pedido_itens').insert(itens.map((i) => ({ pedido_id: ped.id, produto_id: i.produto_id, quantidade: i.quantidade, valor_unitario: i.valor_unitario, observacao: i.observacao ?? null })));
  return { pedido, comanda };
}

export async function updatePedidoStatus(
  pedidoId: string,
  status: 'novo_pedido' | 'em_preparacao' | 'finalizado' | 'cancelado',
  opts?: { motivo_cancelamento?: string; cancelado_por?: string }
) {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = { status, updated_at: now };
  if (status === 'finalizado') {
    const { data: pedData } = await supabase.from('pedidos').select('origem').eq('id', pedidoId).single();
    const ped = pedData as { origem: string } | null;
    if (ped?.origem !== 'online') payload.encerrado_em = now;
  }
  if (status === 'cancelado' && opts) {
    if (opts.motivo_cancelamento) payload.motivo_cancelamento = opts.motivo_cancelamento;
    if (opts.cancelado_por) payload.cancelado_por = opts.cancelado_por;
    payload.cancelado_em = now;
  }
  await (supabase as any).from('pedidos').update(payload).eq('id', pedidoId);
}

export async function getPedidosByComanda(comandaId: string) {
  const { data } = await supabase.from('pedidos').select('*, pedido_itens(*, produtos(*))').eq('comanda_id', comandaId).order('created_at', { ascending: false });
  return (data ?? []) as any[];
}

export async function getPedidosCozinha() {
  const { data } = await supabase
    .from('pedidos')
    .select('id, numero, status, origem, cliente_nome, encerrado_em, updated_at, aceito_em, created_at, comanda_id, pedido_itens(id, quantidade, observacao, produtos(id, nome, descricao, vai_para_cozinha)), comandas(nome_cliente, mesa_id, mesas(numero, nome))')
    .in('status', ['novo_pedido', 'em_preparacao', 'finalizado'])
    .order('created_at');
  const list = (data ?? []) as any[];
  return list.filter((p) => {
    const itens = p.pedido_itens ?? [];
    const temItemParaCozinha = itens.some((i: any) => Boolean(i.produtos?.vai_para_cozinha));
    return temItemParaCozinha;
  });
}

export async function getPedidosViagemAbertos() {
  const { data } = await supabase.from('pedidos').select('*, pedido_itens(*, produtos(*)), comandas(nome_cliente, aberta)').eq('origem', 'viagem').neq('status', 'cancelado').order('created_at', { ascending: false });
  return (data ?? []) as any[];
}

/** Retorna início e fim do dia de hoje em Brasília (America/Sao_Paulo) em ISO UTC. */
function hojeBrasiliaUTC(): { desde: string; ate: string } {
  const brDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const [y, m, d] = brDateStr.split('-').map(Number);
  const desde = new Date(Date.UTC(y, m - 1, d, 3, 0, 0, 0)).toISOString();
  const ate = new Date(Date.UTC(y, m - 1, d + 1, 2, 59, 59, 999)).toISOString();
  return { desde, ate };
}

export async function getPedidosPresencialEncerradosHoje() {
  const { desde, ate } = hojeBrasiliaUTC();
  const { data } = await supabase
    .from('pedidos')
    .select('*, pedido_itens(*, produtos(*)), comandas(nome_cliente, mesa_id, mesas(numero, nome))')
    .eq('origem', 'presencial')
    .eq('status', 'finalizado')
    .not('encerrado_em', 'is', null)
    .gte('encerrado_em', desde)
    .lte('encerrado_em', ate)
    .order('encerrado_em', { ascending: false });
  return (data ?? []) as any[];
}

export async function getPedidosOnlinePendentes() {
  const { data } = await supabase.from('pedidos').select('*, pedido_itens(*, produtos(*))').eq('origem', 'online').eq('status', 'aguardando_aceite').order('created_at');
  return (data ?? []) as any[];
}

export async function getPedidosOnlineTodos() {
  const { data } = await supabase.from('pedidos').select('*, pedido_itens(*, produtos(*))').eq('origem', 'online').neq('status', 'cancelado').order('created_at', { ascending: false });
  return (data ?? []) as any[];
}

export async function getPedidosOnlineEncerradosHoje() {
  const { desde, ate } = hojeBrasiliaUTC();
  const { data } = await supabase.from('pedidos').select('*, pedido_itens(*, produtos(*))').eq('origem', 'online').eq('status', 'finalizado').not('encerrado_em', 'is', null).gte('encerrado_em', desde).lte('encerrado_em', ate).order('encerrado_em', { ascending: false });
  return (data ?? []) as any[];
}

export async function acceptPedidoOnline(pedidoId: string) {
  const now = new Date().toISOString();
  const { data: itens } = await supabase.from('pedido_itens').select('produto_id').eq('pedido_id', pedidoId);
  const ids = [...new Set((itens ?? []).map((i: any) => i.produto_id))];
  let temItemParaCozinha = false;
  if (ids.length > 0) {
    const { data: produtos } = await supabase.from('produtos').select('id, vai_para_cozinha').in('id', ids);
    const byId: Record<string, { vai_para_cozinha: boolean }> = {};
    (produtos ?? []).forEach((p: any) => { byId[p.id] = p; });
    temItemParaCozinha = (itens as any[]).some((i) => Boolean(byId[i.produto_id]?.vai_para_cozinha));
  }
  const status = temItemParaCozinha ? 'novo_pedido' : 'finalizado';
  await (supabase as any).from('pedidos').update({ status, aceito_em: now, updated_at: now }).eq('id', pedidoId);
}

export async function setImprimidoEntregaPedido(pedidoId: string) {
  await (supabase as any).from('pedidos').update({ imprimido_entrega_em: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', pedidoId);
}

export async function encerrarPedidoOnline(pedidoId: string) {
  const now = new Date().toISOString();
  await (supabase as any).from('pedidos').update({ encerrado_em: now, updated_at: now }).eq('id', pedidoId);
}

export async function createPedidoOnline(payload: {
  cliente_nome: string;
  cliente_whatsapp: string;
  cliente_endereco: string;
  ponto_referencia?: string;
  forma_pagamento: string;
  tipo_entrega?: 'entrega' | 'retirada';
  troco_para?: number;
  observacoes?: string;
  cupom_codigo?: string;
  itens: { produto_id: string; quantidade: number; valor_unitario: number; observacao?: string }[];
}) {
  const tipoEntrega = payload.tipo_entrega ?? 'entrega';
  const taxa = tipoEntrega === 'retirada' ? 0 : await getConfig('taxa_entrega');
  const numero = await nextPedidoNumero();
  let desconto = 0;
  if (payload.cupom_codigo) {
    const codigoTrim = payload.cupom_codigo.trim();
    const { data: cupomData } = await supabase.from('cupons').select('*').ilike('codigo', codigoTrim).eq('ativo', true).maybeSingle();
    const cupom = cupomData as { valido_ate: string; usos_restantes: number; porcentagem: number } | null;
    if (cupom && new Date(cupom.valido_ate) >= new Date() && Number(cupom.usos_restantes) > 0) {
      const subTotal = payload.itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
      desconto = (subTotal * Number(cupom.porcentagem)) / 100;
    }
  }
  const { data: pedido, error: e1 } = await (supabase as any).from('pedidos').insert({
    numero,
    comanda_id: null,
    origem: 'online',
    status: 'aguardando_aceite',
    cliente_nome: payload.cliente_nome,
    cliente_whatsapp: payload.cliente_whatsapp,
    cliente_endereco: payload.cliente_endereco,
    ponto_referencia: payload.ponto_referencia ?? null,
    forma_pagamento: payload.forma_pagamento,
    tipo_entrega: tipoEntrega,
    troco_para: payload.troco_para ?? null,
    observacoes: payload.observacoes ?? null,
    desconto,
    taxa_entrega: taxa,
  }).select().single();
  if (e1) throw e1;
  const ped = pedido as { id: string };
  await (supabase as any).from('pedido_itens').insert(payload.itens.map((i) => ({ pedido_id: ped.id, produto_id: i.produto_id, quantidade: i.quantidade, valor_unitario: i.valor_unitario, observacao: i.observacao ?? null })));
  return pedido;
}

export async function getCuponsAtivos() {
  const { data } = await supabase.from('cupons').select('*').eq('ativo', true).gt('usos_restantes', 0).order('codigo');
  return (data ?? []) as Database['public']['Tables']['cupons']['Row'][];
}

/** Repõe os usos restantes do cupom para o valor total (quantidade_usos). */
export async function reporUsosCupom(cupomId: string) {
  const { data: cupomData } = await supabase.from('cupons').select('quantidade_usos').eq('id', cupomId).single();
  const cupom = cupomData as { quantidade_usos: number } | null;
  if (!cupom) return;
  await (supabase as any).from('cupons').update({ usos_restantes: Number(cupom.quantidade_usos) }).eq('id', cupomId);
}

/** Valida cupom por código no banco. Retorna o cupom se válido ou mensagem de erro. */
export async function validarCupom(codigo: string): Promise<{ cupom: Database['public']['Tables']['cupons']['Row'] } | { error: string }> {
  const codigoTrim = codigo?.trim();
  if (!codigoTrim) return { error: 'Informe o código do cupom.' };
  const { data: cupomData, error: err } = await supabase.from('cupons').select('*').ilike('codigo', codigoTrim).maybeSingle();
  if (err) return { error: 'Erro ao consultar cupom.' };
  const cupom = cupomData as Database['public']['Tables']['cupons']['Row'] | null;
  if (!cupom) return { error: 'Cupom não encontrado.' };
  if (!cupom.ativo) return { error: 'Cupom inativo.' };
  if (new Date(cupom.valido_ate) < new Date()) return { error: 'Cupom expirado.' };
  if (Number(cupom.usos_restantes) <= 0) return { error: 'Cupom sem usos disponíveis.' };
  return { cupom };
}

export async function getTotalComanda(comandaId: string): Promise<{ itens: { descricao: string; codigo: string; quantidade: number; valor: number }[]; total: number }> {
  const { data: pedidosData } = await supabase.from('pedidos').select('id').eq('comanda_id', comandaId).neq('status', 'cancelado');
  const pedidos = (pedidosData ?? []) as { id: string }[];
  if (!pedidos.length) return { itens: [], total: 0 };
  const { data: itensData } = await supabase.from('pedido_itens').select('*, produtos(codigo, descricao, nome)').in('pedido_id', pedidos.map((p) => p.id));
  const itens = (itensData ?? []) as any[];
  const list: { descricao: string; codigo: string; quantidade: number; valor: number }[] = [];
  let total = 0;
  for (const i of itens) {
    const prod = i.produtos;
    const linha = { descricao: (prod?.nome ?? prod?.descricao) ?? '', codigo: prod?.codigo ?? '', quantidade: i.quantidade, valor: i.quantidade * i.valor_unitario };
    list.push(linha);
    total += linha.valor;
  }
  return { itens: list, total };
}

export async function getRelatorioFinanceiro(desde: string, ate: string) {
  const { data } = await supabase
    .from('pedidos')
    .select('id, numero, origem, encerrado_em, created_at, cliente_nome, desconto, taxa_entrega, forma_pagamento, comanda_id, comandas(nome_cliente, mesa_id, mesas(numero, nome))')
    .eq('status', 'finalizado')
    .gte('encerrado_em', desde)
    .lte('encerrado_em', ate)
    .order('encerrado_em');
  const pedidos = (data ?? []) as any[];
  if (!pedidos.length) return { pedidos: [], totalGeral: 0 };
  const ids = pedidos.map((p: any) => p.id);
  const { data: itensData } = await supabase.from('pedido_itens').select('pedido_id, quantidade, valor_unitario').in('pedido_id', ids);
  const itens = (itensData ?? []) as any[];
  const totalPorPedido: Record<string, number> = {};
  for (const i of itens) {
    totalPorPedido[i.pedido_id] = (totalPorPedido[i.pedido_id] ?? 0) + i.quantidade * i.valor_unitario;
  }
  const linhas = pedidos.map((p: any) => {
    const subtotal = totalPorPedido[p.id] ?? 0;
    const desconto = Number(p.desconto ?? 0);
    const taxa = Number(p.taxa_entrega ?? 0);
    const total = subtotal - desconto + taxa;
    const comanda = p.comandas;
    const clienteNome = p.origem === 'presencial' && comanda
      ? (Array.isArray(comanda) ? comanda[0]?.nome_cliente : comanda.nome_cliente)
      : p.cliente_nome;
    return {
      ...p,
      cliente_nome: clienteNome ?? '-',
      total,
      desconto,
      subtotal,
      taxa,
    };
  });

  const comComanda = linhas.filter((p) => p.comanda_id);
  const online = linhas.filter((p) => !p.comanda_id);

  const porComanda = new Map<string, typeof linhas>();
  for (const p of comComanda) {
    const cid = p.comanda_id!;
    if (!porComanda.has(cid)) porComanda.set(cid, []);
    porComanda.get(cid)!.push(p);
  }

  function mesaFromComanda(comanda: any): string {
    if (!comanda) return '-';
    const c = Array.isArray(comanda) ? comanda[0] : comanda;
    const mesas = c?.mesas;
    const m = Array.isArray(mesas) ? mesas[0] : mesas;
    if (!m) return '-';
    return m.nome ?? `Mesa ${m.numero ?? '-'}`;
  }

  const aggregated: any[] = [];
  for (const [comandaId, grupo] of porComanda) {
    const numeros = grupo.map((p) => p.numero).sort((a, b) => a - b);
    const descontoTotal = grupo.reduce((s, p) => s + p.desconto, 0);
    const subtotalMesa = grupo.reduce((s, p) => s + p.subtotal, 0);
    const totalMesa = grupo.reduce((s, p) => s + p.total, 0);
    const primeiro = grupo[0];
    const comanda = (primeiro as any).comandas;
    aggregated.push({
      id: 'comanda-' + comandaId,
      numero: numeros.join(', '),
      origem: 'presencial',
      encerrado_em: primeiro.encerrado_em,
      created_at: primeiro.created_at,
      cliente_nome: primeiro.cliente_nome ?? '-',
      forma_pagamento: primeiro.forma_pagamento ?? '-',
      mesa: mesaFromComanda(comanda),
      subtotal: subtotalMesa,
      taxa: 0,
      desconto: descontoTotal,
      total: totalMesa,
    });
  }

  for (const p of online) {
    (p as any).mesa = '-';
  }

  const resultado = [...aggregated, ...online].sort(
    (a, b) => new Date(a.encerrado_em || 0).getTime() - new Date(b.encerrado_em || 0).getTime()
  );
  const totalGeral = resultado.reduce((s, p) => s + p.total, 0);
  return { pedidos: resultado, totalGeral };
}

/** Aplica desconto nos pedidos da comanda (cupom and/or manual). cupomId pode ser null para só desconto manual. */
export async function applyDescontoComanda(comandaId: string, cupomId: string | null, valorDescontoTotal: number) {
  const { data } = await supabase.from('pedidos').select('id').eq('comanda_id', comandaId).neq('status', 'cancelado');
  const pedidos = (data ?? []) as { id: string }[];
  if (!pedidos.length) return;
  const valorPorPedido = valorDescontoTotal / pedidos.length;
  for (const p of pedidos) {
    await (supabase as any).from('pedidos').update({
      desconto: valorPorPedido,
      cupom_id: cupomId,
      updated_at: new Date().toISOString(),
    }).eq('id', p.id);
  }
}

/** Remove o desconto dos pedidos da comanda. Chamado ao imprimir conta sem cupom. */
export async function clearDescontoComanda(comandaId: string) {
  const { data } = await supabase.from('pedidos').select('id').eq('comanda_id', comandaId).neq('status', 'cancelado');
  const pedidos = (data ?? []) as { id: string }[];
  for (const p of pedidos) {
    await (supabase as any).from('pedidos').update({
      desconto: 0,
      cupom_id: null,
      updated_at: new Date().toISOString(),
    }).eq('id', p.id);
  }
}

export async function getRelatorioCancelamentos(desde: string, ate: string) {
  const { data } = await supabase
    .from('pedidos')
    .select('id, numero, origem, motivo_cancelamento, cancelado_por, cancelado_em, created_at, cliente_nome')
    .eq('status', 'cancelado')
    .gte('cancelado_em', desde)
    .lte('cancelado_em', ate)
    .order('cancelado_em', { ascending: false });
  const pedidos = (data ?? []) as any[];
  if (pedidos.length === 0) return { itens: [], total: 0 };
  const ids = [...new Set(pedidos.map((p) => p.cancelado_por).filter(Boolean))] as string[];
  const { data: profiles } = ids.length ? await supabase.from('profiles').select('id, nome').in('id', ids) : { data: [] };
  const nomes: Record<string, string> = {};
  (profiles ?? []).forEach((r: any) => { nomes[r.id] = r.nome; });
  const itens = pedidos.map((p) => ({ ...p, cancelado_por_nome: p.cancelado_por ? nomes[p.cancelado_por] ?? p.cancelado_por : '-' }));
  return { itens, total: itens.length };
}
