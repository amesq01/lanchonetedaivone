import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPedidoOnline } from '../../lib/api';
import type { SavedItem } from './Carrinho';

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
  const [endereco, setEndereco] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('');
  const [troco, setTroco] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [cupom, setCupom] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const cart = getCart();
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
        cliente_endereco: endereco,
        forma_pagamento: formaPagamento,
        troco_para: formaPagamento === 'dinheiro' && troco ? Number(troco) : undefined,
        observacoes: observacoes || undefined,
        cupom_codigo: cupom || undefined,
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
            <label className="block text-sm font-medium text-stone-600">Endereço *</label>
            <textarea value={endereco} onChange={(e) => setEndereco(e.target.value)} required rows={2} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" placeholder="Rua, número, bairro, complemento" />
          </div>
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
            <div>
              <label className="block text-sm font-medium text-stone-600">Precisa de troco? (valor em R$)</label>
              <input type="number" step="0.01" min="0" value={troco} onChange={(e) => setTroco(e.target.value)} placeholder="Ex: 50" className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-stone-600">Observações do pedido</label>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" placeholder="Ex: tirar cebola, ponto da carne..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600">Cupom de desconto</label>
            <input value={cupom} onChange={(e) => setCupom(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" placeholder="Código do cupom" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={submitting} className="w-full rounded-lg bg-amber-600 py-3 font-medium text-white hover:bg-amber-700 disabled:opacity-50">
            {submitting ? 'Enviando...' : 'Confirmar pedido'}
          </button>
        </form>
      </main>
    </div>
  );
}
