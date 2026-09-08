import { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { routes } from './router/routes';
import { ErrorBoundary } from './shared/components/ErrorBoundary';
import { ToastContainer } from './shared/components/Toast';
import { ToastProvider } from './shared/hooks/useToast';
import { Spinner } from './shared/components/Loading';

export default function App() {
  return (
    <ToastProvider>
      <ErrorBoundary>
        <Suspense fallback={<div className="page"><Spinner label="Memuat halaman..." /></div>}>
          <Routes>
            {routes.map((r) => (
              <Route key={r.path} path={r.path} element={<r.component />} />
            ))}
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <ToastContainer />
    </ToastProvider>
  );
}
