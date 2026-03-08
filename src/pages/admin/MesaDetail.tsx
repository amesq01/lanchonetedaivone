import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getComandaByMesa, getComandaWithPedidos, getTotalComanda, closeComanda, getMesas, updatePedidoStatus, updatePedidoItens, getProdutos, getCuponsAtivos, applyDescontoComanda, clearDescontoComanda } from '../../lib/api';
import { printContaMesa } from '../../lib/printPdf';
import { useAuth } from '../../contexts/AuthContext';
import type { Comanda } from '../../types/database';
import type { Cupom } from '../../types/database';
import type { Produto } from '../../types/database';
import { precoVenda, imagensProduto } from '../../types/database';

export default function AdminMesaDetail() {
  const { mesaId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [comanda, setComanda] = useState<Comanda | null>(null);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [mesaNome, setMesaNome] = useState('');
  const [isMesaViagem, setIsMesaViagem] = useState(false);
  const [loading, setLoading] = useState(true);
  const [popupPagamento, setPopupPagamento] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState('');
  const [contaItens, setContaItens] = useState<{ itens: { codigo: string; descricao: string; quantidade: number; valor: number }[]; total: number } | null>(null);
  const [popupImprimir, setPopupImprimir] = useState(false);
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [cupomDesconto, setCupomDesconto] = useState<string>('');
  const [descontoManual, setDescontoManual] = useState('');
  const [popupCancelar, setPopupCancelar] = useState<{ pedidoId: string } | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [popupPedidosNaoFinalizados, setPopupPedidosNaoFinalizados] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [popupEditar, setPopupEditar] = useState<any | null>(null);
  const [carrinhoEdicao, setCarrinhoEdicao] = useState<{ produto: Produto; quantidade: number; observacao: string }[]>([]);
  const [searchEdicao, setSearchEdicao] = useState('');
  const [enviandoEdicao, setEnviandoEdicao] = useState(false);

  useEffect(() => {
    if (!mesaId) return;
    getMesas().then((mesas) => {
      const m = mesas.find((x) => x.id === mesaId);
      setMesaNome(m?.nome ?? '');
      setIsMesaViagem(m?.is_viagem ?? false);
    });
    getComandaByMesa(mesaId).then((c) => {
      setComanda(c);
      if (c) {
        getComandaWithPedidos(c.id).then((r) => {
          if (r) {
            setComanda(r.comanda as Comanda); // r.comanda traz profiles(nome) para exibir atendente
            setPedidos(r.pedidos);
          } else {
            setPedidos([]);
          }
          getTotalComanda(c.id).then(setContaItens);
        });
      }
      setLoading(false);
    });
    getCuponsAtivos().then(setCupons);
    getProdutos(true).then(setProdutos);
  }, [mesaId]);

  const handleAbrirImprimir = () => setPopupImprimir(true);

  const handleImprimirConta = async () => {
    setPopupImprimir(false);
    if (!comanda) return;
    if (valorDesconto > 0) {
      await applyDescontoComanda(comanda.id, cupomSelecionado?.id ?? null, valorDesconto);
    } else {
      await clearDescontoComanda(comanda.id);
    }
    const contaAtual = await getTotalComanda(comanda.id);
    setContaItens(contaAtual);
    const numeros = pedidos.filter((p) => p.status !== 'cancelado').map((p) => p.numero);
    const nomeCliente = comanda.nome_cliente || '';
    const titulo =
      isMesaViagem
        ? numeros.length === 0
          ? `${mesaNome} - ${nomeCliente}`
          : numeros.length === 1
            ? `Pedido #${numeros[0]} - ${mesaNome} - ${nomeCliente}`
            : `Pedidos ${numeros.map((n) => `#${n}`).join(', ')} - ${mesaNome} - ${nomeCliente}`
        : numeros.length === 0
          ? mesaNome
          : numeros.length === 1
            ? `Pedido #${numeros[0]} - ${mesaNome}`
            : `Pedidos ${numeros.map((n) => `#${n}`).join(', ')} - ${mesaNome}`;
    const sub = contaAtual?.total ?? 0;
    let vCupom = cupomSelecionado ? (sub * Number(cupomSelecionado.porcentagem)) / 100 : 0;
    if (cupomSelecionado?.valor_maximo != null) vCupom = Math.min(vCupom, Number(cupomSelecionado.valor_maximo));
    const vManual = Math.max(0, Number(descontoManual) || 0);
    const desc = Math.min(sub, vCupom + vManual);
    const totalFinal = sub - desc;
    type ItemConta = { codigo: string; descricao: string; quantidade: number; valor: number };
    const itens: ItemConta[] = contaAtual
      ? isMesaViagem
        ? contaAtual.itens
        : (() => {
            const map = new Map<string, ItemConta>();
            for (const i of contaAtual.itens) {
              const key = `${i.codigo}|${i.descricao}`;
              const exist = map.get(key);
              if (exist) {
                exist.quantidade += i.quantidade;
                exist.valor += i.valor;
              } else map.set(key, { ...i });
            }
            return Array.from(map.values());
          })()
      : [];
    await printContaMesa({
      titulo,
      clienteNome: isMesaViagem ? undefined : (comanda.nome_cliente || undefined),
      itens,
      subtotal: sub,
      valorCupom: vCupom,
      valorManual: vManual,
      total: totalFinal,
      cupomCodigo: cupomSelecionado?.codigo,
    });
  };

  const handleEncerrar = async () => {
    if (!comanda) return;
    const naoCancelados = pedidos.filter((p) => p.status !== 'cancelado');
    const naoFinalizados = naoCancelados.filter((p) => p.status !== 'finalizado');
    const soItensNaoCozinha = naoFinalizados.filter((p) => {
      const itens = p.pedido_itens ?? [];
      if (itens.length === 0) return false;
      return itens.every((i: any) => i.produtos?.vai_para_cozinha === false);
    });
    for (const p of soItensNaoCozinha) {
      await updatePedidoStatus(p.id, 'finalizado');
    }
    let listaParaCheck = pedidos;
    if (soItensNaoCozinha.length > 0) {
      const r = await getComandaWithPedidos(comanda.id);
      listaParaCheck = r?.pedidos ?? pedidos;
      setPedidos(listaParaCheck);
    }
    const pedidosAtivos = listaParaCheck.filter((p) => p.status !== 'cancelado');
    const todosFinalizados = pedidosAtivos.length === 0 || pedidosAtivos.every((p) => p.status === 'finalizado');
    if (!todosFinalizados) {
      setPopupPedidosNaoFinalizados(true);
      return;
    }
    setPopupPagamento(true);
  };

  const confirmarEncerramento = async () => {
    if (!comanda || !formaPagamento) return;
    await closeComanda(comanda.id, formaPagamento);
    setPopupPagamento(false);
    navigate('/admin/mesas');
  };

  const confirmarCancelarPedido = async () => {
    if (!popupCancelar || !motivoCancelamento.trim()) return;
    await updatePedidoStatus(popupCancelar.pedidoId, 'cancelado', {
      motivo_cancelamento: motivoCancelamento.trim(),
      cancelado_por: profile?.id,
    });
    setPopupCancelar(null);
    setMotivoCancelamento('');
    if (comanda) {
      getComandaWithPedidos(comanda.id).then((r) => setPedidos(r?.pedidos ?? []));
      getTotalComanda(comanda.id).then(setContaItens);
    }
  };

  const addItemEdicao = (produto: Produto, qtd = 1, obs = '') => {
    setCarrinhoEdicao((c) => {
      const exist = c.find((i) => i.produto.id === produto.id && i.observacao === obs);
      if (exist) return c.map((i) => i.produto.id === produto.id && i.observacao === obs ? { ...i, quantidade: i.quantidade + qtd } : i);
      return [...c, { produto, quantidade: qtd, observacao: obs }];
    });
  };
  const updateQtdEdicao = (index: number, delta: number) => {
    setCarrinhoEdicao((c) => {
      const novo = c.map((item, i) => (i === index ? { ...item, quantidade: Math.max(0, item.quantidade + delta) } : item));
      return novo.filter((i) => i.quantidade > 0);
    });
  };
  const setObsEdicao = (index: number, value: string) => {
    setCarrinhoEdicao((c) => c.map((item, i) => (i === index ? { ...item, observacao: value } : item)));
  };
  const salvarEdicao = async () => {
    if (!popupEditar || !comanda || carrinhoEdicao.length === 0) return;
    setEnviandoEdicao(true);
    try {
      const itens = carrinhoEdicao.map((i) => ({
        produto_id: i.produto.id,
        quantidade: i.quantidade,
        valor_unitario: precoVenda(i.produto),
        observacao: i.observacao || undefined,
      }));
      await updatePedidoItens(popupEditar.id, itens);
      setPopupEditar(null);
      getComandaWithPedidos(comanda.id).then((r) => { if (r) { setComanda(r.comanda as Comanda); setPedidos(r.pedidos); } });
      getTotalComanda(comanda.id).then(setContaItens);
    } finally {
      setEnviandoEdicao(false);
    }
  };
  const sEdicao = (searchEdicao || '').trim().toLowerCase();
  const filtradosEdicao = sEdicao ? produtos.filter((p) => (p.codigo?.toLowerCase().includes(sEdicao) || (p.nome ?? '').toLowerCase().includes(sEdicao) || (p.descricao ?? '').toLowerCase().includes(sEdicao))) : [];

  if (loading) return <p className="text-stone-500">Carregando...</p>;
  if (!comanda) return <p className="text-stone-500">Mesa não está aberta.</p>;

  const formas = ['dinheiro', 'pix', 'cartão crédito', 'cartão débito'];
  const pedidosNaMesa = pedidos.filter((p) => p.status !== 'cancelado');
  const cupomSelecionado = cupomDesconto ? cupons.find((c) => c.id === cupomDesconto) : null;
  const subtotal = contaItens?.total ?? 0;
  let valorCupom = cupomSelecionado ? (subtotal * Number(cupomSelecionado.porcentagem)) / 100 : 0;
  if (cupomSelecionado?.valor_maximo != null) valorCupom = Math.min(valorCupom, Number(cupomSelecionado.valor_maximo));
  const valorManual = Math.max(0, Number(descontoManual) || 0);
  const valorDesconto = Math.min(subtotal, valorCupom + valorManual);
  const totalComDesconto = subtotal - valorDesconto;

  function totalPedido(p: any) {
    const sub = (p.pedido_itens ?? []).reduce((s: number, i: any) => s + (i.quantidade || 0) * Number(i.valor_unitario || 0), 0);
    return (Number.isFinite(sub) ? sub : 0);
  }

  function pedidoTemItemParaCozinha(p: any) {
    return (p.pedido_itens ?? []).some((i: any) => Boolean(i.produtos?.vai_para_cozinha));
  }

  /** Unifica itens iguais (mesmo código e descrição) somando quantidade e valor. Usado na conta da mesa (exceto viagem). */
  type ItemConta = { codigo: string; descricao: string; quantidade: number; valor: number };
  const itensParaExibir: ItemConta[] = contaItens
    ? isMesaViagem
      ? contaItens.itens
      : (() => {
          const map = new Map<string, ItemConta>();
          for (const i of contaItens.itens) {
            const key = `${i.codigo}|${i.descricao}`;
            const exist = map.get(key);
            if (exist) {
              exist.quantidade += i.quantidade;
              exist.valor += i.valor;
            } else map.set(key, { ...i });
          }
          return Array.from(map.values());
        })()
    : [];

  return (
    <div className="no-print">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">{mesaNome}</h1>
          <p className="text-stone-600">Cliente: {comanda.nome_cliente}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleAbrirImprimir} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-700 hover:bg-stone-50">
            Imprimir conta
          </button>
          <button onClick={handleEncerrar} className="rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700">
            Encerrar mesa
          </button>
        </div>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm mb-6">
        <h3 className="font-semibold text-stone-800 mb-2">Pedidos</h3>
        {pedidosNaMesa.length === 0 ? (
          <p className="text-sm text-stone-500 py-2">Nenhum pedido nesta mesa.</p>
        ) : (
          <div className="space-y-4">
            {pedidosNaMesa.map((p) => (
              <div key={p.id} className="rounded-lg border border-stone-200 bg-stone-50/50 p-4 flex flex-wrap items-stretch justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-stone-800">{(comanda as any)?.profiles?.nome ? `Pedido #${p.numero} – ${(comanda as any).profiles.nome}` : `Pedido #${p.numero}`}</div>
                  <p className="text-sm font-medium text-amber-700 mt-0.5">Total: R$ {totalPedido(p).toFixed(2)}</p>
                  <ul className="mt-2 text-sm text-stone-600">
                    {(p.pedido_itens ?? []).map((i: any) => (
                      <li key={i.id}>{i.quantidade}x {i.produtos?.nome || i.produtos?.descricao} - R$ {(i.quantidade * i.valor_unitario).toFixed(2)}</li>
                    ))}
                  </ul>
                  {p.status === 'novo_pedido' && (
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => { setPopupEditar(p); setCarrinhoEdicao((p.pedido_itens ?? []).filter((i: any) => i.produtos).map((i: any) => ({ produto: i.produtos, quantidade: i.quantidade, observacao: i.observacao ?? '' }))); setSearchEdicao(''); }} className="text-sm text-amber-600 hover:underline">Editar pedido</button>
                      <button onClick={() => setPopupCancelar({ pedidoId: p.id })} className="text-sm text-red-600 hover:underline">Cancelar pedido</button>
                    </div>
                  )}
                </div>
                {p.status === 'finalizado' && (
                  <div className="min-w-[200px] w-[200px] flex flex-col items-center justify-center gap-2 shrink-0">
                    <span className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
                      Pronto – aguardando encerramento da mesa
                    </span>
                  </div>
                )}
                {pedidoTemItemParaCozinha(p) && (p.status === 'novo_pedido' || p.status === 'em_preparacao') && (
                  <div className="min-w-[200px] w-[200px] flex flex-col items-center justify-center gap-2 shrink-0">
                    <span className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-500">
                      Aguardando finalização na cozinha
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {contaItens && (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left py-2 text-sm font-medium text-stone-600">Código</th>
                <th className="text-left py-2 text-sm font-medium text-stone-600">Descrição</th>
                <th className="text-right py-2 text-sm font-medium text-stone-600">Qtd</th>
                <th className="text-right py-2 text-sm font-medium text-stone-600">Valor</th>
              </tr>
            </thead>
            <tbody>
              {itensParaExibir.map((item, i) => (
                <tr key={i} className="border-b border-stone-100">
                  <td className="py-2">{item.codigo}</td>
                  <td className="py-2">{item.descricao}</td>
                  <td className="py-2 text-right">{item.quantidade}</td>
                  <td className="py-2 text-right">R$ {item.valor.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex justify-end font-semibold text-stone-800">Total: R$ {contaItens.total.toFixed(2)}</div>
        </div>
      )}

      {popupImprimir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-stone-200">
            <h3 className="font-semibold text-stone-800 mb-4">Imprimir conta</h3>
            <label className="block text-sm font-medium text-stone-600 mb-1">Cupom</label>
            <select
              value={cupomDesconto}
              onChange={(e) => setCupomDesconto(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 mb-3"
            >
              <option value="">Nenhum</option>
              {cupons.map((c) => (
                <option key={c.id} value={c.id}>{c.codigo} ({c.porcentagem}%)</option>
              ))}
            </select>
            <label className="block text-sm font-medium text-stone-600 mb-1">Desconto (R$)</label>
            <input
              type="number"
              min={0}
              step={0.50}
              value={descontoManual}
              onChange={(e) => setDescontoManual(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 mb-3"
            />
            {contaItens && (valorCupom > 0 || valorManual > 0) && (
              <p className="text-sm text-stone-500 mb-2">
                Desconto: R$ {valorDesconto.toFixed(2)} — Total: R$ {totalComDesconto.toFixed(2)}
              </p>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={handleImprimirConta} className="flex-1 rounded-lg bg-amber-600 py-2 text-white hover:bg-amber-700">
                Imprimir
              </button>
              <button onClick={() => setPopupImprimir(false)} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {popupEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl my-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-stone-800 mb-3">Editar pedido #{popupEditar.numero}</h3>
            <p className="text-sm text-stone-500 mb-3">Altere os itens e salve. Só é possível editar antes do preparo.</p>
            <input type="text" value={searchEdicao} onChange={(e) => setSearchEdicao(e.target.value)} placeholder="Buscar por nome ou código..." className="w-full rounded-lg border border-stone-300 px-3 py-2 mb-2" />
            {sEdicao && filtradosEdicao.length > 0 && (
              <ul className="mb-3 max-h-[50vh] overflow-y-auto rounded-lg border border-stone-200 divide-y divide-stone-100 shadow-sm">
                {filtradosEdicao.slice(0, 30).map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => { addItemEdicao(p); setSearchEdicao(''); }} className="flex w-full min-h-[3.25rem] items-center gap-2 px-3 py-2.5 text-left hover:bg-stone-50">
                      <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-stone-100 overflow-hidden flex items-center justify-center">
                        {imagensProduto(p)[0] ? <img src={imagensProduto(p)[0]} alt="" className="w-full h-full object-cover" /> : <span className="text-stone-400 text-xs">IMG</span>}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-2">
                        <span className="text-sm font-medium text-stone-500">#{p.codigo}</span>
                        <span className="text-stone-800 truncate text-sm">{p.nome || p.descricao}</span>
                      </div>
                      <div className="flex-shrink-0 text-right text-[10px]">
                        {p.em_promocao && p.valor_promocional != null && Number(p.valor_promocional) > 0 ? (
                          <>
                            <span className="text-stone-500 block">De: <span className="line-through text-stone-400">R$ {Number(p.valor).toFixed(2)}</span></span>
                            <span className="text-amber-600 font-medium">Por: R$ {Number(p.valor_promocional).toFixed(2)}</span>
                          </>
                        ) : (
                          <span className="text-amber-600 font-medium text-sm">R$ {precoVenda(p).toFixed(2)}</span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="rounded-xl border border-stone-200 overflow-hidden mb-4">
              <div className="p-3 border-b border-stone-100 font-medium text-stone-700">Itens do pedido</div>
              <ul className="divide-y divide-stone-100">
                {carrinhoEdicao.map((item, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 p-3">
                    <div className="w-12 h-12 rounded-lg bg-stone-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {imagensProduto(item.produto)[0] ? <img src={imagensProduto(item.produto)[0]} alt="" className="w-full h-full object-cover" /> : <span className="text-stone-400 text-xs">IMG</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-stone-800">{item.produto.codigo} – {item.produto.nome || item.produto.descricao}</div>
                      <input type="text" value={item.observacao} onChange={(e) => setObsEdicao(i, e.target.value)} placeholder="Observação (ex: sem cebola)" className="mt-1 w-full text-sm rounded border border-stone-200 px-2 py-1" />
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => updateQtdEdicao(i, -1)} className="w-8 h-8 rounded border border-stone-300 text-stone-600">−</button>
                      <span className="w-8 text-center font-medium">{item.quantidade}</span>
                      <button type="button" onClick={() => updateQtdEdicao(i, 1)} className="w-8 h-8 rounded border border-stone-300 text-stone-600">+</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-2">
              <button onClick={salvarEdicao} disabled={enviandoEdicao || carrinhoEdicao.length === 0} className="flex-1 rounded-lg bg-amber-600 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-50">Salvar alterações</button>
              <button onClick={() => setPopupEditar(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {popupCancelar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-stone-800 mb-2">Cancelar pedido</h3>
            <p className="text-sm text-stone-600 mb-2">Informe o motivo do cancelamento (obrigatório para relatório):</p>
            <textarea value={motivoCancelamento} onChange={(e) => setMotivoCancelamento(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 mb-4 min-h-[80px]" placeholder="Ex: Cliente desistiu" required />
            <div className="flex gap-2">
              <button onClick={confirmarCancelarPedido} disabled={!motivoCancelamento.trim()} className="flex-1 rounded-lg bg-red-600 py-2 text-white hover:bg-red-700 disabled:opacity-50">Confirmar cancelamento</button>
              <button onClick={() => { setPopupCancelar(null); setMotivoCancelamento(''); }} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600">Voltar</button>
            </div>
          </div>
        </div>
      )}

      {popupPedidosNaoFinalizados && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-stone-800 mb-2">Não é possível encerrar a mesa</h3>
            <p className="text-sm text-stone-600 mb-4">Há pedidos que ainda não foram finalizados na cozinha. Finalize todos os pedidos antes de encerrar a mesa.</p>
            <button onClick={() => setPopupPedidosNaoFinalizados(false)} className="w-full rounded-lg bg-amber-600 py-2 text-white hover:bg-amber-700">Entendi</button>
          </div>
        </div>
      )}

      {popupPagamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-stone-800 mb-4">Forma de pagamento</h3>
            <div className="space-y-2">
              {formas.map((f) => (
                <button key={f} onClick={() => setFormaPagamento(f)} className={`block w-full rounded-lg border py-2 text-left px-3 ${formaPagamento === f ? 'border-amber-500 bg-amber-50' : 'border-stone-200'}`}>
                  {f}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={confirmarEncerramento} disabled={!formaPagamento} className="flex-1 rounded-lg bg-amber-600 py-2 text-white hover:bg-amber-700 disabled:opacity-50">
                Confirmar encerramento
              </button>
              <button onClick={() => setPopupPagamento(false)} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
