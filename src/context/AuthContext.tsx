import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

// Definição dos níveis de acesso (roles) mapeados no seu projeto
// 0: Admin, 1: Gerente, 2: Motorista, 3: Vendedor
export type UserRole = 0 | 1 | 2 | 3;

// Interface dos dados do usuário armazenados no Firestore
export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  region?: string;        // Relevante para Gerentes/Vendedores
  vehicleId?: string;     // Relevante para Motoristas
  createdAt: any;
  updatedAt: any;
}

// Interface do Contexto de Autenticação
interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  role: UserRole | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    // Subscreve ao observador do Firebase Auth
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // Limpa qualquer escuta de perfil ativa anterior
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (firebaseUser) {
        setUser(firebaseUser);
        setLoading(true);
        
        // Subscreve em tempo real ao documento do perfil do usuário no Firestore (/users/{uid})
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as any;
            
            // Garante que o usuário está ativo no sistema (verifica status ou isActive)
            if (userData.isActive === false || userData.status === 'banned' || userData.status === 'suspended') {
              console.warn("Usuário está inativo ou bloqueado no sistema.");
              setProfile(null);
            } else {
              setProfile({
                uid: firebaseUser.uid,
                ...userData
              });
            }
          } else {
            console.warn("Documento de perfil ainda não encontrado no Firestore para o UID:", firebaseUser.uid);
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Erro ao escutar o perfil do usuário no Firestore:", error);
          setProfile(null);
          setLoading(false);
        });
      } else {
        // Usuário deslogado limpa os estados
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    // Cancela as inscrições ao desmontar o componente
    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  const value: AuthContextType = {
    user,
    profile,
    loading,
    role: profile ? profile.role : null
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// Hook personalizado para usar o contexto de forma simples nas telas e componentes
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado obrigatoriamente dentro de um AuthProvider');
  }
  return context;
};
