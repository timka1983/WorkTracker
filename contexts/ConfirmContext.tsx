import React, { createContext, useContext, useState, useCallback } from 'react';
import { ConfirmModal } from '../components/ConfirmModal';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'info' | 'warning';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setModalState({
        isOpen: true,
        options,
        resolve
      });
    });
  }, []);

  const handleClose = useCallback(() => {
    if (modalState) {
      modalState.resolve(false);
      setModalState(null);
    }
  }, [modalState]);

  const handleConfirm = useCallback(() => {
    if (modalState) {
      modalState.resolve(true);
      setModalState(null);
    }
  }, [modalState]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {modalState && (
        <ConfirmModal
          isOpen={modalState.isOpen}
          onClose={handleClose}
          onConfirm={handleConfirm}
          title={modalState.options.title || 'Подтверждение'}
          message={modalState.options.message}
          confirmText={modalState.options.confirmText}
          cancelText={modalState.options.cancelText}
          type={modalState.options.type}
        />
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};
