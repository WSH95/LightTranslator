import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Error Boundary must be a class component in React
// Using 'any' temporarily to work around useDefineForClassFields: false in tsconfig
class ErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const self = this as any;
    
    if (self.state.hasError) {
      return (
        <div className="p-4 bg-red-50 text-red-800 h-full w-full overflow-auto">
          <h1 className="font-bold mb-2">Something went wrong</h1>
          <pre className="text-xs whitespace-pre-wrap">{self.state.error?.toString()}</pre>
        </div>
      );
    }

    return self.props.children;
  }
}

export { ErrorBoundaryClass as ErrorBoundary };
