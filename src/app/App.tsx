import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from './components/ui/sonner';
import { AuthProvider, useAuth } from './contexts/auth-context';
import { AuthScreen } from './components/auth-screen';
import { Loader2 } from 'lucide-react';

// TEMPORARY: Bypass auth to access CRM
const BYPASS_AUTH = true;

function AppContent() {
  const { user, loading } = useAuth();

  // Bypass auth temporarily
  if (BYPASS_AUTH) {
    return (
      <>
        <RouterProvider router={router} />
        <Toaster />
      </>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;