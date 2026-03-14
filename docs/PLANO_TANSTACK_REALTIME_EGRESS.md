# Plano: Redução de egress com TanStack Query + Realtime

## Objetivo
Diminuir consideravelmente o egress no Supabase usando:
- **TanStack Query**: cache, `staleTime`, refetch só quando necessário
- **Supabase Realtime**: escutar mudanças em `pedidos` e `comandas`; ao detectar INSERT/UPDATE/DELETE, **invalidar** apenas as queries afetadas (refetch sob demanda)
- **Mutations**: ações que alteram dados invalidam as queries corretas no `onSuccess`

## Convenção de query keys
- `['pedidos-online']` — pendentes + todos + encerrados hoje (PedidosOnline)
- `['pedidos-viagem']` — abertos + encerrados hoje (Viagem)
- `['pedidos-cozinha']` — lista para kanban (CozinhaKanban)
- `['admin-sidebar-counts']` — contagens da sidebar admin
- `['produtos', { ativoOnly }]` — catálogo
- `['categorias']` — categorias
- `['mesas-dashboard']` — mesas com contas pendentes (se necessário)

## Implementação

### 1. Setup TanStack
- **Feito**: `@tanstack/react-query` instalado
- **Feito**: `QueryClient` em `src/lib/queryClient.ts` com `staleTime` padrão razoável
- **Feito**: `QueryClientProvider` no root (`main.tsx`)

### 2. Realtime → invalidação
- **Arquivo**: `src/lib/supabaseRealtime.ts`
- Inscrever em `postgres_changes` na tabela `pedidos` (eventos INSERT, UPDATE, DELETE).
- Inscrever em `postgres_changes` na tabela `comandas` (eventos INSERT, UPDATE, DELETE).
- Callback: recebe o `queryClient` (ou obtém do contexto singleton) e chama:
  - Para `pedidos`: `invalidateQueries({ queryKey: ['pedidos-online'] })`, `['pedidos-viagem']`, `['pedidos-cozinha']`, `['admin-sidebar-counts']`
  - Para `comandas`: `invalidateQueries({ queryKey: ['admin-sidebar-counts'] })`, e se existir query de mesas/dashboard, invalidar também
- A subscription é iniciada quando o usuário está autenticado (ex.: dentro de um hook ou no layout admin) e cancelada no cleanup.

### 3. Pedidos Online
- **Antes**: `load()` a cada 5s (polling) + estado local `pendentes`, `todos`, `encerradosHoje`.
- **Depois**:
  - Uma `useQuery` com `queryKey: ['pedidos-online']` que chama uma função que retorna `{ pendentes, todos, encerradosHoje }` (mesma forma que hoje, para não quebrar a UI).
  - **Sem** `refetchInterval`; atualizações vêm do Realtime (invalidação).
  - Mutations: aceitar, cancelar, atualizar itens, encerrar, etc. Com `onSuccess`: `invalidateQueries({ queryKey: ['pedidos-online'] })` (e se a ação afetar cozinha/sidebar, invalidar também).
- **Cuidado**: manter exatamente a mesma estrutura de dados (incl. `pedido_itens` com `produtos`) para não reintroduzir o bug de itens sumindo.

### 4. Viagem
- **Antes**: polling a cada 3s.
- **Depois**: `useQuery` com `queryKey: ['pedidos-viagem']`, sem polling; Realtime invalida quando `pedidos` ou `comandas` mudam. Mutations (encerrar, editar, cancelar, transferir, novo pedido) com invalidação de `['pedidos-viagem']` e `['admin-sidebar-counts']`.

### 5. Cozinha Kanban
- **Antes**: polling a cada 5s.
- **Depois**: `useQuery` com `queryKey: ['pedidos-cozinha']`, sem polling; Realtime invalida. Mutations (mudar status) invalidam `['pedidos-cozinha']` e `['admin-sidebar-counts']`.

### 6. Admin Layout (sidebar counts)
- **Antes**: `getAdminSidebarCounts()` a cada 20s.
- **Depois**: `useQuery` com `queryKey: ['admin-sidebar-counts']`, `staleTime` por ex. 15–20s, **sem** `refetchInterval`; Realtime (pedidos + comandas) invalida quando há mudança, então os números atualizam assim que algo muda.

### 7. Produtos / Categorias
- Hooks opcionais: `useProdutos(ativoOnly)`, `useCategorias()` com cache longo (ex.: `staleTime: 5 * 60 * 1000`) para reduzir chamadas repetidas nas telas de loja/admin.

## Impacto no egress
- **Antes**: múltiplos refetches a cada 3–5–20s em várias telas, mesmo sem mudança.
- **Depois**: fetch inicial + refetch **apenas** quando Realtime notifica mudança (ou quando o usuário invalida manualmente, ex.: após mutation). Menos requisições e menos dados transferidos.

## Riscos e cuidados
- **Bug anterior**: itens de pedido sumindo ao editar/aceitar — não alterar a forma como os dados de pedido e `pedido_itens` são montados/exibidos; apenas trocar a fonte dos dados (useQuery com a mesma função que já retorna o mesmo formato).
- **Realtime no Supabase**: Habilitar "Realtime" nas tabelas `pedidos` e `comandas` no Dashboard do Supabase (Database → Tables → [tabela] → Realtime: Enable), caso ainda não esteja ativo.
- Realtime consome conexões; uma única subscription por tabela (ou por canal) é suficiente.

## Status da implementação
- [x] TanStack instalado e QueryClientProvider no root
- [x] Realtime em `pedidos` e `comandas` invalida queries (supabaseRealtime.ts)
- [x] AdminLayout: useQuery para sidebar counts, subscription Realtime no mount
- [x] PedidosOnline: useQuery + useMutation, sem polling
- [x] Viagem: useQuery + invalidateViagem() após ações
- [x] CozinhaKanban: useQuery + useMutation para mover status
- [x] Mesas: useQuery mesasDashboard, invalidação via Realtime e após initMesas
- [ ] (Opcional) useProdutos/useCategorias com cache longo para reduzir mais chamadas
