import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } });
    const { email, password, nome, codigo, telefone } = await req.json();
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
    if (createError) return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    await supabaseAdmin.from('profiles').insert({ id: newUser.user.id, role: 'atendente', codigo: codigo || null, nome: nome || '', email: email || '', telefone: telefone || null });
    return new Response(JSON.stringify({ id: newUser.user.id }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
