import { Component, ReactNode } from 'react';
import i18n from '../i18n';
import './ErrorBoundary.css';

// State tracked by the ErrorBoundary component
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

// Props for the ErrorBoundary class component
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

// React error boundary – catches rendering errors and displays a fallback UI with retry/reload options
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to error reporting service
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h2 className="error-title">{i18n.t('somethingWentWrong')}</h2>
            <p className="error-message">
              {this.state.error?.message || i18n.t('errorDetails')}
            </p>
            <div className="error-actions">
              <button className="error-button error-button-primary" onClick={this.handleReset}>
                {i18n.t('tryAgain')}
              </button>
              <button className="error-button error-button-secondary" onClick={this.handleReload}>
                {i18n.t('refreshPage')}
              </button>
            </div>
            {import.meta.env.DEV && this.state.errorInfo && (
              <details className="error-details">
                <summary>{i18n.t('errorDetails')}</summary>
                <pre className="error-stack">
                  {this.state.error?.toString()}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
