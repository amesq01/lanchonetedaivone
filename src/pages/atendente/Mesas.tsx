import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMesas, getMesaIdsComComandaAberta, openComanda } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Mesa } from '../../types/database';

export default function AtendenteMesas() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [ocupadas, setOcupadas] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState<{ mesa: Mesa } | null>(null);
  const [nomeCliente, setNomeCliente] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [list, ocup] = await Promise.all([
      getMesas(),
      getMesaIdsComComandaAberta(),
    ]);
    setMesas(list.filter((m) => !m.is_viagem));
    setOcupadas(ocup);
    setLoading(false);
  }

  async function handleAbrir(e: React.FormEvent) {
    e.preventDefault();
    if (!popup || !nomeCliente.trim() || !profile?.id) return;
    setSubmitting(true);
    try {
      await openComanda(popup.mesa.id, profile.id, nomeCliente.trim());
      setPopup(null);
      setNomeCliente('');
      navigate(`/pdv/mesas/${popup.mesa.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-stone-500">Carregando...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold text-stone-800 mb-4">Mesas</h1>
      <p className="text-stone-600 mb-4">Toque em uma mesa disponível para abrir.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {mesas.map((m) => {
          const aberta = ocupadas.has(m.id);
          return (
            <div key={m.id}>
              {aberta ? (
                <Link to={`/pdv/mesas/${m.id}`} className="block rounded-xl bg-amber-100 p-4 text-center font-medium text-amber-800 shadow-sm hover:bg-amber-200">
                  {m.nome}
                  <span className="block text-sm font-normal text-amber-700">Aberta</span>
                </Link>
              ) : (
                <button type="button" onClick={() => setPopup({ mesa: m })} className="block w-full rounded-xl bg-white p-4 text-center font-medium text-stone-700 shadow-sm border border-stone-200 hover:border-amber-400 hover:bg-amber-50">
                  {m.nome}
                  <span className="block text-sm font-normal text-stone-500">Disponível</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-stone-800 mb-2">Abrir {popup.mesa.nome}</h3>
            <form onSubmit={handleAbrir}>
              <label className="block text-sm font-medium text-stone-600 mb-1">Nome do cliente</label>
              <input value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} required className="w-full rounded-lg border border-stone-300 px-3 py-2 mb-4" placeholder="Ex: João" />
              <div className="flex gap-2">
                <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-amber-600 py-2 text-white hover:bg-amber-700 disabled:opacity-50">
                  Abrir
                </button>
                <button type="button" onClick={() => { setPopup(null); setNomeCliente(''); }} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-600">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
