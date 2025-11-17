import React, { createContext, useContext, useState, useCallback } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import AlertDialog from '../components/AlertDialog';

const DialogContext = createContext();

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};

export const DialogProvider = ({ children }) => {
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    confirmButtonClass: 'confirm-btn-primary',
    onConfirm: null,
  });

  const [alertDialog, setAlertDialog] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    autoClose: true,
    duration: 4000,
  });

  // Show confirmation dialog
  const showConfirm = useCallback(
    ({
      title = 'Confirm Action',
      message,
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      confirmButtonClass = 'confirm-btn-primary',
    }) => {
      return new Promise((resolve) => {
        setConfirmDialog({
          isOpen: true,
          title,
          message,
          confirmText,
          cancelText,
          confirmButtonClass,
          onConfirm: () => {
            setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
            resolve(true);
          },
          onCancel: () => {
            setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
            resolve(false);
          },
        });
      });
    },
    []
  );

  // Show alert dialog
  const showAlert = useCallback(
    ({
      type = 'info',
      title,
      message,
      autoClose = true,
      duration = 4000,
    }) => {
      setAlertDialog({
        isOpen: true,
        type,
        title,
        message,
        autoClose,
        duration,
      });
    },
    []
  );

  const closeAlert = useCallback(() => {
    setAlertDialog((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const value = {
    showConfirm,
    showAlert,
    closeAlert,
  };

  return (
    <DialogContext.Provider value={value}>
      {children}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        confirmButtonClass={confirmDialog.confirmButtonClass}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel}
      />
      <AlertDialog
        isOpen={alertDialog.isOpen}
        type={alertDialog.type}
        title={alertDialog.title}
        message={alertDialog.message}
        autoClose={alertDialog.autoClose}
        duration={alertDialog.duration}
        onClose={closeAlert}
      />
    </DialogContext.Provider>
  );
};
