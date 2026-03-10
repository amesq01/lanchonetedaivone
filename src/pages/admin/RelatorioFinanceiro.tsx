import { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getRelatorioFinanceiro } from '../../lib/api';

const TIMEZONE_BR = 'America/Sao_Paulo';

/** Retorna início e fim do período em UTC (meia-noite a meia-noite em Brasília, UTC-3). Formato para o backend: "YYYY-MM-DD HH:mm:ss". */
function periodoParaUTC(periodo: 'dia' | 'mes' | 'ano', dataRef: string): { desde: string; ate: string } {
  const fmt = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
  if (periodo === 'dia') {
    const [y, m, d] = dataRef.slice(0, 10).split('-').map(Number);
    const desde = fmt(new Date(Date.UTC(y, m - 1, d, 3, 0, 0, 0)));
    const ate = fmt(new Date(Date.UTC(y, m - 1, d + 1, 3, 0, 0, 0)));
    return { desde, ate };
  }
  if (periodo === 'mes') {
    const [y, m] = dataRef.slice(0, 7).split('-').map(Number);
    const desde = fmt(new Date(Date.UTC(y, m - 1, 1, 3, 0, 0, 0)));
    const ate = fmt(new Date(Date.UTC(y, m, 1, 3, 0, 0, 0)));
    return { desde, ate };
  }
  const y = Number(dataRef.slice(0, 4));
  const desde = fmt(new Date(Date.UTC(y, 0, 1, 3, 0, 0, 0)));
  const ate = fmt(new Date(Date.UTC(y + 1, 0, 1, 3, 0, 0, 0)));
  return { desde, ate };
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

type Periodo = 'dia' | 'mes' | 'ano';

export default function RelatorioFinanceiro() {
  const [periodo, setPeriodo] = useState<Periodo>('dia');
  const [dataRef, setDataRef] = useState(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE_BR })
  );
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [totalGeral, setTotalGeral] = useState(0);
  const [totalPorFormaPagamento, setTotalPorFormaPagamento] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [filtroAtendente, setFiltroAtendente] = useState<string>('');

  useEffect(() => {
    const { desde, ate } = periodoParaUTC(periodo, dataRef);
    setLoading(true);
    getRelatorioFinanceiro(desde, ate)
      .then((r) => {
        setPedidos(r.pedidos);
        setTotalGeral(r.totalGeral);
        setTotalPorFormaPagamento(r.totalPorFormaPagamento ?? {});
      })
      .finally(() => setLoading(false));
  }, [periodo, dataRef]);

  const tituloPeriodo =
    periodo === 'dia'
      ? new Date(dataRef.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
      : periodo === 'mes'
        ? new Date(dataRef.slice(0, 7) + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        : dataRef.slice(0, 4);

  const pedidosFiltrados = useMemo(
    () => (filtroAtendente ? pedidos.filter((p) => p.atendente_nome === filtroAtendente) : pedidos),
    [pedidos, filtroAtendente],
  );

  const totalGeralView = useMemo(
    () => (pedidosFiltrados.length ? pedidosFiltrados.reduce((s, p) => s + Number(p.total ?? 0), 0) : totalGeral),
    [pedidosFiltrados, totalGeral],
  );

  const totalPorFormaPagamentoView = useMemo(() => {
    if (!pedidosFiltrados.length) return totalPorFormaPagamento;
    const mapa: Record<string, number> = {};
    for (const p of pedidosFiltrados) {
      const forma = p.forma_pagamento ?? '-';
      mapa[forma] = (mapa[forma] ?? 0) + Number(p.total ?? 0);
    }
    return mapa;
  }, [pedidosFiltrados, totalPorFormaPagamento]);

  const atendentesDisponiveis = useMemo(
    () =>
      Array.from(
        new Set(
          pedidos
            .map((p) => p.atendente_nome as string | null)
            .filter((n): n is string => !!n && n.trim().length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [pedidos],
  );

  const handleGerarPdf = () => {
    const doc = new jsPDF();
    const titulo = `Relatório financeiro - ${tituloPeriodo}`;
    doc.setFontSize(14);
    doc.text(titulo, 105, 15, { align: 'center' });
    doc.setFontSize(10);
    let subtitulo = 'Período em horário de Brasília';
    if (filtroAtendente) subtitulo += ` | Atendente: ${filtroAtendente}`;
    doc.text(subtitulo, 105, 22, { align: 'center' });

    const corpo = pedidosFiltrados.length ? pedidosFiltrados : pedidos;
    autoTable(doc, {
      startY: 28,
      head: [
        ['Data', 'Pedido', 'Origem', 'Cliente', 'Mesa', 'Atendente', 'Pagamento', 'Subtotal', 'Taxa', 'Desconto', 'Total'],
      ],
      body: corpo.map((p) => [
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
    doc.setFontSize(11);
    doc.text(`Total do período: R$ ${totalGeralView.toFixed(2)}`, 14, y);
    y += 6;
    const formasEntries = Object.entries(totalPorFormaPagamentoView);
    if (formasEntries.length) {
      doc.setFontSize(10);
      doc.text('Total por forma de pagamento:', 14, y);
      y += 5;
      formasEntries
        .sort(([, a], [, b]) => b - a)
        .forEach(([forma, valor]) => {
          doc.text(`${forma}: R$ ${valor.toFixed(2)}`, 18, y);
          y += 4;
        });
    }

    doc.save(`relatorio-financeiro-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-4">Relatório financeiro</h1>
      <div className="mb-6 flex flex-wrap items-end gap-6">
        <div className="flex gap-2">
          {(['dia', 'mes', 'ano'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setPeriodo(t)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                periodo === t ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              {t === 'dia' ? 'Diário' : t === 'mes' ? 'Mensal' : 'Anual'}
            </button>
          ))}
        </div>
        {periodo === 'dia' && (
          <div>
            <label className="block text-sm font-medium text-stone-600">Data</label>
            <input
              type="date"
              value={dataRef.slice(0, 10)}
              onChange={(e) => setDataRef(e.target.value)}
              className="mt-1 rounded-lg border border-stone-300 px-3 py-2"
            />
          </div>
        )}
        {periodo === 'mes' && (
          <div>
            <label className="block text-sm font-medium text-stone-600">Mês</label>
            <input
              type="month"
              value={dataRef.slice(0, 7)}
              onChange={(e) => setDataRef(e.target.value + '-01')}
              className="mt-1 rounded-lg border border-stone-300 px-3 py-2"
            />
          </div>
        )}
        {periodo === 'ano' && (
          <div>
            <label className="block text-sm font-medium text-stone-600">Ano</label>
            <input
              type="number"
              min={2020}
              max={2030}
              value={dataRef.slice(0, 4)}
              onChange={(e) => setDataRef(e.target.value + '-01-01')}
              className="mt-1 w-24 rounded-lg border border-stone-300 px-3 py-2"
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-stone-600">Atendente</label>
          <select
            value={filtroAtendente}
            onChange={(e) => setFiltroAtendente(e.target.value)}
            className="mt-1 rounded-lg border border-stone-300 px-3 py-2 min-w-[180px]"
          >
            <option value="">Todos</option>
            {atendentesDisponiveis.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleGerarPdf}
          className="ml-auto inline-flex items-center rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          Gerar PDF
        </button>
      </div>
      <p className="text-sm text-stone-500 mb-4">
        Período: <strong>{tituloPeriodo}</strong> (horário de Brasília)
      </p>
      {loading ? (
        <p className="text-stone-500">Carregando...</p>
      ) : (
        <>
          <div className="rounded-xl bg-white shadow-sm overflow-hidden mb-4">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-200">
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
                {pedidosFiltrados.map((p) => (
                  <tr key={p.id} className="border-b border-stone-100">
                    <td className="px-4 py-2 text-sm">{formatarDataBR(p.encerrado_em)}</td>
                    <td className="px-4 py-2">{p.numero}</td>
                    <td className="px-4 py-2 text-sm">{p.origem}</td>
                    <td className="px-4 py-2 text-sm">{p.cliente_nome ?? '-'}</td>
                    <td className="px-4 py-2 text-sm">{p.mesa ?? '-'}</td>
                    <td className="px-4 py-2 text-sm">{p.atendente_nome ?? '-'}</td>
                    <td className="px-4 py-2 text-sm">{p.forma_pagamento ?? '-'}</td>
                    <td className="px-4 py-2 text-right text-sm">R$ {Number(p.subtotal ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-sm">{Number(p.taxa ?? 0) > 0 ? `R$ ${Number(p.taxa).toFixed(2)}` : '-'}</td>
                    <td className="px-4 py-2 text-right text-sm">{Number(p.desconto ?? 0) > 0 ? `R$ ${Number(p.desconto).toFixed(2)}` : '-'}</td>
                    <td className="px-4 py-2 text-right font-medium">R$ {Number(p.total ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-lg font-semibold text-stone-800 mb-4">
            Total do período: R$ {totalGeralView.toFixed(2)}
          </div>
          {Object.keys(totalPorFormaPagamentoView).length > 0 && (
            <div className="rounded-xl bg-stone-50 border border-stone-200 p-4">
              <h3 className="font-semibold text-stone-700 mb-2">Total por forma de pagamento</h3>
              <ul className="space-y-1 text-sm">
                {Object.entries(totalPorFormaPagamentoView)
                  .sort(([, a], [, b]) => b - a)
                  .map(([forma, valor]) => (
                    <li key={forma} className="flex justify-between">
                      <span className="text-stone-600">{forma}</span>
                      <span className="font-medium text-stone-800">R$ {valor.toFixed(2)}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
