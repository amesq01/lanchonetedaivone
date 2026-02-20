import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPedidoOnline, getConfig, getProdutos, validarCupom } from '../../lib/api';
import type { SavedItem } from './Carrinho';
import { getCupomAplicado } from './Carrinho';

const CART_KEY = 'lanchonete_cart';

function getCart(): SavedItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export default function LojaCheckout() {
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [tipoEntrega, setTipoEntrega] = useState<'entrega' | 'retirada'>('entrega');
  const [endereco, setEndereco] = useState('');
  const [pontoReferencia, setPontoReferencia] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('');
  const [precisaTroco, setPrecisaTroco] = useState(false);
  const [trocoPara, setTrocoPara] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [cupom, setCupom] = useState(() => getCupomAplicado()?.codigo ?? '');
  const [cupomValidado, setCupomValidado] = useState<{ codigo: string; porcentagem: number } | null>(null);
  const [cupomErro, setCupomErro] = useState('');
  const [cupomLoading, setCupomLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [taxaEntrega, setTaxaEntrega] = useState<number | null>(null);
  const [produtos, setProdutos] = useState<{ id: string; valor: number }[]>([]);
  const cupomDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cart = getCart();
  useEffect(() => {
    getConfig('taxa_entrega').then(setTaxaEntrega);
    getProdutos(true).then((list) => setProdutos(list.map((p) => ({ id: p.id, valor: Number(p.valor) }))));
  }, []);

  useEffect(() => {
    const codigo = cupom.trim();
    if (!codigo) {
      setCupomValidado(null);
      setCupomErro('');
      return;
    }
    if (cupomDebounceRef.current) clearTimeout(cupomDebounceRef.current);
    setCupomLoading(true);
    setCupomErro('');
    cupomDebounceRef.current = setTimeout(async () => {
      cupomDebounceRef.current = null;
      const result = await validarCupom(codigo);
      setCupomLoading(false);
      if ('cupom' in result) {
        setCupomValidado({ codigo: result.cupom.codigo, porcentagem: Number(result.cupom.porcentagem) });
        setCupomErro('');
      } else {
        setCupomValidado(null);
        setCupomErro(result.error);
      }
    }, 500);
    return () => {
      if (cupomDebounceRef.current) clearTimeout(cupomDebounceRef.current);
    };
  }, [cupom]);

  const byId: Record<string, number> = {};
  produtos.forEach((p) => { byId[p.id] = Number.isFinite(Number(p.valor)) ? Number(p.valor) : 0; });
  const rawSubtotal = cart.reduce((s, i) => s + (byId[i.produto_id] ?? 0) * (i.quantidade || 0), 0);
  const subtotal = Number.isFinite(rawSubtotal) ? rawSubtotal : 0;
  const rawDesconto = cupomValidado ? (subtotal * Number(cupomValidado.porcentagem)) / 100 : 0;
  const desconto = Number.isFinite(rawDesconto) ? rawDesconto : 0;
  const taxaNum = tipoEntrega === 'entrega' ? Number(taxaEntrega) : 0;
  const taxa = Number.isFinite(taxaNum) ? taxaNum : 0;
  const totalPedido = Math.max(0, (subtotal - desconto + taxa)) || 0;
  if (cart.length === 0 && !submitting) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-stone-600 mb-4">Carrinho vazio.</p>
          <Link to="/" className="text-amber-600 hover:underline">Voltar ao cardápio</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { getProdutos } = await import('../../lib/api');
      const produtos = await getProdutos(true);
      const byId: Record<string, { id: string; valor: number }> = {};
      produtos.forEach((p) => { byId[p.id] = { id: p.id, valor: Number(p.valor) }; });
      const itens = cart.filter((i) => byId[i.produto_id]).map((i) => ({
        produto_id: i.produto_id,
        quantidade: i.quantidade,
        valor_unitario: byId[i.produto_id].valor,
        observacao: i.observacao || undefined,
      }));
      if (itens.length === 0) throw new Error('Nenhum item válido no carrinho.');
      await createPedidoOnline({
        cliente_nome: nome,
        cliente_whatsapp: whatsapp,
        cliente_endereco: tipoEntrega === 'entrega' ? endereco : 'Retirada no local',
        ponto_referencia: tipoEntrega === 'entrega' && pontoReferencia ? pontoReferencia : undefined,
        forma_pagamento: formaPagamento,
        tipo_entrega: tipoEntrega,
        troco_para: formaPagamento === 'Dinheiro' && precisaTroco && trocoPara ? Number(trocoPara) : undefined,
        observacoes: observacoes || undefined,
        cupom_codigo: cupomValidado ? cupomValidado.codigo : undefined,
        itens,
      });
      localStorage.removeItem(CART_KEY);
      navigate('/obrigado');
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  const formas = ['PIX', 'Cartão crédito', 'Cartão débito', 'Dinheiro'];

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white px-4 py-4">
        <Link to="/carrinho" className="text-amber-600 hover:underline">← Voltar ao carrinho</Link>
        <h1 className="text-xl font-bold text-stone-800 mt-2">Finalizar pedido</h1>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-600">Nome *</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} required className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600">WhatsApp *</label>
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} required placeholder="(00) 00000-0000" className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600">Como deseja receber? *</label>
            <div className="mt-2 flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="tipoEntrega" value="entrega" checked={tipoEntrega === 'entrega'} onChange={() => setTipoEntrega('entrega')} className="border-stone-300" />
                <span>Entrega</span>
                {taxaEntrega !== null && Number.isFinite(taxaEntrega) && taxaEntrega > 0 && <span className="text-stone-500 text-sm">(taxa R$ {taxaEntrega.toFixed(2)})</span>}
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="tipoEntrega" value="retirada" checked={tipoEntrega === 'retirada'} onChange={() => setTipoEntrega('retirada')} className="border-stone-300" />
                <span>Retirada no local (grátis)</span>
              </label>
            </div>
          </div>
          {tipoEntrega === 'entrega' && (
            <>
              <div>
                <label className="block text-sm font-medium text-stone-600">Endereço *</label>
                <textarea value={endereco} onChange={(e) => setEndereco(e.target.value)} required rows={2} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" placeholder="Rua, número, bairro, complemento" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600">Ponto de referência</label>
                <input value={pontoReferencia} onChange={(e) => setPontoReferencia(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" placeholder="Ex: próximo ao mercado, casa com portão azul" />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-stone-600">Forma de pagamento *</label>
            <select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} required className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2">
              <option value="">Selecione</option>
              {formas.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          {formaPagamento === 'Dinheiro' && (
            <>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="precisaTroco" checked={precisaTroco} onChange={(e) => setPrecisaTroco(e.target.checked)} className="rounded border-stone-300" />
                <label htmlFor="precisaTroco" className="text-sm font-medium text-stone-600">Necessita de troco?</label>
              </div>
              {precisaTroco && (
                <div>
                  <label className="block text-sm font-medium text-stone-600">Para quanto? (R$)</label>
                  <input type="number" step="0.01" min="0" value={trocoPara} onChange={(e) => setTrocoPara(e.target.value)} placeholder="Ex: 50" className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
                </div>
              )}
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-stone-600">Observações do pedido</label>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" placeholder="Ex: tirar cebola, ponto da carne..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600">Cupom de desconto</label>
            <input value={cupom} onChange={(e) => setCupom(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" placeholder="Código do cupom" />
            {cupomLoading && <p className="mt-1 text-sm text-stone-500">Verificando cupom...</p>}
            {cupomErro && <p className="mt-1 text-sm text-red-600">{cupomErro}</p>}
            {cupomValidado && !cupomErro && <p className="mt-1 text-sm text-green-600">Cupom {cupomValidado.codigo} aplicado ({cupomValidado.porcentagem}% de desconto).</p>}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="rounded-xl bg-stone-100 p-4 mb-4">
            <div className="flex justify-between text-sm text-stone-600"><span>Subtotal</span><span>R$ {(Number.isFinite(subtotal) ? subtotal : 0).toFixed(2)}</span></div>
            {desconto > 0 && <div className="flex justify-between text-sm text-amber-700"><span>Desconto (cupom)</span><span>- R$ {(Number.isFinite(desconto) ? desconto : 0).toFixed(2)}</span></div>}
            {taxa > 0 && <div className="flex justify-between text-sm text-stone-600"><span>Taxa de entrega</span><span>R$ {(Number.isFinite(taxa) ? taxa : 0).toFixed(2)}</span></div>}
            <div className="flex justify-between font-semibold text-stone-800 mt-2 pt-2 border-t border-stone-200"><span>Total</span><span>R$ {(Number.isFinite(totalPedido) ? totalPedido : 0).toFixed(2)}</span></div>
          </div>
          <button type="submit" disabled={submitting} className="w-full rounded-lg bg-amber-600 py-3 font-medium text-white hover:bg-amber-700 disabled:opacity-50">
            {submitting ? 'Enviando...' : `Confirmar pedido - Total R$ ${(Number.isFinite(totalPedido) ? totalPedido : 0).toFixed(2)}`}
          </button>
        </form>
      </main>
    </div>
  );
}
