import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'info' | 'warning';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  type = 'info'
}) => {
  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          icon: <X className="w-6 h-6 text-red-600" />,
          iconBg: 'bg-red-100 dark:bg-red-900/30',
          button: 'bg-red-600 hover:bg-red-700 shadow-red-100 dark:shadow-none',
          border: 'border-red-100 dark:border-red-900/30'
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
          iconBg: 'bg-amber-100 dark:bg-amber-900/30',
          button: 'bg-amber-600 hover:bg-amber-700 shadow-amber-100 dark:shadow-none',
          border: 'border-amber-100 dark:border-amber-900/30'
        };
      default:
        return {
          icon: <AlertTriangle className="w-6 h-6 text-blue-600" />,
          iconBg: 'bg-blue-100 dark:bg-blue-900/30',
          button: 'bg-blue-600 hover:bg-blue-700 shadow-blue-100 dark:shadow-none',
          border: 'border-blue-100 dark:border-blue-900/30'
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl dark:shadow-slate-950/50 border border-slate-200 dark:border-slate-800 animate-scaleIn"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className={`p-3 rounded-2xl ${styles.iconBg}`}>
              {styles.icon}
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-slate-50 uppercase tracking-tight leading-tight">
              {title}
            </h3>
          </div>
          
          <p className="text-slate-600 dark:text-slate-400 font-medium leading-relaxed mb-8">
            {message}
          </p>
          
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
            >
              {cancelText}
            </button>
            <button 
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 py-4 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all active:scale-95 ${styles.button}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
