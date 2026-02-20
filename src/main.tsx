import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const rootEl = document.getElementById('root');
if (!rootEl) {
  document.body.textContent = 'Elemento #root não encontrado.';
  throw new Error('root not found');
}
const root: HTMLElement = rootEl;

function showError(container: HTMLElement, msg: string, stack?: string) {
  container.innerHTML = `
    <div style="padding:24px;font-family:system-ui,sans-serif;background:#fafaf9;color:#1c1917;min-height:100vh">
      <h1 style="font-size:20px;margin-bottom:16px">Erro ao carregar a aplicação</h1>
      <pre style="background:#fef2f2;color:#991b1b;padding:16px;border-radius:8px;overflow:auto;white-space:pre-wrap">${msg.replace(/</g, '&lt;')}</pre>
      ${stack ? `<pre style="font-size:12px;margin-top:16px;color:#78716c;overflow:auto">${stack.replace(/</g, '&lt;')}</pre>` : ''}
    </div>
  `;
}

async function init() {
  try {
    const [
      _css,
      { BrowserRouter },
      { ErrorBoundary },
      { AuthProvider },
      { default: App },
    ] = await Promise.all([
      import('./index.css'),
      import('react-router-dom'),
      import('./ErrorBoundary'),
      import('./contexts/AuthContext'),
      import('./App'),
    ]);

    createRoot(root).render(
      <StrictMode>
        <ErrorBoundary>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </ErrorBoundary>
      </StrictMode>
    );
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    showError(root, err.message, err.stack);
    console.error(e);
  }
}

init();
