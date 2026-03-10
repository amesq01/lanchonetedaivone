import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

/** Código PIX Copia e Cola (EMV) */
const PIX_CODIGO =
  '00020101021126810014BR.GOV.BCB.PIX2559pix-qr.mercadopago.com/instore/ol/v2/3Z8a9lIADOTW2ZtS0GvMcl5204000053039865802BR5914Ivone Mesquita6009SAO PAULO62080504mpis630437A0';
const PIX_NOME = 'Ivone Pereira Mesquita';
const QR_SIZE_MM = 40;

const PAPER_WIDTH_MM = 80;
const MARGIN_MM = 1;
const CONTENT_WIDTH = PAPER_WIDTH_MM - MARGIN_MM * 2;
/** Posição X (align right) dos valores na seção de totais — um pouco mais à esquerda que a margem direita. */
const VALORES_RIGHT_MM = PAPER_WIDTH_MM - MARGIN_MM - 10;

const BLACK = [0, 0, 0] as [number, number, number];

function createDoc(): jsPDF {
  const doc = new jsPDF({
    unit: 'mm',
    format: [PAPER_WIDTH_MM, 297],
    hotfixes: ['px_scaling'],
  });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLACK);
  return doc;
}

/** Gera QR code PIX a partir do código e adiciona nome da titular abaixo. Retorna o y final. */
async function addPixQrCode(doc: jsPDF, y: number): Promise<number> {
  const dataUrl = await QRCode.toDataURL(PIX_CODIGO, { width: 400, margin: 1 });
  const qrX = (PAPER_WIDTH_MM - QR_SIZE_MM) / 2;
  doc.addImage(dataUrl, 'PNG', qrX, y, QR_SIZE_MM, QR_SIZE_MM);
  y += QR_SIZE_MM + 4;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLACK);
  doc.text(PIX_NOME, PAPER_WIDTH_MM / 2, y, { align: 'center' });
  y += 8;
  return y;
}

function addFooter(doc: jsPDF, y: number) {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BLACK);
  doc.text('Obrigado! Volte sempre.', PAPER_WIDTH_MM / 2, y, { align: 'center' });
}

/** Remove o iframe e revoga a URL. Só chamar depois que o usuário fechar o diálogo de impressão. */
function removeIframeAndRevoke(iframe: HTMLIFrameElement, url: string) {
  if (iframe.parentNode) document.body.removeChild(iframe);
  URL.revokeObjectURL(url);
}

/** Exibe o PDF em iframe e abre o diálogo de impressão. Só remove o iframe quando o usuário fechar o diálogo (afterprint). */
function openAndPrint(doc: jsPDF) {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;border:none;z-index:9999;opacity:0;pointer-events:none;background:transparent;';
  document.body.appendChild(iframe);
  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) return;
    const cleanup = () => removeIframeAndRevoke(iframe, url);
    win.addEventListener('afterprint', cleanup, { once: true });
    win.print();
    setTimeout(cleanup, 120000);
  };
  iframe.src = url;
}

export type ItemConta = { codigo: string; descricao: string; quantidade: number; valor: number };

const TABLE_STYLES = {
  headStyles: {
    fontStyle: 'bold' as const,
    fontSize: 9,
    textColor: BLACK,
    halign: 'center' as const,
    fillColor: undefined as [number, number, number] | undefined,
    lineWidth: { top: 0, right: 0, bottom: 0.4, left: 0 },
  },
  bodyStyles: { fontSize: 9, textColor: BLACK, fillColor: undefined as [number, number, number] | undefined },
  alternateRowStyles: { fillColor: undefined as [number, number, number] | undefined },
  columnStyles: {
    0: { cellWidth: 10, halign: 'left' as const },
    1: { cellWidth: 24, halign: 'center' as const },
    2: { cellWidth: 9, halign: 'center' as const },
    3: { cellWidth: 14, halign: 'center' as const },
    4: { cellWidth: 14, halign: 'center' as const },
  },
};

/** Linha opcional no bloco de totais: label à esquerda, valor à direita (com R$). */
type LinhaTotal = { label: string; valor: string };

function addTotaisSection(
  doc: jsPDF,
  y: number,
  subtotal: number,
  total: number,
  linhasMeio: LinhaTotal[] = []
): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BLACK);
  doc.text('Subtotal:', MARGIN_MM, y);
  doc.text(`R$ ${subtotal.toFixed(2)}`, VALORES_RIGHT_MM, y, { align: 'right' });
  y += 5;
  for (const linha of linhasMeio) {
    doc.text(linha.label, MARGIN_MM, y);
    doc.text(linha.valor, VALORES_RIGHT_MM, y, { align: 'right' });
    y += 5;
  }
  y += 2;
  doc.setDrawColor(0, 0, 0);
  doc.line(MARGIN_MM, y, PAPER_WIDTH_MM - MARGIN_MM, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL:', MARGIN_MM, y);
  doc.text(`R$ ${total.toFixed(2)}`, VALORES_RIGHT_MM, y, { align: 'right' });
  return y + 12;
}

/** Conta da mesa (presencial). Inclui pagamentos parciais se informados. */
export async function printContaMesa(opts: {
  titulo: string;
  clienteNome?: string;
  clienteTelefone?: string;
  itens: ItemConta[];
  subtotal: number;
  valorCupom: number;
  valorManual: number;
  total: number;
  cupomCodigo?: string;
  pagamentosParciais?: { valor: number; forma_pagamento: string; nome_quem_pagou: string | null; descricaoTipo?: string }[];
  restanteAPagar?: number;
}) {
  const doc = createDoc();
  let y = 10;
  doc.setTextColor(...BLACK);
  doc.setFontSize(14);
  doc.text('Lanchonete Terra e Mar', PAPER_WIDTH_MM / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BLACK);
  const tituloLines = doc.splitTextToSize(opts.titulo, CONTENT_WIDTH);
  doc.text(tituloLines, PAPER_WIDTH_MM / 2, y, { align: 'center' });
  y += tituloLines.length * 5 + 4;
  if (opts.clienteNome) {
    doc.setFontSize(10);
    doc.text(opts.clienteNome, PAPER_WIDTH_MM / 2, y, { align: 'center' });
    y += 5;
  }
  if (opts.clienteTelefone) {
    doc.setFontSize(10);
    doc.text('Tel.: ', MARGIN_MM, y);
    const w = doc.getTextWidth('Tel.: ');
    doc.text(opts.clienteTelefone, MARGIN_MM + w, y);
    y += 4;
  }
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [['Cod', 'Produto', 'Qtd', 'Valor unit.', 'Valor']],
    body: opts.itens.map((i) => [
      i.codigo,
      i.descricao,
      String(i.quantidade),
      (i.quantidade > 0 ? i.valor / i.quantidade : 0).toFixed(2),
      i.valor.toFixed(2),
    ]),
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    tableWidth: CONTENT_WIDTH,
    ...TABLE_STYLES,
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BLACK);
  doc.text('Subtotal:', MARGIN_MM, y);
  doc.text(`R$ ${opts.subtotal.toFixed(2)}`, VALORES_RIGHT_MM, y, { align: 'right' });
  y += 5;

  if (opts.pagamentosParciais?.length) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Pagamentos já realizados', MARGIN_MM, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
    for (const p of opts.pagamentosParciais) {
      const linha = `${p.forma_pagamento}: R$ ${p.valor.toFixed(2)}${p.nome_quem_pagou ? ` (${p.nome_quem_pagou})` : ''}${p.descricaoTipo ? ` – ${p.descricaoTipo}` : ''}`;
      doc.text(linha, MARGIN_MM, y);
      y += 5;
    }
    const totalJaPago = opts.pagamentosParciais.reduce((s, p) => s + p.valor, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Total já pago:', MARGIN_MM, y);
    doc.text(`R$ ${totalJaPago.toFixed(2)}`, VALORES_RIGHT_MM, y, { align: 'right' });
    y += 5;
    if (opts.restanteAPagar != null) {
      doc.text('Restante a pagar:', MARGIN_MM, y);
      doc.text(`R$ ${opts.restanteAPagar.toFixed(2)}`, VALORES_RIGHT_MM, y, { align: 'right' });
      y += 5;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    y += 4;
  }

  const linhasMesa: LinhaTotal[] = [];
  if (opts.valorCupom > 0 && opts.cupomCodigo) linhasMesa.push({ label: `Desconto cupom (${opts.cupomCodigo}):`, valor: `- R$ ${opts.valorCupom.toFixed(2)}` });
  if (opts.valorManual > 0) linhasMesa.push({ label: 'Desconto:', valor: `- R$ ${opts.valorManual.toFixed(2)}` });
  for (const linha of linhasMesa) {
    doc.text(linha.label, MARGIN_MM, y);
    doc.text(linha.valor, VALORES_RIGHT_MM, y, { align: 'right' });
    y += 5;
  }
  y += 2;
  doc.setDrawColor(0, 0, 0);
  doc.line(MARGIN_MM, y, PAPER_WIDTH_MM - MARGIN_MM, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const totalNaLinhaFinal = opts.restanteAPagar != null ? opts.restanteAPagar : opts.total;
  doc.text('TOTAL:', MARGIN_MM, y);
  doc.text(`R$ ${totalNaLinhaFinal.toFixed(2)}`, VALORES_RIGHT_MM, y, { align: 'right' });
  y += 12;

  y = await addPixQrCode(doc, y);
  addFooter(doc, y);
  openAndPrint(doc);
}

/** Conta do pedido viagem ou online. Para online: passar tipoEntrega e opcionalmente endereço, pagamento, etc. */
export async function printContaViagem(opts: {
  pedidoNumero: number;
  clienteNome: string;
  clienteTelefone?: string;
  itens: ItemConta[];
  subtotal: number;
  valorCupom: number;
  valorManual: number;
  total: number;
  cupomCodigo?: string;
  /** Para pedidos online: 'retirada' ou 'entrega' */
  tipoEntrega?: 'retirada' | 'entrega';
  clienteEndereco?: string;
  pontoReferencia?: string;
  formaPagamento?: string;
  trocoPara?: number;
}) {
  const doc = createDoc();
  let y = 10;
  doc.setTextColor(...BLACK);
  doc.setFontSize(14);
  doc.text('Lanchonete Terra e Mar', PAPER_WIDTH_MM / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BLACK);
  const tituloSuffix = opts.tipoEntrega ? (opts.tipoEntrega === 'retirada' ? 'RETIRADA' : 'ENTREGA') : 'VIAGEM';
  doc.text(`Pedido #${opts.pedidoNumero} - ${tituloSuffix}`, PAPER_WIDTH_MM / 2, y, { align: 'center' });
  y += 6;
  doc.text(`${opts.clienteNome}`, PAPER_WIDTH_MM / 2, y, { align: 'center' });

  y += 8;
  doc.setFontSize(10);
  if (opts.clienteTelefone) {
    doc.text('Tel.: ', MARGIN_MM, y);
    const w = doc.getTextWidth('Tel.: ');
    doc.text(opts.clienteTelefone, MARGIN_MM + w, y);
    y += 4;
  }
  if (opts.clienteEndereco) {
    const addrLines = doc.splitTextToSize(opts.clienteEndereco, CONTENT_WIDTH);
    doc.text(addrLines, MARGIN_MM, y);
    y += addrLines.length * 4 + 2;
  }
  if (opts.pontoReferencia) {
    doc.text(`Ref.: ${opts.pontoReferencia}`, MARGIN_MM, y);
    y += 4;
  }
  if (opts.formaPagamento) {
    let pag = opts.formaPagamento;
    if (opts.trocoPara != null && opts.trocoPara > 0 && String(opts.formaPagamento).toLowerCase().includes('dinheiro')) {
      pag += ` – Troco R$ ${opts.trocoPara.toFixed(2)}`;
    }
    doc.text(`Pagamento: ${pag}`, MARGIN_MM, y);
    y += 4;
  }
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [['Cod', 'Produto', 'Qtd', 'Valor unit.', 'Valor']],
    body: opts.itens.map((i) => [
      i.codigo,
      i.descricao,
      String(i.quantidade),
      (i.quantidade > 0 ? i.valor / i.quantidade : 0).toFixed(2),
      i.valor.toFixed(2),
    ]),
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    tableWidth: CONTENT_WIDTH,
    ...TABLE_STYLES,
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  const linhasViagem: LinhaTotal[] = [];
  if (opts.valorCupom > 0 && opts.cupomCodigo) linhasViagem.push({ label: `Desconto cupom (${opts.cupomCodigo}):`, valor: `- R$ ${opts.valorCupom.toFixed(2)}` });
  if (opts.valorManual > 0) linhasViagem.push({ label: 'Desconto:', valor: `- R$ ${opts.valorManual.toFixed(2)}` });
  y = addTotaisSection(doc, y, opts.subtotal, opts.total, linhasViagem);
  y = await addPixQrCode(doc, y);
  addFooter(doc, y);
  openAndPrint(doc);
}

/** Imprime um pedido (comanda) em qualquer contexto: mesa, viagem ou online. tituloSuffix ex.: "Mesa 2", "Viagem", "Entrega", "Retirada". */
export async function printPedido(
  pedido: {
    numero: number;
    cliente_nome?: string;
    cliente_whatsapp?: string;
    cliente_endereco?: string;
    ponto_referencia?: string;
    forma_pagamento?: string;
    troco_para?: number;
    observacoes?: string;
    desconto?: number;
    taxa_entrega?: number;
    comandas?: { nome_cliente?: string };
    pedido_itens?: Array<{
      quantidade: number;
      valor_unitario: number;
      observacao?: string;
      produtos?: { codigo?: string; nome?: string; descricao?: string };
    }>;
  },
  tituloSuffix: string
) {
  const doc = createDoc();
  let y = 10;
  doc.setTextColor(...BLACK);
  doc.setFontSize(14);
  doc.text('Lanchonete Terra e Mar', PAPER_WIDTH_MM / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BLACK);
  const titulo = `Pedido #${pedido.numero}${tituloSuffix ? ` - ${tituloSuffix}` : ''}`;
  const tituloLines = doc.splitTextToSize(titulo, CONTENT_WIDTH);
  doc.text(tituloLines, PAPER_WIDTH_MM / 2, y, { align: 'center' });
  y += tituloLines.length * 5 + 4;
  doc.setFontSize(10);
  const nomeCliente = pedido.cliente_nome || (pedido.comandas as { nome_cliente?: string } | undefined)?.nome_cliente;
  if (nomeCliente) {
    doc.setTextColor(...BLACK);
    doc.setFont('helvetica', 'bold');
    doc.text((nomeCliente || '').toUpperCase(), MARGIN_MM, y);
    doc.setFont('helvetica', 'normal');
    y += 5;
  }
  if (pedido.cliente_whatsapp) {
    doc.setTextColor(...BLACK);
    doc.text('Tel.: ', MARGIN_MM, y);
    const w = doc.getTextWidth('Tel.: ');
    doc.text(pedido.cliente_whatsapp, MARGIN_MM + w, y);
    y += 4;
  }
  if (pedido.cliente_endereco) {
    const addrLines = doc.splitTextToSize(pedido.cliente_endereco, CONTENT_WIDTH);
    doc.text(addrLines, MARGIN_MM, y);
    y += addrLines.length * 4 + 2;
  }
  if (pedido.ponto_referencia) {
    doc.text(`Ref: ${pedido.ponto_referencia}`, MARGIN_MM, y);
    y += 4;
  }
  if (pedido.forma_pagamento != null || pedido.troco_para != null) {
    doc.text(`Pagamento: ${pedido.forma_pagamento || '-'}${pedido.troco_para ? ` - Troco R$ ${Number(pedido.troco_para).toFixed(2)}` : ''}`, MARGIN_MM, y);
    y += 4;
  }
  if (pedido.observacoes) {
    const obsLines = doc.splitTextToSize(pedido.observacoes, CONTENT_WIDTH);
    doc.text(obsLines, MARGIN_MM, y);
    y += obsLines.length * 4 + 2;
  }
  y += 4;

  const itens = pedido.pedido_itens ?? [];
  const subtotal = itens.reduce((s, i) => s + (i.quantidade || 0) * Number(i.valor_unitario || 0), 0);
  const desconto = Number(pedido.desconto ?? 0);
  const taxa = Number(pedido.taxa_entrega ?? 0);
  const total = Math.max(0, subtotal - desconto + taxa);

  autoTable(doc, {
    startY: y,
    head: [['Cod', 'Produto', 'Qtd', 'Valor unit.', 'Valor']],
    body: itens.map((i) => {
      const qtd = i.quantidade || 0;
      const unit = Number(i.valor_unitario || 0);
      const valor = qtd * unit;
      return [
        (i.produtos?.codigo ?? '-'),
        `${(i.produtos?.nome || i.produtos?.descricao) ?? '-'}${i.observacao ? ` (${i.observacao})` : ''}`,
        String(qtd),
        (qtd > 0 ? valor / qtd : 0).toFixed(2),
        valor.toFixed(2),
      ];
    }),
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    tableWidth: CONTENT_WIDTH,
    ...TABLE_STYLES,
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  const linhasExtra: LinhaTotal[] = [];
  if (desconto > 0) linhasExtra.push({ label: 'Desconto:', valor: `- R$ ${desconto.toFixed(2)}` });
  if (taxa > 0) linhasExtra.push({ label: 'Taxa entrega:', valor: `R$ ${taxa.toFixed(2)}` });
  y = addTotaisSection(doc, y, subtotal, total, linhasExtra);
  y = await addPixQrCode(doc, y);
  addFooter(doc, y);
  openAndPrint(doc);
}

type PedidoParaImpressao = {
  numero: number;
  cliente_nome?: string;
  comandas?: { nome_cliente?: string };
  desconto?: number;
  taxa_entrega?: number;
  pedido_itens?: Array<{
    quantidade: number;
    valor_unitario: number;
    observacao?: string;
    produtos?: { codigo?: string; nome?: string; descricao?: string };
  }>;
};

/** Imprime vários pedidos em um único comprovante, unificados. tituloContexto ex.: "Mesa 2", "Viagem". */
export async function printPedidosUnificados(pedidos: PedidoParaImpressao[], tituloContexto: string) {
  if (pedidos.length === 0) return;
  const ordenados = [...pedidos].sort((a, b) => a.numero - b.numero);
  const numeros = ordenados.map((p) => p.numero).join(', #');
  const doc = createDoc();
  let y = 10;
  doc.setTextColor(...BLACK);
  doc.setFontSize(14);
  doc.text('Lanchonete Terra e Mar', PAPER_WIDTH_MM / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Pedidos unificados #${numeros}`, PAPER_WIDTH_MM / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(tituloContexto, PAPER_WIDTH_MM / 2, y, { align: 'center' });
  y += 6;
  const primeiro = ordenados[0];
  const nomeCliente = primeiro.cliente_nome || (primeiro.comandas as { nome_cliente?: string } | undefined)?.nome_cliente;
  if (nomeCliente) {
    doc.setFont('helvetica', 'bold');
    doc.text((nomeCliente || '').toUpperCase(), MARGIN_MM, y);
    doc.setFont('helvetica', 'normal');
    y += 5;
  }
  y += 4;

  let subtotalGeral = 0;
  let totalGeral = 0;

  for (const pedido of ordenados) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`--- Pedido #${pedido.numero} ---`, MARGIN_MM, y);
    doc.setFont('helvetica', 'normal');
    y += 6;

    const itens = pedido.pedido_itens ?? [];
    const subtotal = itens.reduce((s, i) => s + (i.quantidade || 0) * Number(i.valor_unitario || 0), 0);
    const desconto = Number(pedido.desconto ?? 0);
    const taxa = Number(pedido.taxa_entrega ?? 0);
    const total = Math.max(0, subtotal - desconto + taxa);
    subtotalGeral += subtotal;
    totalGeral += total;

    autoTable(doc, {
      startY: y,
      head: [['Cod', 'Produto', 'Qtd', 'Valor unit.', 'Valor']],
      body: itens.map((i) => {
        const qtd = i.quantidade || 0;
        const unit = Number(i.valor_unitario || 0);
        const valor = qtd * unit;
        return [
          (i.produtos?.codigo ?? '-'),
          `${(i.produtos?.nome || i.produtos?.descricao) ?? '-'}${i.observacao ? ` (${i.observacao})` : ''}`,
          String(qtd),
          (qtd > 0 ? valor / qtd : 0).toFixed(2),
          valor.toFixed(2),
        ];
      }),
      margin: { left: MARGIN_MM, right: MARGIN_MM },
      tableWidth: CONTENT_WIDTH,
      ...TABLE_STYLES,
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  }

  doc.setDrawColor(0, 0, 0);
  doc.line(MARGIN_MM, y, PAPER_WIDTH_MM - MARGIN_MM, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL GERAL:', MARGIN_MM, y);
  doc.text(`R$ ${totalGeral.toFixed(2)}`, VALORES_RIGHT_MM, y, { align: 'right' });
  y += 12;
  y = await addPixQrCode(doc, y);
  addFooter(doc, y);
  openAndPrint(doc);
}

/** Pedido para entrega/retirada (online). Mesmo esquema visual das impressões de mesa e viagem. */
export async function printPedidoEntrega(pedido: {
  numero: number;
  tipo_entrega?: 'entrega' | 'retirada';
  cliente_nome?: string;
  cliente_whatsapp?: string;
  cliente_endereco?: string;
  ponto_referencia?: string;
  forma_pagamento?: string;
  troco_para?: number;
  observacoes?: string;
  desconto?: number;
  taxa_entrega?: number;
  pedido_itens?: Array<{
    quantidade: number;
    valor_unitario: number;
    observacao?: string;
    produtos?: { codigo?: string; nome?: string; descricao?: string };
  }>;
}) {
  const doc = createDoc();
  let y = 10;
  doc.setTextColor(...BLACK);
  doc.setFontSize(14);
  doc.text('Lanchonete Terra e Mar', PAPER_WIDTH_MM / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BLACK);
  const tipoLabel = pedido.tipo_entrega === 'retirada' ? 'RETIRADA' : 'ENTREGA';
  const titulo = `Pedido #${pedido.numero} - ${tipoLabel}`;
  const tituloLines = doc.splitTextToSize(titulo, CONTENT_WIDTH);
  doc.text(tituloLines, PAPER_WIDTH_MM / 2, y, { align: 'center' });
  y += tituloLines.length * 5 + 4;
  doc.setFontSize(10);
  if (pedido.cliente_nome) {
    doc.setTextColor(...BLACK);
    doc.setFont('helvetica', 'bold');
    doc.text((pedido.cliente_nome || '').toUpperCase(), MARGIN_MM, y);
    doc.setFont('helvetica', 'normal');
    y += 5;
  }
  if (pedido.cliente_whatsapp) {
    doc.setTextColor(...BLACK);
    doc.text('Tel.: ', MARGIN_MM, y);
    const w = doc.getTextWidth('Tel.: ');
    doc.text(pedido.cliente_whatsapp, MARGIN_MM + w, y);
    y += 4;
  }
  if (pedido.cliente_endereco) {
    const addrLines = doc.splitTextToSize(pedido.cliente_endereco, CONTENT_WIDTH);
    doc.text(addrLines, MARGIN_MM, y);
    y += addrLines.length * 4 + 2;
  }
  if (pedido.ponto_referencia) {
    doc.text(`Ref: ${pedido.ponto_referencia}`, MARGIN_MM, y);
    y += 4;
  }
  doc.text(`Pagamento: ${pedido.forma_pagamento || '-'}${pedido.troco_para ? ` - Troco R$ ${Number(pedido.troco_para).toFixed(2)}` : ''}`, MARGIN_MM, y);
  y += 4;
  if (pedido.observacoes) {
    const obsLines = doc.splitTextToSize(pedido.observacoes, CONTENT_WIDTH);
    doc.text(obsLines, MARGIN_MM, y);
    y += obsLines.length * 4 + 2;
  }
  y += 4;

  const itens = pedido.pedido_itens ?? [];
  const subtotal = itens.reduce((s, i) => s + (i.quantidade || 0) * Number(i.valor_unitario || 0), 0);
  const desconto = Number(pedido.desconto ?? 0);
  const taxa = Number(pedido.taxa_entrega ?? 0);
  const total = Math.max(0, subtotal - desconto + taxa);

  autoTable(doc, {
    startY: y,
    head: [['Cod', 'Produto', 'Qtd', 'Valor unit.', 'Valor']],
    body: itens.map((i) => {
      const qtd = i.quantidade || 0;
      const unit = Number(i.valor_unitario || 0);
      const valor = qtd * unit;
      return [
        (i.produtos?.codigo ?? '-'),
        `${(i.produtos?.nome || i.produtos?.descricao) ?? '-'}${i.observacao ? ` (${i.observacao})` : ''}`,
        String(qtd),
        (qtd > 0 ? valor / qtd : 0).toFixed(2),
        valor.toFixed(2),
      ];
    }),
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    tableWidth: CONTENT_WIDTH,
    ...TABLE_STYLES,
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  const linhasEntrega: LinhaTotal[] = [];
  if (desconto > 0) linhasEntrega.push({ label: 'Desconto:', valor: `- R$ ${desconto.toFixed(2)}` });
  if (taxa > 0) linhasEntrega.push({ label: 'Taxa entrega:', valor: `R$ ${taxa.toFixed(2)}` });
  y = addTotaisSection(doc, y, subtotal, total, linhasEntrega);
  y = await addPixQrCode(doc, y);
  addFooter(doc, y);
  openAndPrint(doc);
}
