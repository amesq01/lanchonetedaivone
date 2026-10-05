import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { labelFormaPagamentoSaida } from '../../lib/api';

const TIMEZONE_BR = 'America/Sao_Paulo';
const CATEGORIAS_DEDUCAO = ['GELO', 'ENTREGADORES'] as const;

export type PedidoRelatorioFinanceiro = {
  id: string;
  numero: string | number;
  origem: string;
  encerrado_em: string | null;
  cliente_nome?: string | null;
  mesa?: string | null;
  atendente_nome?: string | null;
  forma_pagamento?: string | null;
  subtotal?: number;
  taxa?: number;
  desconto?: number;
  total?: number;
};

export type CompararFinanceiro = {
  totalGeral: number;
  totalPedidos: number;
};

export type SaidaRelatorioFinanceiro = {
  categoria_nome: string;
  valor: number;
  forma_pagamento?: string | null;
  descricao?: string | null;
};

function chaveCategoriaDeducao(nome: string): (typeof CATEGORIAS_DEDUCAO)[number] | null {
  const n = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
  if (n === 'GELO') return 'GELO';
  if (n === 'ENTREGADORES' || n === 'ENTREGADOR') return 'ENTREGADORES';
  return null;
}

function chaveFormaPagamento(forma: string | null | undefined): string {
  const t = String(forma ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '-';
  if (t.startsWith('pix')) return 'pix';
  if (t.startsWith('dinheiro')) return 'dinheiro';
  if (t.includes('debito')) return 'débito';
  if (t.includes('credito')) return 'crédito';
  return t;
}

function labelFormaExibicao(chave: string): string {
  if (chave === '-') return '-';
  return labelFormaPagamentoSaida(chave);
}

function rotuloSaida(nome: string, descricao?: string | null): string {
  const desc = descricao?.trim();
  return desc ? `${nome} — ${desc}` : nome;
}

export function saidasDeducaoPeriodo(saidas: SaidaRelatorioFinanceiro[]): SaidaRelatorioFinanceiro[] {
  return saidas.filter((s) => chaveCategoriaDeducao(s.categoria_nome));
}

export function linhasDeducao(saidas: SaidaRelatorioFinanceiro[]): { nome: string; descricao: string | null; rotulo: string; total: number }[] {
  const ordem = new Map(CATEGORIAS_DEDUCAO.map((c, i) => [c, i]));
  return saidasDeducaoPeriodo(saidas)
    .map((s) => {
      const nome = chaveCategoriaDeducao(s.categoria_nome) ?? s.categoria_nome;
      const descricao = s.descricao?.trim() || null;
      return {
        nome,
        descricao,
        rotulo: rotuloSaida(nome, descricao),
        total: Number(s.valor ?? 0),
      };
    })
    .sort((a, b) => (ordem.get(a.nome as (typeof CATEGORIAS_DEDUCAO)[number]) ?? 99) - (ordem.get(b.nome as (typeof CATEGORIAS_DEDUCAO)[number]) ?? 99));
}

type DeducaoPorForma = {
  chave: string;
  label: string;
  vendas: number;
  saidas: { rotulo: string; total: number }[];
  restante: number;
};

export function resumoPorFormaComDeducao(
  totalPorFormaPagamento: Record<string, number>,
  saidas: SaidaRelatorioFinanceiro[]
): DeducaoPorForma[] {
  const vendasPorChave: Record<string, number> = {};
  const labelPorChave: Record<string, string> = {};
  for (const [forma, valor] of Object.entries(totalPorFormaPagamento)) {
    const chave = chaveFormaPagamento(forma);
    vendasPorChave[chave] = (vendasPorChave[chave] ?? 0) + valor;
    if (!labelPorChave[chave]) labelPorChave[chave] = forma;
  }

  const saidasPorChave: Record<string, { rotulo: string; total: number }[]> = {};
  for (const s of saidasDeducaoPeriodo(saidas)) {
    const chave = chaveFormaPagamento(s.forma_pagamento);
    const cat = chaveCategoriaDeducao(s.categoria_nome);
    if (!cat) continue;
    if (!saidasPorChave[chave]) saidasPorChave[chave] = [];
    saidasPorChave[chave].push({
      rotulo: rotuloSaida(cat, s.descricao),
      total: Number(s.valor ?? 0),
    });
    if (!labelPorChave[chave]) labelPorChave[chave] = labelFormaExibicao(chave);
  }

  const chaves = [...new Set([...Object.keys(vendasPorChave), ...Object.keys(saidasPorChave)])];
  return chaves
    .map((chave) => {
      const vendas = vendasPorChave[chave] ?? 0;
      const saidasLinha = saidasPorChave[chave] ?? [];
      const totalSaidas = saidasLinha.reduce((s, x) => s + x.total, 0);
      return {
        chave,
        label: labelPorChave[chave] ?? labelFormaExibicao(chave),
        vendas,
        saidas: saidasLinha,
        restante: vendas - totalSaidas,
      };
    })
    .sort((a, b) => b.vendas - a.vendas);
}

function formatarDataBR(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: TIMEZONE_BR,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function gerarPdfRelatorioFinanceiro({
  tituloPeriodo,
  pedidos,
  totalGeral,
  totalPorFormaPagamento,
  saidas = [],
}: {
  tituloPeriodo: string;
  pedidos: PedidoRelatorioFinanceiro[];
  totalGeral: number;
  totalPorFormaPagamento: Record<string, number>;
  saidas?: SaidaRelatorioFinanceiro[];
}) {
  const doc = new jsPDF();
  const titulo = `Relatório financeiro - ${tituloPeriodo}`;
  doc.setFontSize(14);
  doc.text(titulo, 105, 15, { align: 'center' });
  doc.setFontSize(10);
  doc.text('Período em horário de Brasília', 105, 22, { align: 'center' });

  autoTable(doc, {
    startY: 28,
    head: [
      ['Data', 'Pedido', 'Origem', 'Cliente', 'Mesa', 'Atendente', 'Pagamento', 'Subtotal', 'Taxa', 'Desconto', 'Total'],
    ],
    body: pedidos.map((p) => [
      formatarDataBR(p.encerrado_em),
      String(p.numero),
      p.origem,
      p.cliente_nome ?? '-',
      p.mesa ?? '-',
      p.atendente_nome ?? '-',
      p.forma_pagamento ?? '-',
      `R$ ${Number(p.subtotal ?? 0).toFixed(2)}`,
      Number(p.taxa ?? 0) > 0 ? `R$ ${Number(p.taxa).toFixed(2)}` : '-',
      Number(p.desconto ?? 0) > 0 ? `R$ ${Number(p.desconto).toFixed(2)}` : '-',
      `R$ ${Number(p.total ?? 0).toFixed(2)}`,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [245, 245, 245], textColor: 20 },
  });

  let y = (doc as any).lastAutoTable.finalY + 6;
  const deducoes = linhasDeducao(saidas);
  const totalSaidas = deducoes.reduce((s, x) => s + x.total, 0);
  doc.setFontSize(11);
  doc.text(`Total de Vendas do Período: R$ ${totalGeral.toFixed(2)}`, 14, y);
  y += 6;
  if (deducoes.length) {
    doc.setFontSize(10);
    for (const d of deducoes) {
      doc.text(`${d.rotulo}: - R$ ${d.total.toFixed(2)}`, 14, y);
      y += 5;
    }
    doc.setFontSize(11);
    doc.text(`Total geral do período: R$ ${(totalGeral - totalSaidas).toFixed(2)}`, 14, y);
    y += 6;
  }
  const formas = resumoPorFormaComDeducao(totalPorFormaPagamento, saidas);
  if (formas.length) {
    doc.setFontSize(10);
    doc.text('Total por forma de pagamento:', 14, y);
    y += 5;
    formas.forEach((forma) => {
      doc.text(`${forma.label}: R$ ${forma.vendas.toFixed(2)}`, 18, y);
      y += 4;
      for (const s of forma.saidas) {
        doc.text(`${s.rotulo}: - R$ ${s.total.toFixed(2)}`, 22, y);
        y += 4;
      }
      if (forma.saidas.length) {
        doc.text(`Restante: R$ ${forma.restante.toFixed(2)}`, 22, y);
        y += 5;
      }
    });
  }

  doc.save(`relatorio-financeiro-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function RelatorioFinanceiroResultados({
  tituloPeriodo,
  pedidos,
  totalGeral,
  totalPorFormaPagamento,
  compararDados,
  saidas = [],
}: {
  tituloPeriodo: string;
  pedidos: PedidoRelatorioFinanceiro[];
  totalGeral: number;
  totalPorFormaPagamento: Record<string, number>;
  compararDados: CompararFinanceiro;
  saidas?: SaidaRelatorioFinanceiro[];
}) {
  const variacaoTotal =
    compararDados.totalGeral > 0 ? ((totalGeral - compararDados.totalGeral) / compararDados.totalGeral) * 100 : null;
  const variacaoPedidos =
    compararDados.totalPedidos > 0
      ? ((pedidos.length - compararDados.totalPedidos) / compararDados.totalPedidos) * 100
      : null;

  const deducoes = linhasDeducao(saidas);
  const totalSaidasDeducao = deducoes.reduce((s, x) => s + x.total, 0);
  const totalGeralPeriodo = totalGeral - totalSaidasDeducao;
  const formas = resumoPorFormaComDeducao(totalPorFormaPagamento, saidas);

  return (
    <div>
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-amber-800">Comparação com período anterior</h2>
        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-stone-500">Período selecionado</p>
            <p className="font-semibold text-stone-800">{tituloPeriodo}</p>
            <p className="text-stone-700">
              {pedidos.length} pedidos · R$ {totalGeral.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-stone-500">Intervalo anterior (mesma duração)</p>
            <p className="text-stone-700">
              {compararDados.totalPedidos} pedidos · R$ {compararDados.totalGeral.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-stone-500">Variação</p>
            {variacaoPedidos != null && (
              <p className={`font-medium ${variacaoPedidos >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                Pedidos: {variacaoPedidos >= 0 ? '+' : ''}
                {variacaoPedidos.toFixed(1)}%
              </p>
            )}
            {variacaoTotal != null && (
              <p className={`font-medium ${variacaoTotal >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                Total: {variacaoTotal >= 0 ? '+' : ''}
                {variacaoTotal.toFixed(1)}%
              </p>
            )}
          </div>
        </div>
      </div>
      <p className="mb-4 text-sm text-stone-500">
        Período: <strong>{tituloPeriodo}</strong> (horário de Brasília)
      </p>
      <div className="mb-4 space-y-1 text-right">
        <div className="text-lg font-semibold text-stone-800">
          Total de Vendas do Período: R$ {totalGeral.toFixed(2)}
        </div>
        {deducoes.map((d, i) => (
          <div key={`${d.nome}-${i}`} className="text-sm font-medium text-red-700">
            {d.rotulo}: - R$ {d.total.toFixed(2)}
          </div>
        ))}
        {deducoes.length > 0 && (
          <div className="text-lg font-semibold text-stone-800">
            Total geral do período: R$ {totalGeralPeriodo.toFixed(2)}
          </div>
        )}
      </div>
      {formas.length > 0 && (
        <div className="mb-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
          <h3 className="mb-2 font-semibold text-stone-700">Total por forma de pagamento</h3>
          <ul className="space-y-3 text-sm">
            {formas.map((forma) => (
              <li key={forma.chave}>
                <div className="flex justify-between">
                  <span className="text-stone-600">{forma.label}</span>
                  <span className="font-medium text-stone-800">R$ {forma.vendas.toFixed(2)}</span>
                </div>
                {forma.saidas.map((s, i) => (
                  <div key={`${forma.chave}-${i}`} className="mt-0.5 flex justify-between gap-4 text-red-700">
                    <span className="pl-3">{s.rotulo}</span>
                    <span className="shrink-0">- R$ {s.total.toFixed(2)}</span>
                  </div>
                ))}
                {forma.saidas.length > 0 && (
                  <div className="mt-0.5 flex justify-between font-medium text-stone-800">
                    <span className="pl-3">Restante</span>
                    <span>R$ {forma.restante.toFixed(2)}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="overflow-x-auto overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Data</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Pedido</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Origem</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Cliente</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Mesa</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Atendente</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Pagamento</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-stone-600">Subtotal</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-stone-600">Taxa</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-stone-600">Desconto</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-stone-600">Total</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id} className="border-b border-stone-100">
                <td className="px-4 py-2 text-sm">{formatarDataBR(p.encerrado_em)}</td>
                <td className="px-4 py-2">{p.numero}</td>
                <td className="px-4 py-2 text-sm">{p.origem}</td>
                <td className="px-4 py-2 text-sm">{p.cliente_nome ?? '-'}</td>
                <td className="px-4 py-2 text-sm">{p.mesa ?? '-'}</td>
                <td className="px-4 py-2 text-sm">{p.atendente_nome ?? '-'}</td>
                <td className="px-4 py-2 text-sm">{p.forma_pagamento ?? '-'}</td>
                <td className="px-4 py-2 text-right text-sm">R$ {Number(p.subtotal ?? 0).toFixed(2)}</td>
                <td className="px-4 py-2 text-right text-sm">
                  {Number(p.taxa ?? 0) > 0 ? `R$ ${Number(p.taxa).toFixed(2)}` : '-'}
                </td>
                <td className="px-4 py-2 text-right text-sm">
                  {Number(p.desconto ?? 0) > 0 ? `R$ ${Number(p.desconto).toFixed(2)}` : '-'}
                </td>
                <td className="px-4 py-2 text-right font-medium">R$ {Number(p.total ?? 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
