import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    console.error('Uncaught React Rendering Error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-bg text-text" style={{ backgroundColor: 'var(--bg)' }}>
          <div
            className="w-full max-w-lg p-8 rounded-2xl border card-glass text-center space-y-5"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="w-14 h-14 mx-auto rounded-xl flex items-center justify-center bg-red-950/40 text-danger border border-red-500/30">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-text">Something went wrong</h1>
              <p className="text-sm text-text-muted">
                An unexpected rendering error occurred. The application state has been preserved safely.
              </p>
            </div>

            {this.state.error && (
              <details className="text-left bg-surface-2 p-3 rounded-lg text-xs font-mono text-text-muted overflow-auto max-h-36">
                <summary className="cursor-pointer font-semibold text-text mb-1">View error technical details</summary>
                <p className="text-danger mt-1">{this.state.error.toString()}</p>
              </details>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="secondary" onClick={() => (window.location.href = '/')}>
                Return to Home
              </Button>
              <Button variant="primary" onClick={this.handleReset}>
                Reload Application
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
