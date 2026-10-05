import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ProdutividadePorCategoria } from '../../lib/api';
import type { PedidoRelatorioFinanceiro } from './RelatorioFinanceiroResultados';

export function categoriasVisiveisProdutividade(porCategoria: ProdutividadePorCategoria[]) {
  return porCategoria.filter((cat) => cat.categoriaNome.toUpperCase() !== 'PROMOÇÕES');
}

export function rankingAtendentesDePedidos(pedidos: PedidoRelatorioFinanceiro[]) {
  const porAtendente: Record<string, number> = {};
  for (const p of pedidos) {
    const nome = (p.atendente_nome ?? '-').trim() || '-';
    porAtendente[nome] = (porAtendente[nome] ?? 0) + Number(p.total ?? 0);
  }
  return Object.entries(porAtendente)
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor);
}

export function gerarPdfProdutividade({
  tituloPeriodo,
  totalPedidos,
  totalPedidosAnterior,
  variacaoPedidos,
  categorias,
  rankingAtendentes,
}: {
  tituloPeriodo: string;
  totalPedidos: number;
  totalPedidosAnterior: number;
  variacaoPedidos: number | null;
  categorias: ProdutividadePorCategoria[];
  rankingAtendentes: { nome: string; valor: number }[];
}) {
  const doc = new jsPDF();
  const titulo = `Produtividade - ${tituloPeriodo}`;
  doc.setFontSize(14);
  doc.text(titulo, 105, 15, { align: 'center' });
  doc.setFontSize(10);
  doc.text('Período em horário de Brasília', 105, 22, { align: 'center' });

  let y = 30;
  doc.setFontSize(11);
  doc.text(`Total de pedidos: ${totalPedidos}`, 14, y);
  y += 6;
  doc.text(
    `Intervalo anterior: ${totalPedidosAnterior} | Variação: ${variacaoPedidos != null ? `${variacaoPedidos.toFixed(1)}%` : '-'}`,
    14,
    y
  );
  y += 6;

  const linhasProdutos: Array<[string, string, string, string, string]> = [];
  for (const cat of categorias) {
    for (const prod of cat.produtos) {
      linhasProdutos.push([
        cat.categoriaNome,
        prod.nome,
        String(prod.quantidade),
        String(prod.online),
        String(prod.naCasa),
      ]);
    }
    if (cat.produtos.length === 0) {
      linhasProdutos.push([cat.categoriaNome, '—', '0', '0', '0']);
    }
  }

  if (linhasProdutos.length) {
    autoTable(doc, {
      startY: y,
      head: [['Categoria', 'Produto', 'Qtd.', 'Online', 'Na casa']],
      body: linhasProdutos,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [245, 245, 245], textColor: 20 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (rankingAtendentes.length) {
    autoTable(doc, {
      startY: y,
      head: [['Posição', 'Atendente', 'Total (R$)']],
      body: rankingAtendentes.map((r, i) => [`${i + 1}º`, r.nome, `R$ ${r.valor.toFixed(2)}`]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [245, 245, 245], textColor: 20 },
    });
  }

  doc.save(`produtividade-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function ProdutividadeResultados({
  tituloPeriodo,
  totalPedidos,
  totalPedidosAnterior,
  porCategoria,
  pedidosParaRanking,
}: {
  tituloPeriodo: string;
  totalPedidos: number;
  totalPedidosAnterior: number;
  porCategoria: ProdutividadePorCategoria[];
  pedidosParaRanking: PedidoRelatorioFinanceiro[];
}) {
  const [accordionAbertos, setAccordionAbertos] = useState<Set<string>>(new Set());
  const [filtroAtendente, setFiltroAtendente] = useState('');

  const categoriasVisiveis = useMemo(
    () => categoriasVisiveisProdutividade(porCategoria),
    [porCategoria]
  );

  const pedidosFiltradosParaRanking = useMemo(
    () =>
      filtroAtendente
        ? pedidosParaRanking.filter((p) => p.atendente_nome === filtroAtendente)
        : pedidosParaRanking,
    [pedidosParaRanking, filtroAtendente]
  );

  const atendentesDisponiveis = useMemo(
    () =>
      Array.from(
        new Set(
          pedidosParaRanking
            .map((p) => p.atendente_nome)
            .filter((n): n is string => !!n && n.trim().length > 0)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [pedidosParaRanking]
  );

  const rankingAtendentes = useMemo(
    () => rankingAtendentesDePedidos(pedidosFiltradosParaRanking),
    [pedidosFiltradosParaRanking]
  );

  const variacaoPedidos =
    totalPedidosAnterior > 0 ? ((totalPedidos - totalPedidosAnterior) / totalPedidosAnterior) * 100 : null;

  const toggleAccordion = (categoriaId: string) => {
    setAccordionAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(categoriaId)) next.delete(categoriaId);
      else next.add(categoriaId);
      return next;
    });
  };

  return (
    <div>
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-stone-600">Atendente</label>
        <select
          value={filtroAtendente}
          onChange={(e) => setFiltroAtendente(e.target.value)}
          className="min-w-[180px] rounded-lg border border-stone-300 px-3 py-2"
        >
          <option value="">Todos</option>
          {atendentesDisponiveis.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-amber-800">Comparação com período anterior</h2>
        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-stone-500">Período selecionado</p>
            <p className="font-semibold text-stone-800">{tituloPeriodo}</p>
            <p className="text-lg font-bold text-stone-800">{totalPedidos} pedidos</p>
          </div>
          <div>
            <p className="text-stone-500">Intervalo anterior (mesma duração)</p>
            <p className="font-semibold text-stone-800">Intervalo anterior (mesma duração)</p>
            <p className="text-lg font-bold text-stone-800">{totalPedidosAnterior} pedidos</p>
          </div>
          <div>
            <p className="text-stone-500">Variação</p>
            {variacaoPedidos != null ? (
              <p className={`text-lg font-bold ${variacaoPedidos >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {variacaoPedidos >= 0 ? '+' : ''}
                {variacaoPedidos.toFixed(1)}%
              </p>
            ) : (
              <p className="text-stone-500">—</p>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-medium text-stone-600">Total de pedidos realizados</h2>
        <p className="text-2xl font-bold text-stone-800">{totalPedidos}</p>
        <p className="mt-1 text-xs text-stone-500">
          Período: {tituloPeriodo}. Mesmo critério do Rel. Financeiro: pedidos finalizados com encerramento no período.
        </p>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-stone-800">Produtos mais vendidos por categoria</h2>
      <div className="space-y-2">
        {categoriasVisiveis.map((cat) => {
          const aberto = accordionAbertos.has(cat.categoriaId);
          return (
            <div key={cat.categoriaId} className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => toggleAccordion(cat.categoriaId)}
                className="flex w-full items-center gap-2 border-b border-stone-200 bg-stone-50 px-4 py-3 text-left font-medium text-stone-800 transition-colors hover:bg-stone-100"
              >
                {aberto ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-stone-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-stone-500" />
                )}
                {cat.categoriaNome}
                {cat.produtos.length > 0 && (
                  <span className="ml-1 text-sm font-normal text-stone-500">
                    ({cat.produtos.length} {cat.produtos.length === 1 ? 'produto' : 'produtos'})
                  </span>
                )}
              </button>
              {aberto &&
                (cat.produtos.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-stone-500">Nenhuma venda no período.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[280px]">
                      <thead className="border-b border-stone-200 bg-stone-50/80">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-stone-600">Produto</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-stone-600">Quantidade</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-stone-600">Online</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-stone-600">Na casa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cat.produtos.map((prod) => (
                          <tr key={prod.produtoId} className="border-b border-stone-100 last:border-0">
                            <td className="px-4 py-2 text-sm text-stone-800">{prod.nome}</td>
                            <td className="px-4 py-2 text-right text-sm text-stone-600">{prod.quantidade}</td>
                            <td className="px-4 py-2 text-right text-sm text-stone-600">{prod.online}</td>
                            <td className="px-4 py-2 text-right text-sm text-stone-600">{prod.naCasa}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
            </div>
          );
        })}
      </div>

      {pedidosParaRanking.length > 0 && (
        <div className="mt-8 rounded-xl border border-stone-200 bg-stone-50 p-4">
          <h3 className="mb-3 font-semibold text-stone-700">Ranking por atendente</h3>
          {rankingAtendentes.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {rankingAtendentes.map((item, i) => (
                <li key={item.nome} className="flex items-center justify-between">
                  <span className="text-stone-600">
                    {i + 1}º {item.nome}
                  </span>
                  <span className="font-medium text-stone-800">R$ {item.valor.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">Nenhum atendente no período selecionado.</p>
          )}
        </div>
      )}
    </div>
  );
}
