/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { showToast } from '../utils/toast';

interface GoogleAuthButtonProps {
  onAuthError?: (err: string) => void;
  isLoading?: boolean;
  setIsLoading?: (loading: boolean) => void;
}

export default function GoogleAuthButton({ onAuthError, isLoading, setIsLoading }: GoogleAuthButtonProps) {
  const [localLoading, setLocalLoading] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  const loading = isLoading ?? localLoading;
  const setLoad = setIsLoading ?? setLocalLoading;

  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch (e) {
      setIsInIframe(true);
    }
  }, []);

  const handleGoogleLogin = async () => {
    if (!auth) {
      const msg = 'Configuração do Firebase Authentication não encontrada ou não inicializada.';
      if (onAuthError) {
        onAuthError(msg);
      } else {
        showToast(msg, 'error', 'Firebase Auth');
      }
      return;
    }

    try {
      setLoad(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      console.log('[Firebase Auth] Launching Google Sign-In popup...');
      const result = await signInWithPopup(auth, provider);
      console.log('[Firebase Auth] Google Sign-In success for email:', result.user.email);
      showToast('Autenticação Google realizada com sucesso!', 'success', 'Google Auth');
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        console.warn('[Google Auth Info] Popup closed by user or environment iframe limits.');
      } else {
        console.error('[Google Auth Error]:', err);
      }
      let userFriendlyMsg = err.message || 'Erro ao iniciar o fluxo de login via Google.';
      if (err.code === 'auth/popup-blocked') {
        userFriendlyMsg = 'O pop-up de login foi bloqueado pelo seu navegador. Por favor, permita pop-ups ou abra o app em uma nova aba.';
      } else if (err.code === 'auth/popup-closed-by-user') {
        userFriendlyMsg = 'O fluxo de autenticação foi fechado. Caso esteja no visualizador do AI Studio, por favor clique no link abaixo para abrir em uma nova aba e tentar novamente.';
      }
      
      if (onAuthError) {
        onAuthError(userFriendlyMsg);
      } else {
        showToast(userFriendlyMsg, 'error', 'Google Auth');
      }
    } finally {
      setLoad(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        id="google-auth-button"
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-705 bg-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg
            className="w-4 h-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              fill="#EA4335"
            />
          </svg>
        )}
        <span>Entrar com o Google</span>
      </button>

      {isInIframe && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => window.open(window.location.origin, '_blank')}
            className="text-[10px] text-blue-600 hover:text-blue-800 underline font-medium cursor-pointer"
          >
            ⚠️ Abrir em Nova Aba se o login Google falhar
          </button>
        </div>
      )}
    </div>
  );
}
