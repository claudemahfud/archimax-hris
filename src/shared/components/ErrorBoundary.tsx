import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : 'Terjadi kesalahan tak terduga.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <h2>Halaman gagal dimuat</h2>
          <p>{this.state.message}</p>
          <button onClick={() => window.location.reload()}>Muat Ulang</button>
        </div>
      );
    }
    return this.props.children;
  }
}
