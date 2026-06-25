/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { registerToastCallback, unregisterToastCallback, ToastMessage } from '../utils/toast';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, Info, X, AlertCircle } from 'lucide-react';

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    registerToastCallback((newToast) => {
      setToasts((prev) => [...prev, newToast]);
      
      // Auto-remove after duration
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, newToast.duration || 5000);
    });

    return () => {
      unregisterToastCallback();
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const getIcon = (type: ToastMessage['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-rose-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      default:
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getBorderColor = (type: ToastMessage['type']) => {
    switch (type) {
      case 'success':
        return 'border-emerald-200 bg-white/95 text-emerald-900 shadow-emerald-50/50';
      case 'error':
        return 'border-rose-200 bg-white/95 text-rose-900 shadow-rose-50/50';
      case 'warning':
        return 'border-amber-200 bg-white/95 text-amber-950 shadow-amber-50/50';
      default:
        return 'border-blue-200 bg-white/95 text-blue-900 shadow-blue-50/50';
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none select-text">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 35, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -10, transition: { duration: 0.15 } }}
            className={`pointer-events-auto p-4 rounded-2xl border shadow-xl flex gap-3 backdrop-blur-sm ${getBorderColor(
              toast.type
            )}`}
          >
            <div className="shrink-0 mt-0.5">{getIcon(toast.type)}</div>
            <div className="flex-1 min-w-0">
              {toast.title && (
                <strong className="block text-xs font-black uppercase tracking-wider mb-0.5 font-sans">
                  {toast.title}
                </strong>
              )}
              <p className="text-[11px] leading-relaxed font-semibold font-sans">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-700 shrink-0 self-start p-0.5 cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
