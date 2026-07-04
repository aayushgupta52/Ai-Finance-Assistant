import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.js';

export default function ProtectedRoute({ children }) {
  const status = useAuthStore((s) => s.status);
  if (status !== 'authenticated') return <Navigate to="/login" replace />;
  return children;
}
