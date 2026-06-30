'use client';

import { AlertTriangle, X } from 'lucide-react';
import { Modal } from '@/components/ui/modal';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function DeleteConfirmationModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  isLoading = false
}: DeleteConfirmationModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} size="sm" padded={false}>
      <div className="flex justify-between items-start p-6 border-b">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        </div>
        <button
          onClick={onCancel}
          aria-label="Close dialog"
          className="text-gray-500 hover:text-gray-700"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <p className="p-6 text-gray-700">{message}</p>

      <div className="flex gap-4 justify-end p-6 border-t bg-gray-50">
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg disabled:bg-gray-200"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
        >
          {isLoading ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </Modal>
  );
}
