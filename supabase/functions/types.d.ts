// Tipos auxiliares para funções Edge (Deno) usando imports com prefixo `npm:`.
// Isso faz o TypeScript da aplicação enxergar o módulo e parar de emitir erro,
// reaproveitando os tipos já instalados de `@supabase/supabase-js`.

declare module 'npm:@supabase/supabase-js@2' {
  export * from '@supabase/supabase-js';
}

