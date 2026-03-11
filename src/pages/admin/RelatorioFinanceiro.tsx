import { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getRelatorioFinanceiro } from '../../lib/api';

const TIMEZONE_BR = 'America/Sao_Paulo';

/** Converte "YYYY-MM-DDTHH:mm" (Brasília) para UTC "YYYY-MM-DD HH:mm:ss". */
function datetimeLocalBrToUTC(dt: string): string {
  if (!dt || dt.length < 16) return '';
  const [datePart, timePart] = dt.split('T');
  const [y, m, d] = datePart.slice(0, 10).split('-').map(Number);
  const [hh = 0, mm = 0] = (timePart || '00:00').split(':').map(Number);
  const brAsUTC = new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0));
  const utc = new Date(brAsUTC.getTime() + 3 * 60 * 60 * 1000);
  return utc.toISOString().slice(0, 19).replace('T', ' ');
}

function getHojeBr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE_BR });
}

function presetDia(): { desde: string; ate: string } {
  const hoje = getHojeBr();
  return { desde: hoje + 'T00:00', ate: hoje + 'T23:59' };
}

function presetMes(): { desde: string; ate: string } {
  const hoje = getHojeBr();
  const [y, m] = hoje.slice(0, 7).split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const lastStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { desde: `${hoje.slice(0, 7)}-01T00:00`, ate: `${lastStr}T23:59` };
}

function presetAno(): { desde: string; ate: string } {
  const y = new Date().getFullYear();
  return { desde: `${y}-01-01T00:00`, ate: `${y}-12-31T23:59` };
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

function agregarPorFormaPagamento(pedidos: any[]): Record<string, number> {
  const mapa: Record<string, number> = {};
  const normalizarForma = (s: string): string => {
    const t = s.toLowerCase().trim();
    if (t.startsWith('pix')) return 'pix';
    if (t.startsWith('dinheiro')) return 'dinheiro';
    if (t.startsWith('cartão crédito') || t.startsWith('cartao credito')) return 'cartão crédito';
    if (t.startsWith('cartão débito') || t.startsWith('cartao debito')) return 'cartão débito';
    return s.trim() || '-';
  };
  for (const p of pedidos) {
    const fpRaw = String(p.forma_pagamento ?? '').trim();
    const totalPedido = Number(p.total ?? 0);
    if (!fpRaw) {
      mapa['-'] = (mapa['-'] ?? 0) + totalPedido;
      continue;
    }
    const partes = fpRaw.split(','); // pode ter múltiplas formas no mesmo texto
    let teveValorFracionado = false;
    for (const parteRaw of partes) {
      const parte = parteRaw.trim();
      if (!parte) continue;
      const valorMatch = parte.match(/R\$\s*([\d.,]+)/);
      if (!valorMatch) continue;
      // Os valores que geramos não têm separador de milhar, apenas ponto como decimal (ex.: 209.93)
      // Então basta trocar vírgula por ponto e fazer Number.
      const valor = Number(valorMatch[1].replace(',', '.'));
      if (!Number.isFinite(valor)) continue;
      teveValorFracionado = true;
      // forma é o trecho antes de "R$"
      const idx = parte.toLowerCase().indexOf('r$');
      const formaTexto = idx > 0 ? parte.slice(0, idx).trim() : parte;
      const forma = normalizarForma(formaTexto);
      mapa[forma] = (mapa[forma] ?? 0) + valor;
    }
    // Caso antigo: coluna pagamento só tem o nome da forma (ex.: "pix") sem valores "R$".
    // Nesse caso, consideramos que o valor total do pedido foi pago naquela forma única.
    if (!teveValorFracionado) {
      const forma = normalizarForma(fpRaw);
      mapa[forma] = (mapa[forma] ?? 0) + totalPedido;
    }
  }
  return mapa;
}

export default function RelatorioFinanceiro() {
  const [desdeDateTime, setDesdeDateTime] = useState(() => presetDia().desde);
  const [ateDateTime, setAteDateTime] = useState(() => presetDia().ate);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [totalGeral, setTotalGeral] = useState(0);
  const [totalPorFormaPagamento, setTotalPorFormaPagamento] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [filtroAtendente, setFiltroAtendente] = useState<string>('');
  const [compararDados, setCompararDados] = useState<{ totalGeral: number; totalPedidos: number } | null>(null);
  const [compararLoading, setCompararLoading] = useState(false);

  useEffect(() => {
    setCompararDados(null);
  }, [desdeDateTime, ateDateTime]);

  const handleComparar = () => {
    const desde = datetimeLocalBrToUTC(desdeDateTime);
    const ate = datetimeLocalBrToUTC(ateDateTime);
    if (!desde || !ate) return;
    setLoading(true);
    setCompararLoading(true);
    const desdeMs = new Date(desde.replace(' ', 'T') + 'Z').getTime();
    const ateMs = new Date(ate.replace(' ', 'T') + 'Z').getTime();
    const duracaoMs = ateMs - desdeMs;
    const ate2Ms = desdeMs - 1;
    const desde2Ms = ate2Ms - duracaoMs;
    const desde2 = new Date(desde2Ms).toISOString().slice(0, 19).replace('T', ' ');
    const ate2 = new Date(ate2Ms).toISOString().slice(0, 19).replace('T', ' ');
    Promise.all([
      getRelatorioFinanceiro(desde, ate),
      getRelatorioFinanceiro(desde2, ate2),
    ])
      .then(([r1, r2]) => {
        setPedidos(r1.pedidos);
        setTotalGeral(r1.totalGeral);
        setTotalPorFormaPagamento(r1.totalPorFormaPagamento ?? {});
        setCompararDados({ totalGeral: r2.totalGeral, totalPedidos: r2.pedidos.length });
      })
      .finally(() => {
        setLoading(false);
        setCompararLoading(false);
      });
  };

  const tituloPeriodo =
    desdeDateTime && ateDateTime
      ? `${new Date(desdeDateTime.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })} ${desdeDateTime.slice(11, 16)} – ${new Date(ateDateTime.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })} ${ateDateTime.slice(11, 16)}`
      : '—';

  const variacaoTotal =
    compararDados && compararDados.totalGeral > 0
      ? ((totalGeral - compararDados.totalGeral) / compararDados.totalGeral) * 100
      : null;
  const variacaoPedidos =
    compararDados && compararDados.totalPedidos > 0
      ? ((pedidos.length - compararDados.totalPedidos) / compararDados.totalPedidos) * 100
      : null;

  const pedidosFiltrados = useMemo(
    () => (filtroAtendente ? pedidos.filter((p) => p.atendente_nome === filtroAtendente) : pedidos),
    [pedidos, filtroAtendente],
  );

  const totalGeralView = useMemo(
    () => (pedidosFiltrados.length ? pedidosFiltrados.reduce((s, p) => s + Number(p.total ?? 0), 0) : totalGeral),
    [pedidosFiltrados, totalGeral],
  );

  const totalPorFormaPagamentoView = useMemo(() => {
    // Sem filtro de atendente: usa o agregado confiável vindo do backend
    if (!filtroAtendente) return totalPorFormaPagamento;
    // Com filtro de atendente: re-agrega a partir das descrições de forma_pagamento
    return agregarPorFormaPagamento(pedidosFiltrados);
  }, [filtroAtendente, pedidosFiltrados, totalPorFormaPagamento]);

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

  const rankingAtendentes = useMemo(() => {
    const porAtendente: Record<string, number> = {};
    for (const p of pedidosFiltrados) {
      const nome = (p.atendente_nome ?? '-').trim() || '-';
      porAtendente[nome] = (porAtendente[nome] ?? 0) + Number(p.total ?? 0);
    }
    return Object.entries(porAtendente)
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [pedidosFiltrados]);

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
      y += 4;
    }
    if (rankingAtendentes.length > 0) {
      doc.setFontSize(10);
      doc.text('Ranking por atendente:', 14, y);
      y += 5;
      rankingAtendentes.forEach((item, i) => {
        doc.text(`${i + 1}º ${item.nome}: R$ ${item.valor.toFixed(2)}`, 18, y);
        y += 4;
      });
    }

    doc.save(`relatorio-financeiro-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-4">Relatório financeiro</h1>
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const { desde, ate } = presetDia();
                setDesdeDateTime(desde);
                setAteDateTime(ate);
              }}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              Diário
            </button>
            <button
              type="button"
              onClick={() => {
                const { desde, ate } = presetMes();
                setDesdeDateTime(desde);
                setAteDateTime(ate);
              }}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => {
                const { desde, ate } = presetAno();
                setDesdeDateTime(desde);
                setAteDateTime(ate);
              }}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              Anual
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">De</label>
            <input
              type="datetime-local"
              value={desdeDateTime}
              onChange={(e) => setDesdeDateTime(e.target.value)}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Até</label>
            <input
              type="datetime-local"
              value={ateDateTime}
              onChange={(e) => setAteDateTime(e.target.value)}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Atendente</label>
            <select
              value={filtroAtendente}
              onChange={(e) => setFiltroAtendente(e.target.value)}
              className="rounded-lg border border-stone-300 px-3 py-2 min-w-[180px]"
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
            onClick={handleComparar}
            disabled={compararLoading}
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            {compararLoading ? 'Buscando...' : 'Comparar'}
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <button
            type="button"
            onClick={handleGerarPdf}
            className="ml-auto inline-flex items-center rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Gerar PDF
          </button>
        </div>
      </div>
      {compararDados && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-4 shadow-sm">
          <h2 className="text-sm font-medium text-amber-800 mb-3">Comparação com período anterior</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-stone-500">Período selecionado</p>
              <p className="font-semibold text-stone-800">{tituloPeriodo}</p>
              <p className="text-stone-700">{pedidos.length} pedidos · R$ {totalGeral.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-stone-500">Período anterior (mesma duração)</p>
              <p className="text-stone-700">{compararDados.totalPedidos} pedidos · R$ {compararDados.totalGeral.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-stone-500">Variação</p>
              {variacaoPedidos != null && (
                <p className={`font-medium ${variacaoPedidos >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  Pedidos: {variacaoPedidos >= 0 ? '+' : ''}{variacaoPedidos.toFixed(1)}%
                </p>
              )}
              {variacaoTotal != null && (
                <p className={`font-medium ${variacaoTotal >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  Total: {variacaoTotal >= 0 ? '+' : ''}{variacaoTotal.toFixed(1)}%
                </p>
              )}
            </div>
          </div>
        </div>
      )}
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
            <div className="rounded-xl bg-stone-50 border border-stone-200 p-4 mb-4">
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
          {rankingAtendentes.length > 0 && (
            <div className="rounded-xl bg-stone-50 border border-stone-200 p-4">
              <h3 className="font-semibold text-stone-700 mb-2">Ranking por atendente</h3>
              <ul className="space-y-1 text-sm">
                {rankingAtendentes.map((item, i) => (
                  <li key={item.nome} className="flex justify-between items-center">
                    <span className="text-stone-600">
                      {i + 1}º {item.nome}
                    </span>
                    <span className="font-medium text-stone-800">R$ {item.valor.toFixed(2)}</span>
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
