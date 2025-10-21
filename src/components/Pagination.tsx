import React from 'react';

interface PaginationProps {
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalItems, itemsPerPage, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (totalPages <= 1) {
        return null;
    }

    const handlePrevious = () => {
        if (currentPage > 1) {
            onPageChange(currentPage - 1);
        }
    };

    const handleNext = () => {
        if (currentPage < totalPages) {
            onPageChange(currentPage + 1);
        }
    };

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div className="flex flex-col md:flex-row items-center justify-between mt-6 text-sm">
            <p className="text-gray-400 mb-2 md:mb-0">
                Menampilkan {startItem} - {endItem} dari {totalItems} entri
            </p>
            <div className="flex items-center space-x-2">
                <button
                    onClick={handlePrevious}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    &larr; Sebelumnya
                </button>
                <span className="px-3 py-1.5 text-gray-300">
                    Halaman {currentPage} dari {totalPages}
                </span>
                <button
                    onClick={handleNext}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Berikutnya &rarr;
                </button>
            </div>
        </div>
    );
};

export default Pagination;
