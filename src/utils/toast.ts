/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  title?: string;
  duration?: number;
}

// Global callback set by the ToastContainer component
let toastCallback: ((toast: ToastMessage) => void) | null = null;

export function registerToastCallback(cb: (toast: ToastMessage) => void) {
  toastCallback = cb;
}

export function unregisterToastCallback() {
  toastCallback = null;
}

export function showToast(message: string, type: ToastType = 'info', title?: string, duration = 5000) {
  if (toastCallback) {
    toastCallback({
      id: `${Date.now()}_${Math.random()}`,
      message,
      type,
      title,
      duration
    });
  } else {
    // Fallback if container is not mounted yet
    console.log(`[Toast Fallback - ${type}] ${title ? title + ': ' : ''}${message}`);
  }
}
