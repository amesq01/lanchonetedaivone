# Lanchonete & Sushi - PDV e Loja Online

Aplicação React (Vite + TypeScript + Tailwind) para lanchonete com atendimento **presencial** (mesas + viagem) e **online**, usando **Supabase** para banco de dados e autenticação.

## Funcionalidades

- **Presencial**: Mesas no salão + mesa VIAGEM (para viagem)
- **PDV Atendente** (tablet): abrir mesa, nome do cliente, buscar produtos, adicionar itens, finalizar pedido, acordion de pedidos, cancelar pedido (se status "novo"), adicionar outro pedido
- **Admin** (desktop): cadastro de mesas (quantidade; mesa VIAGEM gerada automaticamente), atendentes, produtos, cupons, taxa de entrega; visualizar/encerrar mesas; imprimir conta; mesa VIAGEM (finalizar e encerrar pedidos); pedidos online (aceitar); kanban cozinha (novo / em preparação / finalizado) com tags ONLINE e VIAGEM
- **Cozinha**: Kanban com colunas Novo pedido, Em preparação, Finalizado; botões Preparar e Finalizar
- **Loja online**: cardápio, carrinho, checkout (nome, WhatsApp, endereço, forma de pagamento, troco, observações, cupom); pedidos aparecem em Admin → Pedidos online e, após aceite, no kanban da cozinha

## Setup

### 1. Instalar dependências

```bash
cd lanchonete-app
npm install
```

### 2. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No SQL Editor, execute o conteúdo de `supabase/schema.sql` para criar tabelas, RLS e a função `next_pedido_numero`.
3. Em Authentication → Providers, desative "Confirm email" se quiser login imediato.
4. Crie o primeiro usuário admin: Authentication → Users → Add user (email + senha). Copie o **User UID**.
5. No SQL Editor:

```sql
INSERT INTO profiles (id, role, nome, email) VALUES ('COLE-O-UID-AQUI', 'admin', 'Admin', 'seu@email.com');
```

6. (Opcional) Para cadastro de atendentes pela aplicação, publique a Edge Function `create-atendente` e use a Service Role Key apenas no backend da função.

### 3. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 4. Rodar

```bash
npm run dev
```

- **Loja (clientes)**: raiz `/`
- **Login (staff)**: `/login` → redireciona admin para `/admin` e atendente para `/pdv`
- **Admin**: `/admin` (mesas, viagem, pedidos online, cozinha, atendentes, produtos, cupons, taxa entrega)
- **PDV**: `/pdv` (mesas, viagem, novo pedido viagem em `/pdv/viagem/novo`)

## Scripts

- `npm run dev` – servidor de desenvolvimento
- `npm run build` – build de produção
- `npm run preview` – preview do build

## Tecnologias

- React 19, Vite 7, TypeScript, Tailwind CSS 3
- React Router 7
- Supabase (Auth, Database, RLS)
- Lucide React (ícones)
