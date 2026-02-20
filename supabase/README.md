# Supabase – Rodar migrações SQL

## Opção 1: Dashboard (SQL Editor)

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard) e abra seu projeto (ex.: `nknbpbtlutzjwauqyfbo`).
2. No menu lateral, clique em **SQL Editor**.
3. Clique em **New query**.
4. Cole o conteúdo do arquivo de migração que deseja rodar (ex.: `migrations/20260222_produtos_nome.sql`).
5. Clique em **Run** (ou `Ctrl+Enter` / `Cmd+Enter`).

Para aplicar **todas** as migrações pendentes manualmente, rode cada arquivo em `migrations/` na ordem da data no nome (ex.: 20260219 → 20260220 → 20260221 → 20260222).

---

## Opção 2: Supabase CLI

Se quiser rodar as migrações pelo terminal:

1. **Instale a Supabase CLI** (se ainda não tiver):
   ```bash
   npm install -g supabase
   ```
   Ou use [outros métodos de instalação](https://supabase.com/docs/guides/cli).

2. **Vincule o projeto** (uma vez):
   ```bash
   cd /Users/amesq/lanchonete-app
   supabase link --project-ref nknbpbtlutzjwauqyfbo
   ```
   Quando pedir, use a **database password** do projeto (Settings → Database no Dashboard).

3. **Envie as migrações** para o banco remoto:
   ```bash
   npm run db:push
   ```
   (ou `supabase db push` direto). Isso aplica todos os arquivos em `supabase/migrations/` que ainda não foram aplicados.

---

## Migração atual: coluna `nome` em produtos

Arquivo: `migrations/20260222_produtos_nome.sql`

```sql
-- Campo "nome do produto" (após código) no cadastro
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS nome TEXT DEFAULT '';
```

Copie e rode no SQL Editor do Dashboard se quiser aplicar só essa migração.
