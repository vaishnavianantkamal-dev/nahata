import * as React from 'react';

type ToastVariant = 'default' | 'destructive';

interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  action?: React.ReactNode;
}

type ToastInput = Omit<Toast, 'id'>;

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 4000;

let toastCount = 0;
const listeners: Set<(toasts: Toast[]) => void> = new Set();
let toasts: Toast[] = [];

function addToast(toast: ToastInput) {
  const id = String(++toastCount);
  toasts = [{ ...toast, id }, ...toasts].slice(0, TOAST_LIMIT);
  listeners.forEach(l => l(toasts));
  setTimeout(() => removeToast(id), TOAST_REMOVE_DELAY);
  return id;
}

function removeToast(id: string) {
  toasts = toasts.filter(t => t.id !== id);
  listeners.forEach(l => l(toasts));
}

export function toast(input: ToastInput) {
  return addToast(input);
}

export function useToast() {
  const [state, setState] = React.useState<Toast[]>(toasts);
  React.useEffect(() => {
    listeners.add(setState);
    return () => { listeners.delete(setState); };
  }, []);
  return { toasts: state, toast, dismiss: removeToast };
}
