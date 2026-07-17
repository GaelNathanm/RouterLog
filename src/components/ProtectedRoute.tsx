import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, UserRole } from '../context/AuthContext';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[]; // Lista de roles que podem acessar a rota (ex: [0, 1])
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { user, profile, loading, role } = useAuth();

  // 1. Enquanto carrega as informações do Firebase, exibe um feedback visual
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-500">Verificando credenciais...</p>
        </div>
      </div>
    );
  }

  // 2. Se o usuário não estiver logado, redireciona para a página de Login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 3. Se o usuário está logado mas o perfil/cadastro não foi encontrado ou está inativo no Firestore
  if (!profile) {
    return <Navigate to="/sem-acesso" replace />;
  }

  // 4. Se a rota exige níveis específicos de acesso e o usuário não os possui
  if (allowedRoles && (role === null || !allowedRoles.includes(role))) {
    return <Navigate to="/nao-autorizado" replace />;
  }

  // 5. Se passou por todas as validações, renderiza a rota filha correspondente
  return <Outlet />;
};

export default ProtectedRoute;
