import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmLabel = 'Confirm',
  variant = 'danger',
  isLoading = false,
}) => (
  <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
    <div className="flex gap-3">
      <div className="flex-shrink-0">
        <AlertTriangle className="h-6 w-6 text-red-500" />
      </div>
      <p className="text-sm text-gray-600">{message}</p>
    </div>
    <div className="mt-5 flex justify-end gap-3">
      <button className="btn-secondary" onClick={onClose} disabled={isLoading}>
        Cancel
      </button>
      <button
        className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
        onClick={onConfirm}
        disabled={isLoading}
      >
        {isLoading ? 'Processing...' : confirmLabel}
      </button>
    </div>
  </Modal>
);