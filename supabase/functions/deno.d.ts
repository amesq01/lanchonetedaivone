/** Minimal Deno globals for Supabase Edge Functions (TypeScript without Deno extension). */
declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
  env: { get: (key: string) => string | undefined };
};
