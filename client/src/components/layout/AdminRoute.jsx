import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function AdminRoute({ children }) {
  const { student, initialising } = useAuth();

  if (initialising) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  // Check if authenticated
  if (!student) {
    return <Navigate to="/login" replace />;
  }

  // Cosmetic only — the server is the real enforcement point (requireAdmin).
  if (student.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
