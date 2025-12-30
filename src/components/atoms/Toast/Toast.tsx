/**
 * Toast - Atom Level
 *
 * Componente de notificación toast para mostrar mensajes de feedback al usuario.
 * Soporta diferentes tipos (success, error) y se auto-oculta después de un tiempo.
 *
 * @param show - Si el toast debe mostrarse
 * @param message - Mensaje a mostrar
 * @param type - Tipo de toast ('success' | 'error')
 * @param onClose - Función para cerrar el toast
 *
 * @example
 * <Toast
 *   show={true}
 *   message="Item guardado exitosamente"
 *   type="success"
 *   onClose={() => setShow(false)}
 * />
 */

import React, { useEffect } from 'react';

import { CheckCircle, XCircle, X } from 'lucide-react';

interface ToastProps {
  show: boolean;
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
  duration?: number;
}

export default function Toast({
  show,
  message,
  type,
  onClose,
  duration = 3000,
}: ToastProps) {
  useEffect(() => {
    if (show && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  if (!show) return null;

  const getToastStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-emerald-900/90 border-emerald-600 text-emerald-100';
      case 'error':
        return 'bg-red-900/90 border-red-600 text-red-100';
      default:
        return 'bg-slate-900/90 border-slate-600 text-slate-100';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
      <div
        className={`
          flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm
          shadow-lg max-w-md min-w-[300px]
          ${getToastStyles()}
        `}
      >
        {getIcon()}
        <span className="flex-1 text-sm font-medium">{message}</span>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
