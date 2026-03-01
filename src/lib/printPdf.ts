import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const PAPER_WIDTH_MM = 80;
const MARGIN_MM = 3;
const CONTENT_WIDTH = PAPER_WIDTH_MM - MARGIN_MM * 2;

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

/** Conta da mesa (presencial). */
export function printContaMesa(opts: {
  titulo: string;
  itens: ItemConta[];
  subtotal: number;
  valorCupom: number;
  valorManual: number;
  total: number;
  cupomCodigo?: string;
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
  y += tituloLines.length * 5 + 6;

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
    headStyles: {
      fontStyle: 'bold',
      fontSize: 9,
      textColor: BLACK,
      halign: 'center',
      fillColor: false,
      lineWidth: { top: 0, right: 0, bottom: 0.2, left: 0 },
    },
    bodyStyles: { fontSize: 9, textColor: BLACK, fillColor: false },
    alternateRowStyles: { fillColor: false },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 22 },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 14 },
      4: { cellWidth: 14 },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text(`Subtotal: R$ ${opts.subtotal.toFixed(2)}`, MARGIN_MM, y);
  y += 5;
  if (opts.valorCupom > 0 && opts.cupomCodigo) {
    doc.text(`Desconto cupom (${opts.cupomCodigo}): - ${opts.valorCupom.toFixed(2)}`, MARGIN_MM, y);
    y += 5;
  }
  if (opts.valorManual > 0) {
    doc.text(`Desconto: - ${opts.valorManual.toFixed(2)}`, MARGIN_MM, y);
    y += 5;
  }
  doc.setFontSize(12);
  doc.text(`TOTAL: R$ ${opts.total.toFixed(2)}`, MARGIN_MM, y + 2);
  y += 12;
  addFooter(doc, y);
  openAndPrint(doc);
}

/** Conta do pedido viagem. */
export function printContaViagem(opts: {
  pedidoNumero: number;
  clienteNome: string;
  itens: ItemConta[];
  subtotal: number;
  valorCupom: number;
  valorManual: number;
  total: number;
  cupomCodigo?: string;
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
  doc.text(`Pedido #${opts.pedidoNumero} - VIAGEM - ${opts.clienteNome}`, PAPER_WIDTH_MM / 2, y, { align: 'center' });
  y += 10;

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
    headStyles: {
      fontStyle: 'bold',
      fontSize: 9,
      textColor: BLACK,
      halign: 'center',
      fillColor: false,
      lineWidth: { top: 0, right: 0, bottom: 0.2, left: 0 },
    },
    bodyStyles: { fontSize: 9, textColor: BLACK, fillColor: false },
    alternateRowStyles: { fillColor: false },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 22 },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 14 },
      4: { cellWidth: 14 },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text(`Subtotal: R$ ${opts.subtotal.toFixed(2)}`, MARGIN_MM, y);
  y += 5;
  if (opts.valorCupom > 0 && opts.cupomCodigo) {
    doc.text(`Desconto cupom (${opts.cupomCodigo}): - ${opts.valorCupom.toFixed(2)}`, MARGIN_MM, y);
    y += 5;
  }
  if (opts.valorManual > 0) {
    doc.text(`Desconto: - ${opts.valorManual.toFixed(2)}`, MARGIN_MM, y);
    y += 5;
  }
  doc.setFontSize(12);
  doc.text(`TOTAL: R$ ${opts.total.toFixed(2)}`, MARGIN_MM, y + 2);
  y += 12;
  addFooter(doc, y);
  openAndPrint(doc);
}

/** Pedido para entrega (online). */
export function printPedidoEntrega(pedido: {
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
  doc.setFontSize(13);
  doc.text(`Pedido para entrega #${pedido.numero}`, PAPER_WIDTH_MM / 2, y, { align: 'center' });
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  if (pedido.cliente_nome) {
    doc.text(pedido.cliente_nome, MARGIN_MM, y);
    y += 5;
  }
  if (pedido.cliente_whatsapp) {
    doc.text(pedido.cliente_whatsapp, MARGIN_MM, y);
    y += 5;
  }
  if (pedido.cliente_endereco) {
    const addrLines = doc.splitTextToSize(pedido.cliente_endereco, CONTENT_WIDTH);
    doc.text(addrLines, MARGIN_MM, y);
    y += addrLines.length * 4 + 2;
  }
  if (pedido.ponto_referencia) {
    doc.text(`Ref: ${pedido.ponto_referencia}`, MARGIN_MM, y);
    y += 5;
  }
  doc.text(`Pagamento: ${pedido.forma_pagamento || '-'}${pedido.troco_para ? ` - Troco ${Number(pedido.troco_para).toFixed(2)}` : ''}`, MARGIN_MM, y);
  y += 5;
  if (pedido.observacoes) {
    doc.text(pedido.observacoes, MARGIN_MM, y);
    y += 6;
  }
  y += 4;

  const itens = pedido.pedido_itens ?? [];
  const subtotal = itens.reduce((s, i) => s + (i.quantidade || 0) * Number(i.valor_unitario || 0), 0);
  const desconto = Number(pedido.desconto ?? 0);
  const taxa = Number(pedido.taxa_entrega ?? 0);
  const total = Math.max(0, subtotal - desconto + taxa);

  autoTable(doc, {
    startY: y,
    head: [['Cod', 'Produto', 'Qtd', 'Valor']],
    body: itens.map((i) => [
      (i.produtos?.codigo ?? '-'),
      `${(i.produtos?.nome || i.produtos?.descricao) ?? '-'}${i.observacao ? ` (${i.observacao})` : ''}`,
      String(i.quantidade),
      ((i.quantidade || 0) * Number(i.valor_unitario || 0)).toFixed(2),
    ]),
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    tableWidth: CONTENT_WIDTH,
    headStyles: {
      fontStyle: 'bold',
      fontSize: 9,
      textColor: BLACK,
      halign: 'center',
      fillColor: false,
      lineWidth: { top: 0, right: 0, bottom: 0.2, left: 0 },
    },
    bodyStyles: { fontSize: 9, textColor: BLACK, fillColor: false },
    alternateRowStyles: { fillColor: false },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 24 },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 18 },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text(`Subtotal: R$ ${subtotal.toFixed(2)}`, MARGIN_MM, y);
  y += 4;
  if (desconto > 0) {
    doc.text(`Desconto: - ${desconto.toFixed(2)}`, MARGIN_MM, y);
    y += 4;
  }
  if (taxa > 0) {
    doc.text(`Taxa entrega: ${taxa.toFixed(2)}`, MARGIN_MM, y);
    y += 4;
  }
  doc.setFontSize(12);
  doc.text(`TOTAL: R$ ${total.toFixed(2)}`, MARGIN_MM, y + 2);
  y += 10;
  addFooter(doc, y);
  openAndPrint(doc);
}
