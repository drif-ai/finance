import React, { useState, useEffect, useMemo } from 'react';
import Card from '../components/Card';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, formatCurrency, getTodayDateString } from '../utils/helpers';
import type { Transaction, JournalEntry, Account } from '../types';
import * as XLSX from 'xlsx';

type TransactionFormData = {
    id?: string;
    date: string;
    ref: string;
    description: string;
    entries: Omit<JournalEntry, 'id' | 'transaction_id'>[];
};

export type TransactionPrefillData = {
    date: string;
    description: string;
    ref?: string;
    debitAccount?: { code: string, amount: number };
    creditAccount?: { code: string, amount: number };
}

export const TransactionForm: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    transactionToEdit?: Transaction | null;
    prefillData?: TransactionPrefillData | null;
    onSuccess?: (newTx: Transaction) => void;
}> = ({ isOpen, onClose, transactionToEdit, prefillData, onSuccess }) => {
    const { accounts, addTransaction, updateTransaction } = useData();
    const { profile } = useAuth();
    const [formData, setFormData] = useState<TransactionFormData>({
        date: getTodayDateString(),
        ref: '',
        description: '',
        entries: [
            { account_code: '', debit: 0, credit: 0 },
            { account_code: '', debit: 0, credit: 0 },
        ],
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const canEdit = profile?.role === 'admin';

    useEffect(() => {
        if (transactionToEdit) {
            setFormData({
                id: transactionToEdit.id,
                date: transactionToEdit.date,
                ref: transactionToEdit.ref,
                description: transactionToEdit.description,
                entries: transactionToEdit.entries.map(({ account_code, debit, credit }) => ({ account_code, debit, credit })),
            });
        } else if (prefillData) {
            const newEntries = [
                { account_code: '', debit: 0, credit: 0 },
                { account_code: '', debit: 0, credit: 0 },
            ];
            if (prefillData.debitAccount) {
                newEntries[0] = { account_code: prefillData.debitAccount.code, debit: prefillData.debitAccount.amount, credit: 0 };
            }
             if (prefillData.creditAccount) {
                const index = prefillData.debitAccount ? 1 : 0;
                newEntries[index] = { account_code: prefillData.creditAccount.code, debit: 0, credit: prefillData.creditAccount.amount };
            }
            
            setFormData({
                date: prefillData.date,
                ref: prefillData.ref || '',
                description: prefillData.description,
                entries: newEntries
            });
        } else {
            setFormData({
                date: getTodayDateString(),
                ref: '',
                description: '',
                entries: [
                    { account_code: '', debit: 0, credit: 0 },
                    { account_code: '', debit: 0, credit: 0 },
                ],
            });
        }
    }, [transactionToEdit, prefillData, isOpen]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleEntryChange = (index: number, field: keyof JournalEntry, value: string | number) => {
        const newEntries = [...formData.entries];
        const entry = { ...newEntries[index] };
    
        if (field === 'account_code') {
            entry.account_code = value as string;
        } else {
            const numValue = Number(value) || 0;
            if (field === 'debit' && numValue > 0) {
                entry.debit = numValue;
                entry.credit = 0;
            } else if (field === 'credit' && numValue > 0) {
                entry.credit = numValue;
                entry.debit = 0;
            } else {
                entry[field as 'debit' | 'credit'] = 0;
            }
        }
        newEntries[index] = entry;
        setFormData(prev => ({ ...prev, entries: newEntries }));
    };

    const addEntryRow = () => {
        setFormData(prev => ({
            ...prev,
            entries: [...prev.entries, { account_code: '', debit: 0, credit: 0 }],
        }));
    };

    const removeEntryRow = (index: number) => {
        if (formData.entries.length <= 2) return;
        setFormData(prev => ({
            ...prev,
            entries: prev.entries.filter((_, i) => i !== index),
        }));
    };

    const { totalDebit, totalCredit, isBalanced } = useMemo(() => {
        const totals = formData.entries.reduce((acc, entry) => {
            acc.debit += Number(entry.debit) || 0;
            acc.credit += Number(entry.credit) || 0;
            return acc;
        }, { debit: 0, credit: 0 });
        return {
            totalDebit: totals.debit,
            totalCredit: totals.credit,
            isBalanced: totals.debit > 0 && totals.debit === totals.credit,
        };
    }, [formData.entries]);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isBalanced) {
            alert('Total Debit harus sama dengan Total Kredit dan tidak boleh nol.');
            return;
        }
        
        setIsSubmitting(true);
        const { id, entries, ...transactionData } = formData;
        
        try {
            if (id) {
                 if (!canEdit) throw new Error("Anda tidak memiliki izin untuk mengedit transaksi.");
                await updateTransaction(id, transactionData);
            } else {
                const validEntries = entries.filter(e => e.account_code && (e.debit > 0 || e.credit > 0));
                const newTx = await addTransaction(transactionData, validEntries);
                onSuccess?.(newTx);
            }
            onClose();
        } catch (error: any) {
            console.error('Failed to save transaction:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const sortedAccounts = useMemo(() => [...accounts].sort((a, b) => a.code.localeCompare(b.code)), [accounts]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={transactionToEdit ? 'Edit Transaksi' : 'Buat Transaksi Baru'} size="xl">
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="md:col-span-1">
                        <label htmlFor="date" className="block text-sm font-medium text-gray-300 mb-1">Tanggal</label>
                        <input type="date" name="date" id="date" value={formData.date} onChange={handleInputChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2" required disabled={!canEdit && !!transactionToEdit} />
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="ref" className="block text-sm font-medium text-gray-300 mb-1">No. Referensi (Opsional)</label>
                        <input type="text" name="ref" id="ref" value={formData.ref} onChange={handleInputChange} placeholder="e.g., INV-00123" className="w-full bg-slate-700 border border-slate-600 rounded-md p-2" disabled={!canEdit && !!transactionToEdit} />
                    </div>
                </div>
                <div className="mb-6">
                    <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">Deskripsi</label>
                    <textarea name="description" id="description" value={formData.description} onChange={handleInputChange} rows={2} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2" required placeholder="e.g., Pembayaran tagihan listrik bulan Juni" disabled={!canEdit && !!transactionToEdit}></textarea>
                </div>

                <h4 className="text-lg font-semibold mb-2">Jurnal Entri</h4>
                 {transactionToEdit && !canEdit && <p className="text-xs text-yellow-400 mb-2">Mode lihat-saja. Entri tidak dapat diubah.</p>}
                <div className="space-y-2">
                    {formData.entries.map((entry, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-5">
                                <select value={entry.account_code} onChange={(e) => handleEntryChange(index, 'account_code', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-sm" disabled={!!transactionToEdit}>
                                    <option value="">Pilih Akun...</option>
                                    {sortedAccounts.map(acc => <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>)}
                                </select>
                            </div>
                            <div className="col-span-3">
                                <input type="number" placeholder="Debit" value={entry.debit || ''} onChange={(e) => handleEntryChange(index, 'debit', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-sm" disabled={!!transactionToEdit} />
                            </div>
                            <div className="col-span-3">
                                <input type="number" placeholder="Kredit" value={entry.credit || ''} onChange={(e) => handleEntryChange(index, 'credit', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-sm" disabled={!!transactionToEdit}/>
                            </div>
                            <div className="col-span-1 text-center">
                                {!transactionToEdit && formData.entries.length > 2 && (
                                    <button type="button" onClick={() => removeEntryRow(index)} className="text-red-400 hover:text-red-300">&times;</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                
                {!transactionToEdit && (
                    <button type="button" onClick={addEntryRow} className="mt-3 text-sm text-primary hover:underline">+ Tambah Baris</button>
                )}
                 {transactionToEdit && <p className="text-xs text-yellow-400 mt-2">Perubahan entri jurnal dinonaktifkan untuk menjaga integritas saldo akun.</p>}

                <div className="flex justify-between mt-6 p-3 bg-slate-900 rounded-lg">
                    <div className="text-right">
                        <p className="text-sm text-gray-400">Total Debit</p>
                        <p className="font-semibold text-lg">{formatCurrency(totalDebit)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-400">Total Kredit</p>
                        <p className="font-semibold text-lg">{formatCurrency(totalCredit)}</p>
                    </div>
                </div>
                 {!isBalanced && totalDebit + totalCredit > 0 && <p className="text-center text-red-400 mt-2 text-sm">Total Debit dan Kredit tidak seimbang.</p>}
                
                { (canEdit || !transactionToEdit) &&
                    <div className="mt-6 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="py-2 px-4 rounded-md bg-slate-600 hover:bg-slate-500">Batal</button>
                        <button type="submit" disabled={!isBalanced || isSubmitting} className="py-2 px-4 rounded-md bg-primary hover:bg-primary/80 disabled:bg-gray-500 disabled:cursor-not-allowed">
                            {isSubmitting ? 'Menyimpan...' : (transactionToEdit ? 'Simpan Perubahan' : 'Buat Transaksi')}
                        </button>
                    </div>
                }
            </form>
        </Modal>
    );
};

const ImportTransactionsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
}> = ({ isOpen, onClose }) => {
    const { accounts, addTransactionsBatch } = useData();
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            parseFile(selectedFile);
        }
    };

    const parseFile = (fileToParse: File) => {
        setIsProcessing(true);
        setError(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(worksheet);
                setParsedData(json);
            } catch (err) {
                setError("Gagal mem-parsing file. Pastikan formatnya benar.");
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsArrayBuffer(fileToParse);
    };

    const { transactionsToImport, validationError } = useMemo(() => {
        try {
            if (parsedData.length === 0) return { transactionsToImport: [], validationError: null };

            const grouped = new Map<string, any[]>();
            for (const row of parsedData) {
                const key = `${row['Tanggal']}-${row['Deskripsi']}-${row['Ref']}`;
                if (!grouped.has(key)) grouped.set(key, []);
                grouped.get(key)!.push(row);
            }

            const transactionsData: { transaction: Omit<Transaction, 'id' | 'entries'>; entries: Omit<JournalEntry, 'id' | 'transaction_id'>[] }[] = [];
            
            for (const [key, rows] of grouped.entries()) {
                let totalDebit = 0;
                let totalCredit = 0;
                const entries = rows.map(row => {
                    const debit = Number(row['Debit']) || 0;
                    const credit = Number(row['Kredit']) || 0;
                    totalDebit += debit;
                    totalCredit += credit;
                    if (!accounts.some(a => a.code === row['Kode Akun']?.toString())) {
                        throw new Error(`Akun dengan kode '${row['Kode Akun']}' tidak ditemukan.`);
                    }
                    return { account_code: row['Kode Akun']?.toString(), debit, credit };
                });
                
                if (Math.abs(totalDebit - totalCredit) > 0.01) {
                    throw new Error(`Transaksi "${rows[0]['Deskripsi']}" tidak seimbang (Debit: ${totalDebit}, Kredit: ${totalCredit}).`);
                }

                const date = new Date(rows[0]['Tanggal']);
                if (isNaN(date.getTime())) {
                    throw new Error(`Format tanggal tidak valid untuk "${rows[0]['Deskripsi']}".`);
                }

                transactionsData.push({
                    transaction: {
                        date: date.toISOString().split('T')[0],
                        description: rows[0]['Deskripsi'] || '',
                        ref: rows[0]['Ref'] || '',
                    },
                    entries,
                });
            }
            return { transactionsToImport: transactionsData, validationError: null };
        } catch (err: any) {
            return { transactionsToImport: [], validationError: err.message };
        }
    }, [parsedData, accounts]);

    const handleImport = async () => {
        if (validationError || transactionsToImport.length === 0) return;
        setIsProcessing(true);
        try {
            await addTransactionsBatch(transactionsToImport);
            alert(`${transactionsToImport.length} transaksi berhasil diimpor!`);
            handleClose();
        } catch (err: any) {
            setError(`Gagal mengimpor: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleDownloadTemplate = () => {
        const exampleData = [
            { 'Tanggal': '2023-10-26', 'Deskripsi': 'Pendapatan Jasa Konsultasi', 'Ref': 'INV-001', 'Kode Akun': '1200', 'Nama Akun': 'Bank', 'Debit': 5000000, 'Kredit': 0 },
            { 'Tanggal': '2023-10-26', 'Deskripsi': 'Pendapatan Jasa Konsultasi', 'Ref': 'INV-001', 'Kode Akun': '4100', 'Nama Akun': 'Pendapatan Jasa', 'Debit': 0, 'Kredit': 5000000 },
        ];
        const ws = XLSX.utils.json_to_sheet(exampleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Transaksi");
        XLSX.writeFile(wb, "Template_Impor_Transaksi.xlsx");
    };

    const handleClose = () => {
        setFile(null);
        setParsedData([]);
        setError(null);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Impor Transaksi Massal" size="xl">
            <div className="space-y-4">
                <p className="text-sm text-gray-400">Unggah file Excel (.xlsx) untuk mengimpor transaksi. Pastikan file Anda memiliki kolom: `Tanggal`, `Deskripsi`, `Ref`, `Kode Akun`, `Debit`, `Kredit`. Baris dengan Tanggal, Deskripsi, dan Ref yang sama akan dikelompokkan menjadi satu transaksi.</p>
                <button onClick={handleDownloadTemplate} className="w-full text-center py-2 px-4 rounded-md bg-slate-600 hover:bg-slate-500">Unduh Template</button>
                <input type="file" accept=".xlsx" onChange={handleFileChange} className="w-full p-2 bg-slate-700 rounded-md file:mr-4 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-primary file:text-white" />
                {isProcessing && <p>Memproses file...</p>}
                {error && <p className="text-red-400">{error}</p>}
                {validationError && <p className="text-red-400">{validationError}</p>}

                {parsedData.length > 0 && !validationError && (
                    <div>
                        <h4 className="font-semibold mb-2">Pratinjau Impor: {transactionsToImport.length} transaksi ditemukan</h4>
                        <div className="max-h-60 overflow-auto p-2 bg-slate-900 rounded-md text-xs">
                            <pre>{JSON.stringify(transactionsToImport, null, 2)}</pre>
                        </div>
                    </div>
                )}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                    <button onClick={handleClose} className="py-2 px-4 rounded-md bg-slate-600 hover:bg-slate-500">Batal</button>
                    <button onClick={handleImport} disabled={isProcessing || !!validationError || transactionsToImport.length === 0} className="py-2 px-4 rounded-md bg-primary hover:bg-primary/80 disabled:bg-gray-500">Impor Sekarang</button>
                </div>
            </div>
        </Modal>
    );
};


const Transactions: React.FC = () => {
    const { transactions, accounts, loading, error, deleteTransaction } = useData();
    const { profile } = useAuth();
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;
    
    const canCreate = profile?.role === 'admin' || profile?.role === 'staff';
    const canDelete = profile?.role === 'admin';
    const canEdit = profile?.role === 'admin';
    const canImport = profile?.role === 'admin';

    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = tx.description.toLowerCase().includes(searchLower) || (tx.ref && tx.ref.toLowerCase().includes(searchLower));
            const matchesStartDate = startDate ? tx.date >= startDate : true;
            const matchesEndDate = endDate ? tx.date <= endDate : true;
            return matchesSearch && matchesStartDate && matchesEndDate;
        });
    }, [transactions, searchTerm, startDate, endDate]);

    const paginatedTransactions = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredTransactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredTransactions, currentPage]);
    
    const handleExport = () => {
        const dataToExport = filteredTransactions.flatMap(tx => 
            tx.entries.map(entry => ({
                'Tanggal': formatDate(tx.date),
                'Deskripsi': tx.description,
                'Ref': tx.ref,
                'Kode Akun': entry.account_code,
                'Nama Akun': accounts.find(a => a.code === entry.account_code)?.name || '',
                'Debit': entry.debit,
                'Kredit': entry.credit,
            }))
        );

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Transaksi");
        XLSX.writeFile(wb, `Ekspor_Transaksi_${getTodayDateString()}.xlsx`);
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, startDate, endDate]);

    const handleOpenModal = (transaction?: Transaction) => {
        setEditingTransaction(transaction || null);
        setIsFormModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsFormModalOpen(false);
        setEditingTransaction(null);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Apakah Anda yakin ingin menghapus transaksi ini? Tindakan ini akan memperbarui saldo akun terkait dan tidak dapat diurungkan.')) {
            try {
                await deleteTransaction(id);
            } catch (err: any) {
                alert(`Gagal menghapus transaksi: ${err.message}`);
            }
        }
    };

    return (
        <Card>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-3">
                <h2 className="text-2xl md:text-3xl font-bold">Pencatatan Transaksi</h2>
                <div className="flex gap-2 flex-wrap justify-center">
                    {canImport && <button onClick={() => setIsImportModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg text-sm">Impor</button>}
                    <button onClick={handleExport} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg text-sm">Ekspor</button>
                    {canCreate && <button onClick={() => handleOpenModal()} className="bg-primary hover:bg-primary/80 text-white font-bold py-2 px-4 rounded-lg text-sm">+ Transaksi Baru</button>}
                </div>
            </div>

            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                     <label htmlFor="search" className="block text-sm font-medium text-gray-300 mb-1">Cari Transaksi</label>
                    <input id="search" type="text" placeholder="Deskripsi atau referensi..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2"/>
                </div>
                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="startDate" className="block text-sm font-medium text-gray-300 mb-1">Tanggal Mulai</label>
                        <input type="date" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2"/>
                    </div>
                     <div>
                        <label htmlFor="endDate" className="block text-sm font-medium text-gray-300 mb-1">Tanggal Akhir</label>
                        <input type="date" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2"/>
                    </div>
                </div>
            </div>

            {loading && transactions.length === 0 && <div className="text-center py-8">Memuat transaksi...</div>}
            {error && <div className="text-center py-8 text-red-400">Error: {error}</div>}

            {!loading && !error && (
            <>
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                        <thead>
                            <tr className="border-b border-gray-600">
                                <th className="text-left py-3 px-4">Tanggal</th>
                                <th className="text-left py-3 px-4">Deskripsi</th>
                                <th className="text-left py-3 px-4">Ref</th>
                                <th className="text-right py-3 px-4">Jumlah</th>
                                <th className="text-center py-3 px-4">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedTransactions.length > 0 ? (
                                paginatedTransactions.map(tx => (
                                    <tr key={tx.id} className="border-b border-gray-700 hover:bg-slate-800/50">
                                        <td className="py-3 px-4">{formatDate(tx.date)}</td>
                                        <td className="py-3 px-4">{tx.description}</td>
                                        <td className="py-3 px-4 text-gray-400">{tx.ref || '-'}</td>
                                        <td className="py-3 px-4 text-right font-mono">{formatCurrency(tx.entries.reduce((sum, entry) => sum + entry.debit, 0))}</td>
                                        <td className="py-3 px-4 text-center">
                                            <button onClick={() => handleOpenModal(tx)} className="text-blue-400 hover:underline text-sm mr-3">{canEdit ? 'Edit' : 'Lihat'}</button>
                                            {canDelete && <button onClick={() => handleDelete(tx.id!)} className="text-red-400 hover:underline text-sm">Hapus</button>}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="text-center text-gray-400 py-8">
                                        {transactions.length > 0 ? 'Tidak ada transaksi yang cocok dengan kriteria.' : "Belum ada transaksi."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="md:hidden space-y-3">
                    {paginatedTransactions.length > 0 ? paginatedTransactions.map(tx => (
                        <Card key={tx.id} className="!p-4">
                             <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-semibold">{tx.description}</p>
                                    <p className="text-sm text-gray-400">{formatDate(tx.date)} {tx.ref ? `• Ref: ${tx.ref}` : ''}</p>
                                </div>
                                <p className="font-mono font-semibold text-lg">{formatCurrency(tx.entries.reduce((sum, entry) => sum + entry.debit, 0))}</p>
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-700 flex justify-end space-x-4">
                                <button onClick={() => handleOpenModal(tx)} className="text-blue-400 hover:underline text-sm">{canEdit ? 'Edit' : 'Lihat'}</button>
                                {canDelete && <button onClick={() => handleDelete(tx.id!)} className="text-red-400 hover:underline text-sm">Hapus</button>}
                            </div>
                        </Card>
                    )) : (
                        <div className="text-center text-gray-400 py-8">
                            {transactions.length > 0 ? 'Tidak ada transaksi yang cocok.' : "Belum ada transaksi."}
                        </div>
                    )}
                </div>

                <Pagination
                    currentPage={currentPage}
                    totalItems={filteredTransactions.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={setCurrentPage}
                />
            </>
            )}
             <TransactionForm isOpen={isFormModalOpen} onClose={handleCloseModal} transactionToEdit={editingTransaction} />
             {canImport && <ImportTransactionsModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />}
        </Card>
    );
};

export default Transactions;