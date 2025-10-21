
import React from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, size = 'md' }) => {
    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
    };

    return (
        <div className="fixed inset-0 z-[60] justify-center" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className={`relative bg-slate-800 w-full ${sizeClasses[size]} mx-4 rounded-xl border border-gray-700 shadow-2xl flex flex-col`}>
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h4 className="font-semibold text-lg" id="modal-title">{title}</h4>
                    <button onClick={onClose} className="text-gray-300 hover:text-white">&times;</button>
                </div>
                <div className="p-6 overflow-y-auto">
                    {children}
                </div>
                {footer && (
                    <div className="p-4 border-t border-gray-700 flex justify-end gap-3">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Modal;
