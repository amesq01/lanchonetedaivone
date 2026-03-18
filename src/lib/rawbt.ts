/**
 * Integração simples com o app RawBT (Android).
 *
 * A ideia é enviar um texto (com quebras de linha) para o esquema `rawbt:...`.
 * O RawBT normalmente imprime na última impressora selecionada/pareada.
 *
 * Observação: a especificação do RawBT pode variar por versão. Se você precisar
 * de um parâmetro para MAC/BD_ADDR ou formato ESC/POS binário, me passe
 * o exemplo do link/intent que funciona no seu celular.
 */

type PedidoCozinha = {
  id: string;
  numero: number;
  origem?: string;
  created_at?: string;
  cliente_nome?: string | null;
  ponto_referencia?: string | null;
  // Usado pela tela
  comandas?: {
    nome_cliente?: string | null;
    mesa_id?: string | null;
    mesas?: { numero?: number | null; nome?: string | null } | null;
    profiles?: { nome?: string | null } | null;
    aberta?: boolean;
  } | null;
  pedido_itens?: Array<{
    id?: string;
    quantidade?: number;
    produtos?: { nome?: string | null; descricao?: string | null; vai_para_cozinha?: boolean | null } | null;
    observacao?: string | null;
  }> | null;
};

function safeStr(v: unknown): string {
  if (v == null) return '';
  return String(v);
}

function encodeRawbtText(text: string): string {
  // EncodeURIComponent já transforma '\n' em '%0A', que o RawBT entende.
  return encodeURIComponent(text);
}

function buildPedidoCozinhaTexto(pedido: PedidoCozinha): string {
  const numero = safeStr(pedido.numero);
  const cliente = safeStr(pedido.cliente_nome || pedido.comandas?.nome_cliente || '-');
  const mesaNumero = pedido.comandas?.mesas?.numero != null ? safeStr(pedido.comandas?.mesas?.numero) : '';
  const mesaNome = pedido.comandas?.mesas?.nome != null ? safeStr(pedido.comandas?.mesas?.nome) : '';
  const mesaInfo = [mesaNumero ? `Mesa ${mesaNumero}` : null, mesaNome || null].filter(Boolean).join(' - ');
  const atendente = safeStr(pedido.comandas?.profiles?.nome || '');

  const itens = (pedido.pedido_itens ?? [])
    .filter((i) => Boolean(i.produtos?.vai_para_cozinha))
    .map((i) => {
      const qtd = i.quantidade ?? 0;
      const nomeItem = safeStr(i.produtos?.nome || i.produtos?.descricao || '-');
      const obs = i.observacao ? ` (${safeStr(i.observacao)})` : '';
      return `${qtd}x ${nomeItem}${obs}`;
    });

  const lines: string[] = [];
  lines.push('Lanchonete Terra e Mar');
  lines.push('COZINHA');
  lines.push(`Pedido #${numero}`);
  if (mesaInfo) lines.push(mesaInfo);
  lines.push(`Cliente: ${cliente}`);
  if (atendente) lines.push(`Atendente: ${atendente}`);
  if (pedido.ponto_referencia) lines.push(`Ref: ${safeStr(pedido.ponto_referencia)}`);
  lines.push('----------------------------');
  if (itens.length) lines.push(...itens);
  else lines.push('(sem itens para cozinha)');

  lines.push('');
  lines.push(' ');
  return lines.join('\n');
}

export function imprimirPedidoCozinhaRawBT(pedido: PedidoCozinha) {
  const texto = buildPedidoCozinhaTexto(pedido);
  const url = `rawbt:${encodeRawbtText(texto)}`;

  // Chamar no clique do usuário para reduzir chance de bloqueio.
  window.location.href = url;
}

