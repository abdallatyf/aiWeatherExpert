import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// --- Error Boundary Component ---
// This component acts as a safety net. It catches JavaScript errors anywhere in its
// child component tree, logs those errors, and displays a fallback UI instead of
// the component tree that crashed.
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): { hasError: boolean } {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to an error reporting service or console
    console.error("Uncaught application error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Render a user-friendly fallback UI
      return (
        <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center justify-center p-4 font-sans">
            <div className="text-center max-w-lg bg-gray-800 p-8 rounded-2xl border border-red-700/50 shadow-2xl animate-fade-in">
                <svg className="w-16 h-16 mx-auto text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <h1 className="mt-4 text-3xl font-bold text-red-300">Application Error</h1>
                <p className="mt-2 text-gray-400">
                    Sorry, something went wrong. Please try reloading the page. This prevents the application from crashing completely.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-6 inline-flex items-center px-6 py-2 border border-transparent text-base font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500 transition-all duration-200"
                >
                    Reload Page
                </button>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
