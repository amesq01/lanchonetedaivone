/**
 * Integração simples com o app RawBT (Android).
 *
 * Envia dados para o app RawBT (Android) usando `rawbt:base64,...`.
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
  /** Online: 'retirada' | 'entrega' */
  tipo_entrega?: string | null;
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

/** Linha clara: mesa (salão), viagem ou online retirada/entrega. */
function linhaOrigemLocal(pedido: PedidoCozinha): string {
  const origem = (pedido.origem || '').toLowerCase();
  const mesas = pedido.comandas?.mesas;
  const mesaNum = mesas?.numero != null ? safeStr(mesas.numero) : '';
  const mesaNome = mesas?.nome != null ? safeStr(mesas.nome).trim() : '';

  if (origem === 'online') {
    const t = (pedido.tipo_entrega || '').toLowerCase();
    if (t === 'retirada') return 'Online — Retirada no local';
    if (t === 'entrega') return 'Online — Entrega';
    return 'Online';
  }

  if (origem === 'viagem') {
    const partes: string[] = ['Mesa viagem'];
    if (mesaNome) partes.push(mesaNome);
    else if (mesaNum) partes.push(`Nº ${mesaNum}`);
    return partes.join(' — ');
  }

  // presencial (e fallback)
  if (mesaNum || mesaNome) {
    const p = [mesaNum ? `Mesa ${mesaNum}` : null, mesaNome || null].filter(Boolean);
    return p.join(' — ');
  }
  return origem === 'presencial' ? 'Presencial (mesa não informada)' : `Origem: ${origem || '-'}`;
}

function buildPedidoCozinhaTexto(pedido: PedidoCozinha): string {
  const numero = safeStr(pedido.numero);
  const cliente = safeStr(pedido.cliente_nome || pedido.comandas?.nome_cliente || '-');
  const origemLocal = linhaOrigemLocal(pedido);
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
  lines.push(origemLocal);
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

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function buildEscPosBytesComFonteMaior(texto: string): Uint8Array {
  const ESC = 0x1b;
  const GS = 0x1d;
  const LF = 0x0a;

  const out: number[] = [];
  // Inicializa impressora
  out.push(ESC, 0x40);
  // Alinhamento à esquerda
  out.push(ESC, 0x61, 0x00);
  // Fonte padrão para cabeçalho/demais linhas
  out.push(GS, 0x21, 0x00);

  const enc = new TextEncoder();
  const linhas = texto.split('\n').filter((l) => l.trim() !== '');
  const idxSeparador = linhas.findIndex((l) => l.includes('----------------------------'));

  const appendLine = (linha: string) => {
    const bytes = enc.encode(linha);
    for (let i = 0; i < bytes.length; i += 1) out.push(bytes[i]);
    out.push(LF);
  };

  if (idxSeparador === -1) {
    // Fallback: se não achar a seção de itens, imprime tudo no tamanho padrão.
    for (const linha of linhas) appendLine(linha);
  } else {
    const cabecalho = linhas.slice(0, idxSeparador + 1);
    const itens = linhas.slice(idxSeparador + 1);

    // Cabeçalho em fonte normal
    for (const linha of cabecalho) appendLine(linha);

    // Somente os itens em fonte maior (altura dobrada)
    out.push(GS, 0x21, 0x01);
    for (const linha of itens) appendLine(linha);
    // Retorna para fonte normal
    out.push(GS, 0x21, 0x00);
  }

  // Avanço de papel para destacar a saída
  out.push(LF, LF, LF);

  return new Uint8Array(out);
}

export function imprimirPedidoCozinhaRawBT(pedido: PedidoCozinha) {
  const texto = buildPedidoCozinhaTexto(pedido);
  const bytes = buildEscPosBytesComFonteMaior(texto);
  const url = `rawbt:base64,${toBase64(bytes)}`;

  // Chamar no clique do usuário para reduzir chance de bloqueio.
  window.location.href = url;
}

