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

const TABLE_STYLES = {
  headStyles: {
    fontStyle: 'bold' as const,
    fontSize: 9,
    textColor: BLACK,
    halign: 'center' as const,
    fillColor: false,
    lineWidth: { top: 0, right: 0, bottom: 0.2, left: 0 },
  },
  bodyStyles: { fontSize: 9, textColor: BLACK, fillColor: false },
  alternateRowStyles: { fillColor: false },
  columnStyles: {
    0: { cellWidth: 10, halign: 'center' as const },
    1: { cellWidth: 22, halign: 'center' as const },
    2: { cellWidth: 12, halign: 'center' as const },
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
  doc.text(`R$ ${subtotal.toFixed(2)}`, PAPER_WIDTH_MM - MARGIN_MM, y, { align: 'right' });
  y += 5;
  for (const linha of linhasMeio) {
    doc.text(linha.label, MARGIN_MM, y);
    doc.text(linha.valor, PAPER_WIDTH_MM - MARGIN_MM, y, { align: 'right' });
    y += 5;
  }
  y += 2;
  doc.setDrawColor(0, 0, 0);
  doc.line(MARGIN_MM, y, PAPER_WIDTH_MM - MARGIN_MM, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL:', MARGIN_MM, y);
  doc.text(`R$ ${total.toFixed(2)}`, PAPER_WIDTH_MM - MARGIN_MM, y, { align: 'right' });
  return y + 12;
}

/** Conta da mesa (presencial). */
export function printContaMesa(opts: {
  titulo: string;
  clienteTelefone?: string;
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
  y += tituloLines.length * 5 + 4;
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

  const linhasMesa: LinhaTotal[] = [];
  if (opts.valorCupom > 0 && opts.cupomCodigo) linhasMesa.push({ label: `Desconto cupom (${opts.cupomCodigo}):`, valor: `- R$ ${opts.valorCupom.toFixed(2)}` });
  if (opts.valorManual > 0) linhasMesa.push({ label: 'Desconto:', valor: `- R$ ${opts.valorManual.toFixed(2)}` });
  y = addTotaisSection(doc, y, opts.subtotal, opts.total, linhasMesa);
  addFooter(doc, y);
  openAndPrint(doc);
}

/** Conta do pedido viagem. */
export function printContaViagem(opts: {
  pedidoNumero: number;
  clienteNome: string;
  clienteTelefone?: string;
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
  y += 8;
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

  const linhasViagem: LinhaTotal[] = [];
  if (opts.valorCupom > 0 && opts.cupomCodigo) linhasViagem.push({ label: `Desconto cupom (${opts.cupomCodigo}):`, valor: `- R$ ${opts.valorCupom.toFixed(2)}` });
  if (opts.valorManual > 0) linhasViagem.push({ label: 'Desconto:', valor: `- R$ ${opts.valorManual.toFixed(2)}` });
  y = addTotaisSection(doc, y, opts.subtotal, opts.total, linhasViagem);
  addFooter(doc, y);
  openAndPrint(doc);
}

/** Pedido para entrega (online). Mesmo esquema visual das impressões de mesa e viagem. */
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
  doc.setFontSize(14);
  doc.text('Lanchonete Terra e Mar', PAPER_WIDTH_MM / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BLACK);
  const titulo = `Pedido #${pedido.numero} - ENTREGA - ${pedido.cliente_nome || '-'}`;
  const tituloLines = doc.splitTextToSize(titulo, CONTENT_WIDTH);
  doc.text(tituloLines, PAPER_WIDTH_MM / 2, y, { align: 'center' });
  y += tituloLines.length * 5 + 4;
  doc.setFontSize(10);
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
  addFooter(doc, y);
  openAndPrint(doc);
}
