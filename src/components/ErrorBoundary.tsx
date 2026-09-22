'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  componentName: string;
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
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Uncaught error in ${this.props.componentName}:`, error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#ffdddd', color: '#990000', border: '1px solid #990000', margin: '20px', borderRadius: '8px' }}>
          <h2>Crash in {this.props.componentName}</h2>
          <p><strong>Error:</strong> {this.state.error?.toString()}</p>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>
            <summary>Stack Trace</summary>
            {this.state.error?.stack}
            <br />
            {this.state.errorInfo?.componentStack}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
