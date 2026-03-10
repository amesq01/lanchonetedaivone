import { supabase } from './supabase';
import type { Database } from '../types/database';
import type { ProdutoWithCategorias } from '../types/database';

type ConfigKey = 'taxa_entrega' | 'quantidade_mesas';

/** Exige que o usuário atual seja admin. Usado para transferência de pedidos entre mesas. */
async function exigirAdminTransferencia(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autorizado.');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if ((profile as { role: string } | null)?.role !== 'admin') {
    throw new Error('Apenas o admin pode transferir pedidos entre mesas.');
  }
}

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

/** Valor bruto de config (string ou number). */
export async function getConfigValue(key: string): Promise<string | number | null> {
  const { data } = await supabase.from('config').select('value').eq('key', key).maybeSingle();
  const v = (data as { value?: unknown } | null)?.value;
  if (v === undefined || v === null) return null;
  return typeof v === 'string' || typeof v === 'number' ? v : null;
}

export async function setConfigValue(key: string, value: string | number) {
  await (supabase as any).from('config').upsert({ key, value, updated_at: new Date().toISOString() });
}

/** Lanchonete aberta para pedidos online? (toggle admin). Default true se não configurado. */
export async function getLanchoneteAberta(): Promise<boolean> {
  const v = await getConfigValue('pedido_online_aberta');
  if (v === null || v === undefined) return true;
  return Number(v) === 1;
}

export async function setLanchoneteAberta(aberta: boolean) {
  await setConfigValue('pedido_online_aberta', aberta ? 1 : 0);
}

/** Pedidos online disponíveis apenas para retirada? (toggle admin). Default false. */
export async function getLojaOnlineSoRetirada(): Promise<boolean> {
  const v = await getConfigValue('loja_online_so_retirada');
  if (v === null || v === undefined) return false;
  return Number(v) === 1;
}

export async function setLojaOnlineSoRetirada(soRetirada: boolean) {
  await setConfigValue('loja_online_so_retirada', soRetirada ? 1 : 0);
}

/** Horário de abertura da loja online (ex.: "08:00"). null se não configurado. */
export async function getLojaOnlineHorarioAbertura(): Promise<string | null> {
  const v = await getConfigValue('loja_online_horario_abertura');
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

export async function setLojaOnlineHorarioAbertura(horario: string) {
  await setConfigValue('loja_online_horario_abertura', horario.trim() || '');
}

/** Retorna se o cliente pode fazer pedido online (lanchonete aberta). */
export async function canPlaceOrderOnline(): Promise<{ allowed: boolean; message?: string; horarioAbertura?: string | null }> {
  const [aberta, horarioAbertura] = await Promise.all([getLanchoneteAberta(), getLojaOnlineHorarioAbertura()]);
  if (aberta) return { allowed: true, horarioAbertura };
  const msg = horarioAbertura
    ? `A lanchonete está fechada para pedidos online. Abre às ${formatarHoraExibicao(horarioAbertura)}.`
    : 'A lanchonete está fechada para pedidos online no momento. Tente novamente mais tarde.';
  return { allowed: false, message: msg, horarioAbertura };
}

function formatarHoraExibicao(hhmm: string): string {
  const [h, m] = hhmm.split(':');
  const hour = parseInt(h ?? '0', 10);
  const min = parseInt(m ?? '0', 10);
  if (Number.isNaN(hour)) return hhmm;
  if (hour === 0 && min === 0) return 'meia-noite';
  if (hour === 12 && min === 0) return '12h';
  return `${hour.toString().padStart(2, '0')}:${(min || 0).toString().padStart(2, '0')}`;
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

/** Todas as comandas abertas de uma mesa (viagem pode ter várias). */
export async function getComandasAbertasByMesa(mesaId: string): Promise<Database['public']['Tables']['comandas']['Row'][]> {
  const { data } = await supabase.from('comandas').select('*').eq('mesa_id', mesaId).eq('aberta', true).order('created_at');
  return (data ?? []) as Database['public']['Tables']['comandas']['Row'][];
}

/** Comanda aberta da mesa + nome do atendente que abriu. Retorna null se não houver comanda aberta. */
export async function getComandaByMesaComAtendente(mesaId: string): Promise<{ comanda: Database['public']['Tables']['comandas']['Row']; atendente_nome: string } | null> {
  const comanda = await getComandaByMesa(mesaId);
  if (!comanda) return null;
  const { data: profile } = await supabase.from('profiles').select('nome').eq('id', comanda.atendente_id).maybeSingle();
  return { comanda, atendente_nome: (profile as { nome: string } | null)?.nome ?? '-' };
}

/** Mesas (presencial) com comanda aberta, atendente_id e nome. Exclui mesa viagem. */
export async function getMesasComComandaAberta(): Promise<{ mesa_id: string; atendente_id: string; atendente_nome: string }[]> {
  const [comandasData, mesasData] = await Promise.all([
    supabase.from('comandas').select('mesa_id, atendente_id').eq('aberta', true),
    getMesas(),
  ]);
  const comandas = (comandasData.data ?? []) as { mesa_id: string; atendente_id: string }[];
  const mesasPresencial = new Set((mesasData ?? []).filter((m: any) => !m.is_viagem).map((m: any) => m.id));
  const filtradas = comandas.filter((c) => mesasPresencial.has(c.mesa_id));
  if (!filtradas.length) return [];
  const ids = [...new Set(filtradas.map((c) => c.atendente_id))];
  const { data: profiles } = await supabase.from('profiles').select('id, nome').in('id', ids);
  const nomes: Record<string, string> = {};
  (profiles ?? []).forEach((r: any) => { nomes[r.id] = r.nome; });
  return filtradas.map((c) => ({ mesa_id: c.mesa_id, atendente_id: c.atendente_id, atendente_nome: nomes[c.atendente_id] ?? '-' }));
}

/** Mesa IDs que têm comanda aberta (uma única requisição em vez de N) */
export async function getMesaIdsComComandaAberta(): Promise<Set<string>> {
  const { data } = await supabase.from('comandas').select('mesa_id').eq('aberta', true);
  const rows = (data ?? []) as { mesa_id: string }[];
  return new Set(rows.map((r) => r.mesa_id));
}

/** Mesas SEM comanda aberta (livres) para transferência. Apenas admin. Exclui mesa Viagem e mesaIdExcluir se informado. No destino será aberta uma nova comanda. Ordenadas por número (menor para maior). */
export async function getMesasFechadasParaTransferencia(mesaIdExcluir?: string): Promise<{ mesaId: string; mesaNome: string }[]> {
  const todas = await getMesasParaTransferencia(mesaIdExcluir);
  return todas.filter((m) => !m.comandaId).map(({ mesaId, mesaNome }) => ({ mesaId, mesaNome }));
}

/** Mesas para transferência: abertas (com comanda) e livres. Apenas admin. Quando comandaId existe, os pedidos vão para a comanda existente; quando null, será aberta nova comanda. */
export async function getMesasParaTransferencia(mesaIdExcluir?: string): Promise<{ mesaId: string; mesaNome: string; comandaId: string | null }[]> {
  await exigirAdminTransferencia();
  const [comandasAbertasRes, mesasRes] = await Promise.all([
    supabase.from('comandas').select('id, mesa_id').eq('aberta', true),
    supabase.from('mesas').select('id, nome, is_viagem, numero'),
  ]);
  const comandaPorMesa = new Map<string, string>();
  (comandasAbertasRes.data ?? []).forEach((c: any) => comandaPorMesa.set(c.mesa_id, c.id));
  const mesas = (mesasRes.data ?? []) as { id: string; nome: string; is_viagem: boolean; numero: number }[];
  const out: { mesaId: string; mesaNome: string; comandaId: string | null; numero: number }[] = [];
  for (const m of mesas) {
    if (m.is_viagem) continue;
    if (mesaIdExcluir && m.id === mesaIdExcluir) continue;
    const comandaId = comandaPorMesa.get(m.id) ?? null;
    out.push({
      mesaId: m.id,
      mesaNome: m.nome ?? `Mesa ${m.numero}`,
      comandaId,
      numero: typeof m.numero === 'number' && !Number.isNaN(m.numero) ? m.numero : 0,
    });
  }
  out.sort((a, b) => a.numero - b.numero);
  return out.map(({ mesaId, mesaNome, comandaId }) => ({ mesaId, mesaNome, comandaId }));
}

/** Transfere pedidos para outra comanda. Apenas admin. A mesa de destino deve estar com comanda aberta. Se passar fecharComandasOrigemIds, comandas de origem que ficarem sem pedidos são encerradas (mesa fica livre para novo atendimento). */
export async function movePedidosParaOutraComanda(
  pedidoIds: string[],
  comandaIdDestino: string,
  opts?: { novoNomeCliente?: string; fecharComandasOrigemIds?: string[] }
) {
  await exigirAdminTransferencia();
  if (!pedidoIds.length) throw new Error('Nenhum pedido selecionado.');
  const { data: dest, error: errDest } = await supabase.from('comandas').select('id, aberta').eq('id', comandaIdDestino).maybeSingle();
  if (errDest) throw new Error('Erro ao verificar mesa de destino.');
  if (!dest) throw new Error('Mesa de destino não encontrada.');
  if (!(dest as { aberta: boolean }).aberta) throw new Error('A mesa de destino não está com comanda aberta. Só é possível transferir para uma mesa que esteja aberta.');
  const now = new Date().toISOString();
  await (supabase as any).from('pedidos').update({ comanda_id: comandaIdDestino, updated_at: now }).in('id', pedidoIds);
  if (opts?.novoNomeCliente != null && opts.novoNomeCliente.trim()) {
    await (supabase as any).from('comandas').update({ nome_cliente: opts.novoNomeCliente.trim(), updated_at: now }).eq('id', comandaIdDestino);
  }
  if (opts?.fecharComandasOrigemIds?.length) {
    for (const cid of opts.fecharComandasOrigemIds) {
      const { data: rest } = await supabase.from('pedidos').select('id').eq('comanda_id', cid).limit(1);
      if (!(rest ?? []).length) {
        await (supabase as any).from('comandas').update({ aberta: false, forma_pagamento: 'Transferido', encerrada_em: now, updated_at: now }).eq('id', cid);
      }
    }
  }
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

export async function openComanda(mesaId: string, atendenteId: string, nomeCliente: string, telefone?: string) {
  const payload: Record<string, unknown> = { mesa_id: mesaId, atendente_id: atendenteId, nome_cliente: nomeCliente };
  if (telefone != null && String(telefone).trim()) payload.telefone = String(telefone).trim();
  const { data, error } = await (supabase as any).from('comandas').insert(payload).select().single();
  if (error) throw error;
  return data as Database['public']['Tables']['comandas']['Row'];
}

/** Lista atendentes (id, nome) para dropdown de atribuição de mesa. */
export async function getAtendentes(): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await supabase.from('profiles').select('id, nome').eq('role', 'atendente').order('nome');
  if (error) throw error;
  return (data ?? []) as { id: string; nome: string }[];
}

/** Admin: atribui a comanda (mesa aberta) a outro atendente. */
export async function atribuirComandaParaAtendente(comandaId: string, novoAtendenteId: string): Promise<void> {
  await exigirAdminTransferencia();
  const { error } = await (supabase as any).from('comandas').update({ atendente_id: novoAtendenteId, updated_at: new Date().toISOString() }).eq('id', comandaId);
  if (error) throw error;
}

/** Lista de pagamentos já registrados na comanda (parciais e os que forem inseridos no encerramento). */
export async function getPagamentosComanda(comandaId: string): Promise<{ id: string; valor: number; forma_pagamento: string; nome_quem_pagou: string | null; tipo: string | null; pedido_ids: string[] | null; created_at: string }[]> {
  const { data } = await supabase.from('pagamentos').select('id, valor, forma_pagamento, nome_quem_pagou, tipo, pedido_ids, created_at').eq('comanda_id', comandaId).order('created_at', { ascending: true });
  const rows = (data ?? []) as any[];
  return rows.map((r) => ({
    id: r.id,
    valor: Number(r.valor),
    forma_pagamento: r.forma_pagamento ?? '',
    nome_quem_pagou: r.nome_quem_pagou ?? null,
    tipo: r.tipo ?? null,
    pedido_ids: Array.isArray(r.pedido_ids) ? r.pedido_ids : null,
    created_at: r.created_at ?? '',
  }));
}

/** Total a pagar da comanda (soma itens - descontos - pagamentos já registrados). */
export async function getTotalAPagarComanda(comandaId: string): Promise<number> {
  const { total } = await getTotalComanda(comandaId);
  const { data: peds } = await supabase.from('pedidos').select('desconto').eq('comanda_id', comandaId).neq('status', 'cancelado');
  const descontoTotal = (peds ?? []).reduce((s: number, p: any) => s + Number(p.desconto ?? 0), 0);
  const totalBruto = Math.max(0, total - descontoTotal);
  const { data: pagamentosData } = await supabase.from('pagamentos').select('valor').eq('comanda_id', comandaId);
  const jaPago = (pagamentosData ?? []).reduce((s: number, r: any) => s + Number(r.valor ?? 0), 0);
  return Math.max(0, totalBruto - jaPago);
}

export type FraçãoPagamento = { valor: number; forma_pagamento: string; nome_quem_pagou?: string };

/** Registra um pagamento parcial na comanda (antes do encerramento). tipo: 'parcial_pedidos' (valor dos pedidos selecionados) ou 'parcial_avulso'. */
export async function addPagamentoParcial(
  comandaId: string,
  opts: { valor: number; forma_pagamento: string; nome_quem_pagou: string; tipo: 'parcial_pedidos' | 'parcial_avulso'; pedido_ids?: string[] }
) {
  if (opts.valor <= 0) throw new Error('Valor deve ser maior que zero.');
  if (!opts.nome_quem_pagou?.trim()) throw new Error('Informe o nome de quem pagou.');
  await (supabase as any).from('pagamentos').insert({
    comanda_id: comandaId,
    valor: opts.valor,
    forma_pagamento: opts.forma_pagamento,
    nome_quem_pagou: opts.nome_quem_pagou.trim(),
    tipo: opts.tipo,
    pedido_ids: opts.pedido_ids ?? null,
  });
}

/** Remove um pagamento parcial da comanda (só parciais; exige confirmação na UI). */
export async function deletePagamentoParcial(pagamentoId: string): Promise<void> {
  const { data } = await supabase.from('pagamentos').select('id, tipo').eq('id', pagamentoId).single();
  if (!data) throw new Error('Pagamento não encontrado.');
  const tipo = (data as any).tipo;
  if (tipo !== 'parcial_pedidos' && tipo !== 'parcial_avulso') throw new Error('Só é possível excluir pagamentos parciais.');
  const { error } = await supabase.from('pagamentos').delete().eq('id', pagamentoId);
  if (error) throw error;
}

export async function closeComanda(comandaId: string, pagamentosOrForma: FraçãoPagamento[] | string) {
  const totalAPagar = await getTotalAPagarComanda(comandaId);
  const pagamentos: FraçãoPagamento[] = typeof pagamentosOrForma === 'string'
    ? (totalAPagar > 0 ? [{ valor: totalAPagar, forma_pagamento: pagamentosOrForma }] : [])
    : pagamentosOrForma;
  if (pagamentos.length === 0) {
    if (totalAPagar > 0.01) throw new Error('Informe ao menos uma forma de pagamento.');
    const now = new Date().toISOString();
    const resumo = typeof pagamentosOrForma === 'string' ? pagamentosOrForma : 'Sem consumo';
    await (supabase as any).from('comandas').update({ aberta: false, forma_pagamento: resumo, encerrada_em: now, updated_at: now }).eq('id', comandaId);
    await (supabase as any).from('pedidos').update({ encerrado_em: now, forma_pagamento: resumo, updated_at: now }).eq('comanda_id', comandaId).neq('status', 'cancelado');
    return;
  }
  const totalPago = pagamentos.reduce((s, p) => s + p.valor, 0);
  if (totalPago < totalAPagar - 0.01) throw new Error(`Valor pago (R$ ${totalPago.toFixed(2)}) é menor que o total restante da conta (R$ ${totalAPagar.toFixed(2)}).`);
  const now = new Date().toISOString();
  const resumo = pagamentos.length === 1 ? pagamentos[0].forma_pagamento : `Misto (${pagamentos.map((p) => p.forma_pagamento).join(', ')})`;
  for (const p of pagamentos) {
    if (p.valor > 0) {
      await (supabase as any).from('pagamentos').insert({
        comanda_id: comandaId,
        valor: p.valor,
        forma_pagamento: p.forma_pagamento,
        nome_quem_pagou: p.nome_quem_pagou?.trim() || null,
        tipo: null,
      });
    }
  }
  await (supabase as any).from('comandas').update({ aberta: false, forma_pagamento: resumo, encerrada_em: now, updated_at: now }).eq('id', comandaId);
  await (supabase as any).from('pedidos').update({ encerrado_em: now, forma_pagamento: resumo, updated_at: now }).eq('comanda_id', comandaId).neq('status', 'cancelado');
}

/** Total a pagar de um pedido (subtotal - desconto + taxa). */
export async function getTotalAPagarPedido(pedidoId: string): Promise<number> {
  const r = await getTotalPedidoById(pedidoId);
  return r.total;
}

/** Itens e total de um pedido (para impressão de conta). Funciona para qualquer pedido (mesa, viagem, online). */
export async function getTotalPedidoById(pedidoId: string): Promise<{ itens: { codigo: string; descricao: string; quantidade: number; valor: number }[]; total: number }> {
  const { data: ped } = await supabase.from('pedidos').select('desconto, taxa_entrega').eq('id', pedidoId).single();
  if (!ped) return { itens: [], total: 0 };
  const { data: itensData } = await supabase.from('pedido_itens').select('*, produtos(codigo, descricao, nome)').eq('pedido_id', pedidoId);
  const itens = (itensData ?? []) as any[];
  const list: { codigo: string; descricao: string; quantidade: number; valor: number }[] = [];
  let subtotal = 0;
  for (const i of itens) {
    const prod = i.produtos;
    const descricao = (prod?.nome ?? prod?.descricao) ?? '';
    const codigo = prod?.codigo ?? '';
    const valor = i.quantidade * Number(i.valor_unitario);
    list.push({ codigo, descricao, quantidade: i.quantidade, valor });
    subtotal += valor;
  }
  const desconto = Number((ped as any).desconto ?? 0);
  const taxa = Number((ped as any).taxa_entrega ?? 0);
  const total = Math.max(0, subtotal - desconto + taxa);
  return { itens: list, total };
}

export async function getComandaWithPedidos(comandaId: string) {
  const { data: comanda } = await supabase.from('comandas').select('*, profiles(nome)').eq('id', comandaId).maybeSingle();
  if (!comanda) return null;
  const { data: pedidos } = await supabase.from('pedidos').select('*, pedido_itens(*, produtos(*))').eq('comanda_id', comandaId).order('created_at', { ascending: false });
  return { comanda, pedidos: pedidos ?? [] };
}

export async function getCategorias() {
  const { data, error } = await supabase.from('categorias').select('*').order('ordem');
  if (error) throw error;
  return (data ?? []) as Database['public']['Tables']['categorias']['Row'][];
}

export async function getProdutos(ativoOnly = false): Promise<ProdutoWithCategorias[]> {
  let q = supabase
    .from('produtos')
    .select('*, produto_categorias(categoria_id, categorias(id, nome))')
    .order('codigo');
  if (ativoOnly) {
    q = q.eq('ativo', true).gt('quantidade', 0);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ProdutoWithCategorias[];
}

/** Salva produto (insert ou update) e sincroniza categorias em produto_categorias. */
export async function saveProduto(payload: {
  id?: string;
  codigo: string;
  nome: string | null;
  descricao: string;
  ingredientes: string | null;
  acompanhamentos: string | null;
  valor: number;
  quantidade: number;
  ativo: boolean;
  imagem_url: string | null;
  imagens?: string[];
  vai_para_cozinha: boolean;
  em_promocao: boolean;
  valor_promocional: number | null;
  categoria_ids: string[];
}) {
  const { categoria_ids, ...prod } = payload;
  const imagens = prod.imagens ?? [];
  const imagem_url = imagens.length > 0 ? imagens[0] : (prod.imagem_url ?? null);
  const row = {
    ...prod,
    imagens: imagens.length ? imagens : null,
    imagem_url,
    updated_at: new Date().toISOString(),
  };
  let produtoId: string;
  if (payload.id) {
    await (supabase as any).from('produtos').update(row).eq('id', payload.id);
    produtoId = payload.id;
  } else {
    const { data: inserted, error } = await (supabase as any).from('produtos').insert(row).select('id').single();
    if (error) throw error;
    produtoId = (inserted as { id: string }).id;
  }
  await (supabase as any).from('produto_categorias').delete().eq('produto_id', produtoId);
  if (categoria_ids.length > 0) {
    await (supabase as any).from('produto_categorias').insert(categoria_ids.map((categoria_id) => ({ produto_id: produtoId, categoria_id })));
  }
}

export async function nextPedidoNumero(): Promise<number> {
  const { data, error } = await supabase.rpc('next_pedido_numero');
  if (error) throw error;
  return data as number;
}

/** Verifica se a comanda existe e está aberta; lança se estiver fechada ou não existir. */
export async function getComandaAbertaOuErro(comandaId: string) {
  const { data, error } = await supabase.from('comandas').select('id, aberta').eq('id', comandaId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Comanda não encontrada.');
  const row = data as { id: string; aberta: boolean };
  if (row.aberta !== true) throw new Error('Esta mesa já foi encerrada. Não é possível incluir novos pedidos.');
  return row;
}

/** Agrupa itens por produto_id somando quantidade. */
function agruparItensPorProduto(itens: { produto_id: string; quantidade: number }[]): Record<string, number> {
  const byId: Record<string, number> = {};
  for (const i of itens) {
    byId[i.produto_id] = (byId[i.produto_id] ?? 0) + i.quantidade;
  }
  return byId;
}

/**
 * Decrementa estoque dos produtos ao lançar pedido.
 * Se quantidade ficar negativa, lança erro.
 * Se quantidade chegar a 0, marca produto como inativo (ativo = false).
 */
export async function decrementarEstoque(itens: { produto_id: string; quantidade: number }[]) {
  if (itens.length === 0) return;
  const porProduto = agruparItensPorProduto(itens);
  const ids = Object.keys(porProduto);
  const { data: produtos, error: err } = await supabase.from('produtos').select('id, nome, quantidade').in('id', ids);
  if (err) throw err;
  const lista = (produtos ?? []) as { id: string; nome: string | null; quantidade: number }[];
  const byId: Record<string, { nome: string | null; quantidade: number }> = {};
  lista.forEach((p) => { byId[p.id] = { nome: p.nome, quantidade: Number(p.quantidade) ?? 0 }; });
  for (const produtoId of ids) {
    const atual = byId[produtoId]?.quantidade ?? 0;
    const pedido = porProduto[produtoId] ?? 0;
    if (atual < pedido) {
      const nome = byId[produtoId]?.nome ?? 'Produto';
      throw new Error(`${nome} sem estoque suficiente. Disponível: ${atual}.`);
    }
  }
  const now = new Date().toISOString();
  for (const produtoId of ids) {
    const qty = porProduto[produtoId];
    const atual = byId[produtoId]?.quantidade ?? 0;
    const novaQtd = Math.max(0, atual - qty);
    await (supabase as any).from('produtos').update({ quantidade: novaQtd, ativo: novaQtd > 0, updated_at: now }).eq('id', produtoId);
  }
}

/**
 * Restaura estoque ao cancelar pedido: soma as quantidades dos itens de volta ao produto e reativa (ativo = true) se voltar a ter quantidade.
 */
export async function restaurarEstoque(pedidoId: string) {
  const { data: itens, error } = await supabase.from('pedido_itens').select('produto_id, quantidade').eq('pedido_id', pedidoId);
  if (error) throw error;
  if (!itens?.length) return;
  const porProduto = agruparItensPorProduto(itens as { produto_id: string; quantidade: number }[]);
  const now = new Date().toISOString();
  for (const produtoId of Object.keys(porProduto)) {
    const qty = porProduto[produtoId];
    const { data: row } = await supabase.from('produtos').select('quantidade').eq('id', produtoId).single();
    const atual = (row as { quantidade: number } | null) ? Number((row as any).quantidade) : 0;
    const novaQtd = atual + qty;
    await (supabase as any).from('produtos').update({ quantidade: novaQtd, ativo: true, updated_at: now }).eq('id', produtoId);
  }
}

export async function createPedidoPresencial(
  comandaId: string,
  itens: { produto_id: string; quantidade: number; valor_unitario: number; observacao?: string }[],
  opts?: { lancadoPeloAdmin?: boolean }
) {
  await getComandaAbertaOuErro(comandaId);
  await decrementarEstoque(itens);
  const numero = await nextPedidoNumero();
  const { data: pedido, error: e1 } = await (supabase as any).from('pedidos').insert({
    numero,
    comanda_id: comandaId,
    origem: 'presencial',
    status: 'novo_pedido',
    lancado_pelo_admin: opts?.lancadoPeloAdmin ?? false,
  }).select().single();
  if (e1) throw e1;
  const ped = pedido as { id: string };
  await (supabase as any).from('pedido_itens').insert(itens.map((i) => ({ pedido_id: ped.id, produto_id: i.produto_id, quantidade: i.quantidade, valor_unitario: i.valor_unitario, observacao: i.observacao ?? null })));
  return pedido;
}

export async function createPedidoViagem(
  nomeCliente: string,
  atendenteId: string,
  itens: { produto_id: string; quantidade: number; valor_unitario: number; observacao?: string }[],
  opts?: { lancadoPeloAdmin?: boolean; telefone?: string }
) {
  await decrementarEstoque(itens);
  const numero = await nextPedidoNumero();
  const { data: mesaViagem } = await supabase.from('mesas').select('id').eq('is_viagem', true).single();
  if (!mesaViagem) throw new Error('Mesa VIAGEM não encontrada');
  const mesa = mesaViagem as { id: string };
  const comandaPayload: Record<string, unknown> = { mesa_id: mesa.id, atendente_id: atendenteId, nome_cliente: nomeCliente, aberta: true };
  if (opts?.telefone != null && String(opts.telefone).trim()) comandaPayload.telefone = String(opts.telefone).trim();
  const { data: comanda, error: ec } = await (supabase as any).from('comandas').insert(comandaPayload).select().single();
  if (ec) throw ec;
  const com = comanda as { id: string };
  const ids = [...new Set(itens.map((i) => i.produto_id))];
  const { data: produtos } = await supabase.from('produtos').select('id, vai_para_cozinha').in('id', ids);
  const byId: Record<string, { vai_para_cozinha: boolean }> = {};
  (produtos ?? []).forEach((p: any) => { byId[p.id] = p; });
  const temItemParaCozinha = itens.some((i) => Boolean(byId[i.produto_id]?.vai_para_cozinha));
  const status = temItemParaCozinha ? 'novo_pedido' : 'finalizado';
  const payload: Record<string, unknown> = { numero, comanda_id: com.id, origem: 'viagem', status, cliente_nome: nomeCliente, lancado_pelo_admin: opts?.lancadoPeloAdmin ?? false };
  const { data: pedido, error: e1 } = await (supabase as any).from('pedidos').insert(payload).select().single();
  if (e1) throw e1;
  const ped = pedido as { id: string };
  await (supabase as any).from('pedido_itens').insert(itens.map((i) => ({ pedido_id: ped.id, produto_id: i.produto_id, quantidade: i.quantidade, valor_unitario: i.valor_unitario, observacao: i.observacao ?? null })));
  return { pedido, comanda };
}

export async function updatePedidoStatus(
  pedidoId: string,
  status: 'novo_pedido' | 'em_preparacao' | 'finalizado' | 'cancelado',
  opts?: { motivo_cancelamento?: string; cancelado_por?: string; adminOverride?: boolean }
) {
  if (status === 'cancelado') {
    const { data: atual } = await supabase.from('pedidos').select('status').eq('id', pedidoId).single();
    const statusAtual = (atual as { status: string } | null)?.status;
    if (statusAtual !== 'cancelado') {
      if (!opts?.adminOverride && statusAtual && !STATUS_EDITAVEL.includes(statusAtual)) {
        throw new Error(`Pedido não pode ser cancelado. Status atual: ${statusAtual}. Apenas admin pode cancelar após início do preparo.`);
      }
      await restaurarEstoque(pedidoId);
    }
  }
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = { status, updated_at: now };
  if (status === 'cancelado' && opts) {
    if (opts.motivo_cancelamento) payload.motivo_cancelamento = opts.motivo_cancelamento;
    if (opts.cancelado_por) payload.cancelado_por = opts.cancelado_por;
    payload.cancelado_em = now;
  }
  await (supabase as any).from('pedidos').update(payload).eq('id', pedidoId);
}

export async function getPedidosByComanda(comandaId: string) {
  const { data } = await supabase.from('pedidos').select('*, pedido_itens(*, produtos(*)), comandas(profiles(nome))').eq('comanda_id', comandaId).order('created_at', { ascending: false });
  return (data ?? []) as any[];
}

/** Busca o status atual de um pedido (para verificação em tempo real). */
export async function getPedidoStatus(pedidoId: string): Promise<{ status: string } | null> {
  const { data } = await supabase.from('pedidos').select('status').eq('id', pedidoId).single();
  return data as { status: string } | null;
}

const STATUS_EDITAVEL = ['novo_pedido', 'aguardando_aceite'];

/**
 * Atualiza os itens de um pedido. Só permite se o status for novo_pedido ou aguardando_aceite.
 * Ajusta estoque: restaura o que foi removido, decrementa o que foi adicionado.
 */
export async function updatePedidoItens(
  pedidoId: string,
  itens: { produto_id: string; quantidade: number; valor_unitario: number; observacao?: string }[],
  opts?: { adminOverride?: boolean }
) {
  const { data: ped, error: ePed } = await supabase.from('pedidos').select('status').eq('id', pedidoId).single();
  if (ePed || !ped) throw new Error('Pedido não encontrado.');
  const status = (ped as { status: string }).status;
  if (!opts?.adminOverride && !STATUS_EDITAVEL.includes(status)) throw new Error(`Pedido não pode ser editado. Status atual: ${status}.`);

  const { data: atuais, error: eItens } = await supabase.from('pedido_itens').select('produto_id, quantidade').eq('pedido_id', pedidoId);
  if (eItens) throw eItens;
  const antigoPorProduto = agruparItensPorProduto((atuais ?? []) as { produto_id: string; quantidade: number }[]);
  const novoPorProduto = agruparItensPorProduto(itens);

  const todosProdutos = [...new Set([...Object.keys(antigoPorProduto), ...Object.keys(novoPorProduto)])];
  const now = new Date().toISOString();
  for (const produtoId of todosProdutos) {
    const antigo = antigoPorProduto[produtoId] ?? 0;
    const novo = novoPorProduto[produtoId] ?? 0;
    const delta = novo - antigo;
    if (delta > 0) {
      const { data: row } = await supabase.from('produtos').select('id, nome, quantidade').eq('id', produtoId).single();
      const atual = (row as { quantidade: number } | null) ? Number((row as any).quantidade) : 0;
      if (atual < delta) {
        const nome = (row as { nome?: string } | null)?.nome ?? 'Produto';
        throw new Error(`${nome} sem estoque suficiente. Disponível: ${atual}.`);
      }
      const novaQtd = Math.max(0, atual - delta);
      await (supabase as any).from('produtos').update({ quantidade: novaQtd, ativo: novaQtd > 0, updated_at: now }).eq('id', produtoId);
    } else if (delta < 0) {
      const { data: row } = await supabase.from('produtos').select('quantidade').eq('id', produtoId).single();
      const atual = (row as { quantidade: number } | null) ? Number((row as any).quantidade) : 0;
      await (supabase as any).from('produtos').update({ quantidade: atual + Math.abs(delta), ativo: true, updated_at: now }).eq('id', produtoId);
    }
  }

  await (supabase as any).from('pedido_itens').delete().eq('pedido_id', pedidoId);
  if (itens.length > 0) {
    await (supabase as any).from('pedido_itens').insert(itens.map((i) => ({ pedido_id: pedidoId, produto_id: i.produto_id, quantidade: i.quantidade, valor_unitario: i.valor_unitario, observacao: i.observacao ?? null })));
  }
}

export async function getPedidosCozinha() {
  const { data } = await supabase
    .from('pedidos')
    .select('id, numero, status, origem, cliente_nome, encerrado_em, updated_at, aceito_em, created_at, comanda_id, lancado_pelo_admin, pedido_itens(id, quantidade, observacao, produtos(id, nome, descricao, vai_para_cozinha)), comandas(nome_cliente, mesa_id, mesas(numero, nome), profiles(nome))')
    .in('status', ['novo_pedido', 'em_preparacao', 'finalizado'])
    .order('created_at');
  const list = (data ?? []) as any[];
  return list.filter((p) => {
    const itens = p.pedido_itens ?? [];
    const temItemParaCozinha = itens.some((i: any) => Boolean(i.produtos?.vai_para_cozinha));
    return temItemParaCozinha;
  });
}

/** Pedidos que estão na mesa Viagem (comanda da mesa viagem aberta). Não usa origem do pedido, para que pedidos movidos para outra mesa deixem de aparecer aqui. */
export async function getPedidosViagemAbertos() {
  const { data: mesas } = await supabase.from('mesas').select('id').eq('is_viagem', true).limit(1);
  const viagemMesaId = ((mesas ?? []) as { id: string }[])[0]?.id;
  if (!viagemMesaId) return [];
  const { data: comandas } = await supabase.from('comandas').select('id').eq('mesa_id', viagemMesaId).eq('aberta', true);
  const comandaIds = (comandas ?? []).map((c: { id: string }) => c.id);
  if (!comandaIds.length) return [];
  const { data } = await supabase
    .from('pedidos')
    .select('*, pedido_itens(*, produtos(*)), comandas(nome_cliente, aberta, atendente_id, profiles(nome))')
    .in('comanda_id', comandaIds)
    .neq('status', 'cancelado')
    .order('created_at', { ascending: false });
  return (data ?? []) as any[];
}

/** Pedidos da mesa Viagem já encerrados hoje (para o accordion de finalizados). */
export async function getPedidosViagemEncerradosHoje() {
  const { data: mesas } = await supabase.from('mesas').select('id').eq('is_viagem', true).limit(1);
  const viagemMesaId = ((mesas ?? []) as { id: string }[])[0]?.id;
  if (!viagemMesaId) return [];
  const { data: comandas } = await supabase.from('comandas').select('id').eq('mesa_id', viagemMesaId).eq('aberta', false);
  const comandaIds = (comandas ?? []).map((c: { id: string }) => c.id);
  if (!comandaIds.length) return [];
  const { desde, ate } = hojeBrasiliaUTC();
  const { data } = await supabase
    .from('pedidos')
    .select('*, pedido_itens(*, produtos(*)), comandas(nome_cliente, aberta, atendente_id, profiles(nome))')
    .in('comanda_id', comandaIds)
    .eq('status', 'finalizado')
    .not('encerrado_em', 'is', null)
    .gte('encerrado_em', desde)
    .lte('encerrado_em', ate)
    .order('encerrado_em', { ascending: false });
  return (data ?? []) as any[];
}

/** Pedidos presencial (mesas) criados na data atual (fuso Brasília). */
export async function getPedidosPresencialHoje() {
  const { desde, ate } = hojeBrasiliaUTC();
  const { data } = await supabase
    .from('pedidos')
    .select('*, pedido_itens(*, produtos(*)), comandas(nome_cliente, mesa_id, atendente_id, mesas(numero, nome), profiles(nome))')
    .eq('origem', 'presencial')
    .neq('status', 'cancelado')
    .gte('created_at', desde)
    .lte('created_at', ate)
    .order('created_at', { ascending: false });
  return (data ?? []) as any[];
}

/** Pedidos viagem criados na data atual (fuso Brasília). */
export async function getPedidosViagemHoje() {
  const { desde, ate } = hojeBrasiliaUTC();
  const { data } = await supabase
    .from('pedidos')
    .select('*, pedido_itens(*, produtos(*)), comandas(nome_cliente, aberta, atendente_id, profiles(nome))')
    .eq('origem', 'viagem')
    .neq('status', 'cancelado')
    .gte('created_at', desde)
    .lte('created_at', ate)
    .order('created_at', { ascending: false });
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

export async function encerrarPedidoOnline(pedidoId: string, pagamentos: FraçãoPagamento[]) {
  const totalAPagar = await getTotalAPagarPedido(pedidoId);
  const contaZerada = totalAPagar < 0.01;
  if (!contaZerada && (!pagamentos?.length)) throw new Error('Informe ao menos uma forma de pagamento.');
  const totalPago = (pagamentos ?? []).reduce((s, p) => s + p.valor, 0);
  if (!contaZerada && totalPago < totalAPagar - 0.01) throw new Error(`Valor pago (R$ ${totalPago.toFixed(2)}) é menor que o total do pedido (R$ ${totalAPagar.toFixed(2)}).`);
  const now = new Date().toISOString();
  const resumo = contaZerada || !pagamentos?.length ? 'Cortesia' : pagamentos.length === 1 ? pagamentos[0].forma_pagamento : `Misto (${pagamentos.map((p) => p.forma_pagamento).join(', ')})`;
  for (const p of pagamentos ?? []) {
    await (supabase as any).from('pagamentos').insert({ pedido_id: pedidoId, valor: p.valor, forma_pagamento: p.forma_pagamento });
  }
  await (supabase as any).from('pedidos').update({ encerrado_em: now, forma_pagamento: resumo, updated_at: now }).eq('id', pedidoId);
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
  const { allowed, message } = await canPlaceOrderOnline();
  if (!allowed) throw new Error(message ?? 'A lanchonete está fechada para pedidos online.');
  await decrementarEstoque(payload.itens);
  const tipoEntrega = payload.tipo_entrega ?? 'entrega';
  const taxa = tipoEntrega === 'retirada' ? 0 : await getConfig('taxa_entrega');
  const numero = await nextPedidoNumero();
  let desconto = 0;
  if (payload.cupom_codigo) {
    const codigoTrim = payload.cupom_codigo.trim();
    const { data: cupomData } = await supabase.from('cupons').select('*').ilike('codigo', codigoTrim).eq('ativo', true).maybeSingle();
    const cupom = cupomData as { valido_ate: string; usos_restantes: number; porcentagem: number; valor_maximo?: number | null } | null;
    if (cupom && new Date(cupom.valido_ate) >= new Date() && Number(cupom.usos_restantes) > 0) {
      const subTotal = payload.itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
      desconto = (subTotal * Number(cupom.porcentagem)) / 100;
      if (cupom.valor_maximo != null) desconto = Math.min(desconto, Number(cupom.valor_maximo));
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

/** Remove referências ao cupom nos pedidos e exclui o cupom. */
export async function deleteCupom(cupomId: string) {
  await (supabase as any).from('pedidos').update({ cupom_id: null }).eq('cupom_id', cupomId);
  const { error } = await supabase.from('cupons').delete().eq('id', cupomId);
  if (error) throw error;
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
    .select('id, numero, origem, encerrado_em, created_at, cliente_nome, desconto, taxa_entrega, forma_pagamento, comanda_id, comandas(nome_cliente, mesa_id, atendente_id, mesas(numero, nome))')
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
  const atendenteIds = [...new Set(pedidos.map((p: any) => {
    const c = p.comandas;
    const atendenteId = c && (Array.isArray(c) ? c[0]?.atendente_id : c.atendente_id);
    return atendenteId;
  }).filter(Boolean))] as string[];
  const nomesAtendente: Record<string, string> = {};
  if (atendenteIds.length) {
    const { data: profiles } = await supabase.from('profiles').select('id, nome').in('id', atendenteIds);
    (profiles ?? []).forEach((r: any) => { nomesAtendente[r.id] = r.nome; });
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
    const atendenteId = comanda && (Array.isArray(comanda) ? comanda[0]?.atendente_id : comanda.atendente_id);
    return {
      ...p,
      cliente_nome: clienteNome ?? '-',
      total,
      desconto,
      subtotal,
      taxa,
      atendente_nome: atendenteId ? (nomesAtendente[atendenteId] ?? '-') : '-',
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
  const comandaIds: string[] = [];
  for (const [comandaId, grupo] of porComanda) {
    comandaIds.push(comandaId);
    const numeros = grupo.map((p) => p.numero).sort((a, b) => a - b);
    const descontoTotal = grupo.reduce((s, p) => s + p.desconto, 0);
    const subtotalMesa = grupo.reduce((s, p) => s + p.subtotal, 0);
    const totalMesa = grupo.reduce((s, p) => s + p.total, 0);
    const primeiro = grupo[0];
    const comanda = (primeiro as any).comandas;
    aggregated.push({
      id: 'comanda-' + comandaId,
      comanda_id: comandaId,
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
      atendente_nome: (primeiro as any).atendente_nome ?? '-',
    });
  }

  for (const p of online) {
    (p as any).mesa = '-';
    (p as any).atendente_nome = '-';
  }

  const resultado = [...aggregated, ...online].sort(
    (a, b) => new Date(a.encerrado_em || 0).getTime() - new Date(b.encerrado_em || 0).getTime()
  );
  const totalGeral = resultado.reduce((s, p) => s + p.total, 0);

  const pedidoIdsOnline = online.map((p: any) => p.id);
  const pagamentosComanda = comandaIds.length
    ? await supabase.from('pagamentos').select('comanda_id, valor, forma_pagamento, nome_quem_pagou').in('comanda_id', comandaIds)
    : { data: [] };
  const pagamentosPedido = pedidoIdsOnline.length
    ? await supabase.from('pagamentos').select('pedido_id, valor, forma_pagamento, nome_quem_pagou').in('pedido_id', pedidoIdsOnline)
    : { data: [] };
  const pagamentosByComanda: Record<string, { valor: number; forma_pagamento: string; nome_quem_pagou?: string | null }[]> = {};
  const pagamentosByPedido: Record<string, { valor: number; forma_pagamento: string; nome_quem_pagou?: string | null }[]> = {};
  for (const row of (pagamentosComanda.data ?? []) as any[]) {
    if (!row.comanda_id) continue;
    if (!pagamentosByComanda[row.comanda_id]) pagamentosByComanda[row.comanda_id] = [];
    pagamentosByComanda[row.comanda_id].push({
      valor: Number(row.valor),
      forma_pagamento: row.forma_pagamento,
      nome_quem_pagou: row.nome_quem_pagou ?? null,
    });
  }
  for (const row of (pagamentosPedido.data ?? []) as any[]) {
    if (!row.pedido_id) continue;
    if (!pagamentosByPedido[row.pedido_id]) pagamentosByPedido[row.pedido_id] = [];
    pagamentosByPedido[row.pedido_id].push({
      valor: Number(row.valor),
      forma_pagamento: row.forma_pagamento,
      nome_quem_pagou: row.nome_quem_pagou ?? null,
    });
  }
  const totalPorFormaPagamento: Record<string, number> = {};
  const fmtPagamento = (lista: { valor: number; forma_pagamento: string; nome_quem_pagou?: string | null }[]) =>
    lista.length ? lista.map((x) => `${x.forma_pagamento} R$ ${x.valor.toFixed(2)}${x.nome_quem_pagou ? ` (${x.nome_quem_pagou})` : ''}`).join(', ') : null;
  for (const row of resultado) {
    if (row.comanda_id && pagamentosByComanda[row.comanda_id]?.length) {
      row.forma_pagamento = fmtPagamento(pagamentosByComanda[row.comanda_id]) ?? row.forma_pagamento;
    }
    if (row.origem === 'online' && row.id && pagamentosByPedido[row.id]?.length) {
      row.forma_pagamento = fmtPagamento(pagamentosByPedido[row.id]) ?? row.forma_pagamento;
    }
    const list = row.comanda_id ? pagamentosByComanda[row.comanda_id] : row.origem === 'online' ? pagamentosByPedido[row.id] : null;
    if (list) for (const x of list) {
      totalPorFormaPagamento[x.forma_pagamento] = (totalPorFormaPagamento[x.forma_pagamento] ?? 0) + x.valor;
    }
  }
  return { pedidos: resultado, totalGeral, totalPorFormaPagamento };
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

/** Aplica desconto em pedido online (cupom e/ou manual). Persiste para que o encerramento use o total correto. */
export async function applyDescontoPedidoOnline(pedidoId: string, cupomId: string | null, valorDesconto: number) {
  await (supabase as any).from('pedidos').update({
    desconto: valorDesconto,
    cupom_id: cupomId,
    updated_at: new Date().toISOString(),
  }).eq('id', pedidoId);
}

/** Remove o desconto do pedido online. */
export async function clearDescontoPedidoOnline(pedidoId: string) {
  await (supabase as any).from('pedidos').update({
    desconto: 0,
    cupom_id: null,
    updated_at: new Date().toISOString(),
  }).eq('id', pedidoId);
}

export async function getRelatorioCancelamentos(desde: string, ate: string) {
  const { data } = await supabase
    .from('pedidos')
    .select('id, numero, origem, motivo_cancelamento, cancelado_por, cancelado_em, created_at, cliente_nome, comanda_id, comandas(atendente_id)')
    .eq('status', 'cancelado')
    .gte('cancelado_em', desde)
    .lte('cancelado_em', ate)
    .order('cancelado_em', { ascending: false });
  const pedidos = (data ?? []) as any[];
  if (pedidos.length === 0) return { itens: [], total: 0 };
  const idsCancelado = [...new Set(pedidos.map((p) => p.cancelado_por).filter(Boolean))] as string[];
  const idsAtendente = [...new Set(pedidos.map((p: any) => {
    const c = p.comandas;
    return c && (Array.isArray(c) ? c[0]?.atendente_id : c.atendente_id);
  }).filter(Boolean))] as string[];
  const todosIds = [...new Set([...idsCancelado, ...idsAtendente])];
  const { data: profiles } = todosIds.length ? await supabase.from('profiles').select('id, nome').in('id', todosIds) : { data: [] };
  const nomes: Record<string, string> = {};
  (profiles ?? []).forEach((r: any) => { nomes[r.id] = r.nome; });
  const itens = pedidos.map((p: any) => {
    const comanda = p.comandas;
    const atendenteId = comanda && (Array.isArray(comanda) ? comanda[0]?.atendente_id : comanda.atendente_id);
    return {
      ...p,
      cancelado_por_nome: p.cancelado_por ? nomes[p.cancelado_por] ?? p.cancelado_por : '-',
      atendente_nome: atendenteId ? (nomes[atendenteId] ?? '-') : '-',
    };
  });
  return { itens, total: itens.length };
}

/** Marca notificação como vista. */
export async function marcarNotificacaoComoVista(notificacaoId: string) {
  await (supabase as any).from('notificacoes').update({ visto: true }).eq('id', notificacaoId);
}

/** Busca notificações não vistas do atendente. */
export async function getNotificacoesNaoVistas(atendenteId: string) {
  const { data, error } = await supabase
    .from('notificacoes')
    .select('id, mensagem, pedido_numero')
    .eq('atendente_id', atendenteId)
    .eq('visto', false)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as { id: string; mensagem: string; pedido_numero: number }[];
}

/** Inscreve nas notificações do atendente (Realtime + polling). Retorna função para cancelar. O primeiro poll só preenche ids já existentes (não dispara onNotificacao). */
export function subscribeToNotificacoesAtendente(
  atendenteId: string,
  onNotificacao: (notificacao: { id: string; mensagem: string; pedido_numero: number }) => void
) {
  const idsVistos = new Set<string>();
  let primeiroPoll = true;
  const poll = async () => {
    const list = await getNotificacoesNaoVistas(atendenteId);
    for (const n of list) {
      if (!idsVistos.has(n.id)) {
        idsVistos.add(n.id);
        if (!primeiroPoll) onNotificacao(n);
      }
    }
    primeiroPoll = false;
  };
  poll();
  const interval = setInterval(poll, 3000);
  const channel = supabase
    .channel('notificacoes-atendente')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notificacoes',
        filter: `atendente_id=eq.${atendenteId}`,
      },
      (payload) => {
        const n = payload.new as { id: string; mensagem: string; pedido_numero: number };
        if (!idsVistos.has(n.id)) {
          idsVistos.add(n.id);
          onNotificacao(n);
        }
      }
    )
    .subscribe();
  return () => {
    clearInterval(interval);
    supabase.removeChannel(channel);
  };
}
