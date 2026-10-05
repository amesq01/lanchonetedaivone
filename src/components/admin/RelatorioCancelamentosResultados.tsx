import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const TIMEZONE_BR = 'America/Sao_Paulo';

export type ItemCancelamento = {
  id: string;
  numero?: string | number | null;
  origem?: string | null;
  cancelado_em?: string | null;
  atendente_nome?: string | null;
  cancelado_por_nome?: string | null;
  motivo_cancelamento?: string | null;
};

export function gerarPdfRelatorioCancelamentos({
  tituloPeriodo,
  itens,
}: {
  tituloPeriodo: string;
  itens: ItemCancelamento[];
}) {
  const doc = new jsPDF();
  const titulo = `Relatório de cancelamentos - ${tituloPeriodo}`;
  doc.setFontSize(14);
  doc.text(titulo, 105, 15, { align: 'center' });
  doc.setFontSize(10);
  doc.text('Período em horário de Brasília', 105, 22, { align: 'center' });

  autoTable(doc, {
    startY: 28,
    head: [['Data/hora', 'Pedido #', 'Origem', 'Atendente (realizou)', 'Quem cancelou', 'Motivo']],
    body: itens.map((p) => [
      p.cancelado_em ? new Date(p.cancelado_em).toLocaleString('pt-BR', { timeZone: TIMEZONE_BR }) : '-',
      String(p.numero ?? '-'),
      String(p.origem ?? '-'),
      String(p.atendente_nome ?? '-'),
      String(p.cancelado_por_nome ?? '-'),
      String(p.motivo_cancelamento ?? '-'),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [245, 245, 245], textColor: 20 },
  });

  doc.save(`relatorio-cancelamentos-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function RelatorioCancelamentosResultados({
  tituloPeriodo,
  itens,
  totalAnterior,
}: {
  tituloPeriodo: string;
  itens: ItemCancelamento[];
  totalAnterior: number;
}) {
  const variacaoCancelamentos =
    totalAnterior > 0
      ? ((itens.length - totalAnterior) / totalAnterior) * 100
      : totalAnterior === 0 && itens.length > 0
        ? 100
        : null;

  return (
    <div>
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-amber-800">Comparação com período anterior</h2>
        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-stone-500">Período selecionado</p>
            <p className="font-semibold text-stone-800">{tituloPeriodo}</p>
            <p className="text-stone-700">{itens.length} cancelamentos</p>
          </div>
          <div>
            <p className="text-stone-500">Intervalo anterior (mesma duração)</p>
            <p className="text-stone-700">{totalAnterior} cancelamentos</p>
          </div>
          <div>
            <p className="text-stone-500">Variação</p>
            {variacaoCancelamentos != null && (
              <p className={`font-medium ${variacaoCancelamentos >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                {variacaoCancelamentos >= 0 ? '+' : ''}
                {variacaoCancelamentos.toFixed(1)}%
              </p>
            )}
          </div>
        </div>
      </div>
      <p className="mb-4 text-sm text-stone-500">
        Período: <strong>{tituloPeriodo}</strong> (horário de Brasília)
      </p>
      <div className="overflow-x-auto overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Data/hora</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Pedido #</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Origem</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Atendente (realizou)</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Quem cancelou</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((p) => (
              <tr key={p.id} className="border-b border-stone-100">
                <td className="px-4 py-2 text-sm">
                  {p.cancelado_em ? new Date(p.cancelado_em).toLocaleString('pt-BR') : '-'}
                </td>
                <td className="px-4 py-2">{p.numero}</td>
                <td className="px-4 py-2 text-sm">{p.origem}</td>
                <td className="px-4 py-2 text-sm">{p.atendente_nome ?? '-'}</td>
                <td className="px-4 py-2 text-sm">{p.cancelado_por_nome ?? '-'}</td>
                <td className="px-4 py-2 max-w-xs text-sm">{p.motivo_cancelamento ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {itens.length === 0 && (
          <p className="p-4 text-center text-stone-500">Nenhum cancelamento no período.</p>
        )}
      </div>
    </div>
  );
}
