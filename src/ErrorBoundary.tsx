import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          padding: 24,
          background: '#fafaf9',
          color: '#1c1917',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <h1 style={{ fontSize: 20, marginBottom: 16 }}>Algo deu errado</h1>
          <pre style={{
            background: '#fef2f2',
            color: '#991b1b',
            padding: 16,
            borderRadius: 8,
            overflow: 'auto',
            fontSize: 14,
          }}>
            {this.state.error.message}
          </pre>
          <p style={{ marginTop: 16, fontSize: 14 }}>
            Abra o Console do navegador (F12 → Console) para mais detalhes.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
