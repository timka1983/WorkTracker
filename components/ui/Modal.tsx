import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message?: string;
  children?: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, onConfirm, title, message, children, maxWidth = 'max-w-sm' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className={`bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl ${maxWidth} w-full border border-slate-200 dark:border-slate-800`}>
        <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-4">{title}</h3>
        {message && <p className="text-sm text-slate-600 dark:text-slate-400 mb-8">{message}</p>}
        {children && <div className="mb-8">{children}</div>}
        <div className="flex gap-4">
          <button 
            onClick={onClose} 
            className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            {onConfirm ? 'Отмена' : 'Закрыть'}
          </button>
          {onConfirm && (
            <button 
              onClick={() => { onConfirm(); onClose(); }} 
              className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all"
            >
              Подтвердить
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
