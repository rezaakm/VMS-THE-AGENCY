import React, { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
      // TODO: Send to error reporting service (Sentry, LogRocket, etc.)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="m-4 border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. This has been logged and will be investigated.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-xs">
                <summary className="cursor-pointer font-medium mb-2">
                  Error Details (Development Only)
                </summary>
                <div className="bg-muted p-2 rounded font-mono whitespace-pre-wrap">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack && (
                    <>
                      {"\n\nComponent Stack:"}
                      {this.state.errorInfo.componentStack}
                    </>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-2">
              <Button
                onClick={this.handleReset}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Try Again
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="destructive"
                size="sm"
                className="text-xs"
              >
                Reload Page
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundaryComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}