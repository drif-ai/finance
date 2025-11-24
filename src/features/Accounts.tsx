
import React, { useState, useEffect, useMemo } from 'react';
import Card from '../components/Card';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, getTodayDateString } from '../utils/helpers';
import type { Account, AccountType, JournalEntry } from '../types';
import * as XLSX from 'xlsx';


const AccountForm: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    accountToEdit?: Account | null;
}> = ({ isOpen, onClose, accountToEdit }) => {
    const { addAccount, updateAccount, accounts } = useData();
    const { profile } = useAuth();
    const [formData, setFormData] = useState<Omit<Account, 'id'>>({
        code: '',
        name: '',
        type: 'Aset',
        balance: 0,
        description: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    
    const canEdit = profile?.role === 'admin';

    useEffect(() => {
        if (accountToEdit) {
            setFormData({
                code: accountToEdit.code,
                name: accountToEdit.name,
                type: accountToEdit.type,
                balance: accountToEdit.balance,
                description: accountToEdit.description,
            });
        } else {
            setFormData({
                code: '',
                name: '',
                type: 'Aset',
                balance: 0,
                description: '',
            });
        }
        setFormError(null);
    }, [accountToEdit, isOpen]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'balance') {
            setFormData(prev => ({ ...prev, balance: Number(value) || 0 }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        
        if (!accountToEdit && accounts.some(acc => acc.code === formData.code)) {
            setFormError(`Kode akun '${formData.code}' sudah digunakan.`);
            return;
        }

        setIsSubmitting(true);
        try {
            if (accountToEdit) {
                 if (!canEdit) throw new Error("Anda tidak memiliki izin untuk mengedit akun.");
                const { code, ...updates } = formData;
                await updateAccount(code, updates);
            } else {
                await addAccount(formData);
            }
            onClose();
        } catch (error: any) {
            console.error('Failed to save account:', error);
            setFormError(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const accountTypes: AccountType[] = ['Aset', 'Liabilitas', 'Modal', 'Pendapatan', 'Beban'];
    const formInputClasses = "w-full bg-slate-900 border border-slate-700 rounded-md p-2 focus:ring-1 focus:ring-primary focus:border-primary transition-colors";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={accountToEdit ? 'Edit Akun' : 'Buat Akun Baru'} size="lg">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="code" className="block text-sm font-medium text-gray-300 mb-1">Kode Akun</label>
                    <input type="text" name="code" id="code" value={formData.code} onChange={handleInputChange} className={formInputClasses} required disabled={!!accountToEdit} />
                </div>
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Nama Akun</label>
                    <input type="text" name="name" id="name" value={formData.name} onChange={handleInputChange} className={formInputClasses} required disabled={!canEdit && !!accountToEdit} />
                </div>
                <div>
                    <label htmlFor="type" className="block text-sm font-medium text-gray-300 mb-1">Tipe Akun</label>
                    <select name="type" id="type" value={formData.type} onChange={handleInputChange} className={formInputClasses} disabled={!canEdit && !!accountToEdit}>
                        {accountTypes.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">Deskripsi</label>
                    <textarea name="description" id="description" value={formData.description} onChange={handleInputChange} rows={3} className={formInputClasses} disabled={!canEdit && !!accountToEdit}></textarea>
                </div>
                <div>
                    <label htmlFor="balance" className="block text-sm font-medium text-gray-300 mb-1">Saldo Awal</label>
                    <input type="number" name="balance" id="balance" value={formData.balance} onChange={handleInputChange} className={formInputClasses} disabled={!!accountToEdit} />
                     <p className="text-xs text-gray-400 mt-1">Saldo awal hanya bisa diatur saat membuat akun baru.</p>
                </div>

                {formError && <p className="text-red-400 text-sm">{formError}</p>}
                
                {(canEdit || !accountToEdit) && (
                    <div className="mt-6 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="py-2 px-4 rounded-md bg-slate-600 hover:bg-slate-500 transition-colors">Batal</button>
                        <button type="submit" disabled={isSubmitting} className="py-2 px-4 rounded-md bg-secondary hover:bg-secondary/80 disabled:bg-gray-500 transition-colors">
                            {isSubmitting ? 'Menyimpan...' : (accountToEdit ? 'Simpan Perubahan' : 'Buat Akun')}
                        </button>
                    </div>
                )}
            </form>
        </Modal>
    );
};

const ImportAccountsModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const { addAccountsBatch, addTransaction, accounts } = useData();
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [openingBalanceDate, setOpeningBalanceDate] = useState(getTodayDateString());
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const accountTypes: AccountType[] = ['Aset', 'Liabilitas', 'Modal', 'Pendapatan', 'Beban'];

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    const json = XLSX.utils.sheet_to_json(worksheet);
                    setParsedData(json);
                    setError(null);
                } catch (err) {
                    setError("Gagal mem-parsing file. Pastikan formatnya benar.");
                }
            };
            reader.readAsArrayBuffer(selectedFile);
        }
    };

    const { accountsToImport, openingBalanceTransaction, validationError } = useMemo(() => {
        if (parsedData.length === 0) return { accountsToImport: [], openingBalanceTransaction: null, validationError: null };
        try {
            const newAccounts: Omit<Account, 'id'>[] = [];
            const entries: Omit<JournalEntry, 'id' | 'transaction_id'>[] = [];
            let totalDebit = 0;
            let totalCredit = 0;

            for (const row of parsedData) {
                const code = row['Kode']?.toString();
                const name = row['Nama']?.toString();
                const type = row['Tipe']?.toString() as AccountType;
                const balance = Number(row['Saldo Awal']) || 0;
                const description = row['Deskripsi']?.toString() || '';

                if (!code || !name || !type) throw new Error(`Baris tidak lengkap: ${JSON.stringify(row)}. Pastikan ada kolom 'Kode', 'Nama', dan 'Tipe'.`);
                if (accounts.some(a => a.code === code)) throw new Error(`Kode akun '${code}' sudah ada.`);
                if (newAccounts.some(a => a.code === code)) throw new Error(`Kode akun '${code}' duplikat di dalam file.`);
                if (!accountTypes.includes(type)) throw new Error(`Tipe akun tidak valid '${type}' untuk akun ${code}.`);

                newAccounts.push({ code, name, type, balance: 0, description });

                if (balance !== 0) {
                    if (type === 'Aset' || type === 'Beban') {
                        entries.push({ account_code: code, debit: balance, credit: 0 });
                        totalDebit += balance;
                    } else {
                        entries.push({ account_code: code, debit: 0, credit: balance });
                        totalCredit += balance;
                    }
                }
            }

            if (Math.abs(totalDebit - totalCredit) > 0.01) {
                const difference = totalDebit - totalCredit;
                if (difference > 0) { // debit > credit, need more credit
                    entries.push({ account_code: '3999', debit: 0, credit: difference });
                } else { // credit > debit, need more debit
                    entries.push({ account_code: '3999', debit: -difference, credit: 0 });
                }
            }
            
            const transaction = {
                date: openingBalanceDate,
                description: 'Saldo Awal dari Impor Akun',
                ref: 'IMPORT-SALDO-AWAL',
            };
            
            return { accountsToImport: newAccounts, openingBalanceTransaction: { transaction, entries }, validationError: null };
        } catch (err: any) {
            return { accountsToImport: [], openingBalanceTransaction: null, validationError: err.message };
        }
    }, [parsedData, accounts, openingBalanceDate]);
    
    const handleImport = async () => {
        if (validationError || accountsToImport.length === 0) return;
        setIsProcessing(true);
        try {
            await addAccountsBatch(accountsToImport);
            if (openingBalanceTransaction && openingBalanceTransaction.entries.length > 0) {
                await addTransaction(openingBalanceTransaction.transaction, openingBalanceTransaction.entries);
            }
            alert(`${accountsToImport.length} akun berhasil diimpor!`);
            handleClose();
        } catch (err: any) {
            setError(`Gagal mengimpor: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleDownloadTemplate = () => {
        const exampleData = [
            { 'Kode': '1110', 'Nama': 'Kas Kecil', 'Tipe': 'Aset', 'Saldo Awal': 1000000, 'Deskripsi': 'Kas kecil untuk operasional harian' },
            { 'Kode': '2110', 'Nama': 'Utang Kartu Kredit', 'Tipe': 'Liabilitas', 'Saldo Awal': 500000, 'Deskripsi': 'Tagihan kartu kredit bisnis' },
        ];
        const ws = XLSX.utils.json_to_sheet(exampleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Akun");
        XLSX.writeFile(wb, "Template_Impor_Akun.xlsx");
    };

    const handleClose = () => {
        setFile(null);
        setParsedData([]);
        setError(null);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Impor Akun Massal" size="xl">
            <div className="space-y-4">
                <p className="text-sm text-gray-400">Unggah file Excel (.xlsx) untuk mengimpor akun baru. Saldo awal yang diisi akan dicatat sebagai transaksi jurnal pada tanggal yang ditentukan.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button onClick={handleDownloadTemplate} className="w-full text-center py-2 px-4 rounded-md bg-slate-600 hover:bg-slate-500">Unduh Template</button>
                    <input type="file" accept=".xlsx" onChange={handleFileChange} className="w-full p-2 bg-slate-700 rounded-md file:mr-4 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-primary file:text-white" />
                </div>
                 <div>
                    <label htmlFor="openingBalanceDate" className="block text-sm font-medium text-gray-300 mb-1">Tanggal Saldo Awal</label>
                    <input type="date" id="openingBalanceDate" value={openingBalanceDate} onChange={e => setOpeningBalanceDate(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2" />
                </div>
                
                {isProcessing && <p>Memproses file...</p>}
                {error && <p className="text-red-400">{error}</p>}
                {validationError && <p className="text-red-400">{validationError}</p>}

                {accountsToImport.length > 0 && !validationError && (
                    <div>
                        <h4 className="font-semibold mb-2">Pratinjau Impor: {accountsToImport.length} akun baru akan dibuat.</h4>
                        <div className="max-h-40 overflow-auto p-2 bg-slate-900 rounded-md text-xs mb-2">
                            <pre>{JSON.stringify(accountsToImport, null, 2)}</pre>
                        </div>
                        {openingBalanceTransaction && openingBalanceTransaction.entries.length > 0 && (
                             <h4 className="font-semibold mb-2">Transaksi saldo awal akan dibuat dengan entri berikut:</h4>
                        )}
                        <div className="max-h-40 overflow-auto p-2 bg-slate-900 rounded-md text-xs">
                             <pre>{JSON.stringify(openingBalanceTransaction, null, 2)}</pre>
                        </div>
                    </div>
                )}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                    <button onClick={handleClose} className="py-2 px-4 rounded-md bg-slate-600 hover:bg-slate-500">Batal</button>
                    <button onClick={handleImport} disabled={isProcessing || !!validationError || accountsToImport.length === 0} className="py-2 px-4 rounded-md bg-primary hover:bg-primary/80 disabled:bg-gray-500">Impor Sekarang</button>
                </div>
            </div>
        </Modal>
    );
}

const Accounts: React.FC = () => {
    const { accounts, loading, error, deleteAccount, transactions } = useData();
    const { profile } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<AccountType | 'All'>('All');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;
    
    const canCreate = profile?.role === 'admin' || profile?.role === 'staff';
    const canDelete = profile?.role === 'admin';
    const canEdit = profile?.role === 'admin';
    const canImport = profile?.role === 'admin';

    // CALCULATE REAL-TIME BALANCES FROM TRANSACTIONS
    // This ensures consistency with Ledger and Reports features.
    const accountBalances = useMemo(() => {
        const balances = new Map<string, number>();
        // Initialize with 0
        accounts.forEach(acc => balances.set(acc.code, 0));

        // Sum all transactions
        transactions.forEach(tx => {
            tx.entries.forEach(entry => {
                const current = balances.get(entry.account_code) || 0;
                const account = accounts.find(a => a.code === entry.account_code);
                
                if (account) {
                    // Logic must match Ledger.tsx logic
                    const isContraAsset = account.type === 'Aset' && account.name.toLowerCase().includes('akumulasi');
                    // Normal Debit: Assets (non-contra) and Expenses
                    const isDebitNormal = (account.type === 'Aset' || account.type === 'Beban') && !isContraAsset;

                    const change = isDebitNormal 
                        ? (entry.debit - entry.credit) 
                        : (entry.credit - entry.debit);
                    
                    balances.set(entry.account_code, current + change);
                }
            });
        });
        return balances;
    }, [accounts, transactions]);

    const handleOpenModal = (account?: Account) => {
        setEditingAccount(account || null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingAccount(null);
    };

    const handleDelete = async (account: Account) => {
        // Use calculated balance for check
        const currentBalance = accountBalances.get(account.code) || 0;
        
        if (currentBalance !== 0) {
            alert("Tidak dapat menghapus akun dengan saldo yang tidak nol. Harap transfer saldo ke akun lain terlebih dahulu.");
            return;
        }

        if (window.confirm(`Apakah Anda yakin ingin menghapus akun '${account.code} - ${account.name}'?`)) {
            try {
                await deleteAccount(account.code);
            } catch (err: any) {
                alert(`Gagal menghapus akun: ${err.message}`);
            }
        }
    };
    
    const filteredAccounts = useMemo(() => {
        return accounts
            .filter(acc => {
                const searchLower = searchTerm.toLowerCase();
                const matchesSearch = acc.name.toLowerCase().includes(searchLower) || acc.code.toLowerCase().includes(searchLower);
                const matchesType = filterType === 'All' ? true : acc.type === filterType;
                return matchesSearch && matchesType;
            })
            .sort((a, b) => a.code.localeCompare(b.code));
    }, [accounts, searchTerm, filterType]);

    const paginatedAccounts = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredAccounts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredAccounts, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterType]);

    const accountTypes: AccountType[] = ['Aset', 'Liabilitas', 'Modal', 'Pendapatan', 'Beban'];

    return (
        <Card>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-3">
                <h2 className="text-2xl md:text-3xl font-bold">Bagan Akun (Chart of Accounts)</h2>
                <div className="flex gap-2 flex-wrap justify-center">
                    {canImport && <button onClick={() => setIsImportModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg text-sm">Impor Akun</button>}
                    {canCreate && <button onClick={() => handleOpenModal()} className="bg-primary hover:bg-primary/80 text-white font-bold py-2 px-4 rounded-lg text-sm">
                        + Akun Baru
                    </button>}
                </div>
            </div>
            
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                    type="text"
                    placeholder="Cari nama atau kode akun..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-md p-2"
                />
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as AccountType | 'All')}
                    className="w-full bg-slate-700 border border-slate-600 rounded-md p-2"
                >
                    <option value="All">Semua Tipe Akun</option>
                    {accountTypes.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
            </div>

            {loading && <div className="text-center py-8">Memuat daftar akun...</div>}
            {error && <div className="text-center py-8 text-red-400">Error: {error}</div>}

            {!loading && !error && (
                <>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                        <thead>
                            <tr className="border-b border-gray-600">
                                <th className="text-left py-3 px-4">Kode</th>
                                <th className="text-left py-3 px-4">Nama Akun</th>
                                <th className="text-left py-3 px-4">Tipe</th>
                                <th className="text-right py-3 px-4">Saldo</th>
                                <th className="text-center py-3 px-4">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedAccounts.length > 0 ? (
                                paginatedAccounts.map(acc => {
                                    const currentBalance = accountBalances.get(acc.code) || 0;
                                    return (
                                        <tr key={acc.code} className="border-b border-gray-700 hover:bg-slate-800/50">
                                            <td className="py-3 px-4 font-mono">{acc.code}</td>
                                            <td className="py-3 px-4">{acc.name}</td>
                                            <td className="py-3 px-4 text-gray-300">{acc.type}</td>
                                            <td className="py-3 px-4 text-right font-mono">{formatCurrency(currentBalance)}</td>
                                            <td className="py-3 px-4 text-center">
                                                <button onClick={() => handleOpenModal(acc)} className="text-blue-400 hover:underline text-sm mr-3">{canEdit ? 'Edit' : 'Lihat'}</button>
                                                {canDelete && <button
                                                    onClick={() => handleDelete(acc)}
                                                    className={`text-sm ${currentBalance !== 0 ? 'text-gray-500 cursor-not-allowed' : 'text-red-400 hover:underline'}`}
                                                    title={currentBalance !== 0 ? "Tidak bisa dihapus karena saldo tidak nol" : "Hapus akun"}
                                                    disabled={currentBalance !== 0}
                                                >
                                                    Hapus
                                                </button>}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="text-center text-gray-400 py-8">
                                        {accounts.length > 0 ? 'Tidak ada akun yang cocok dengan kriteria.' : "Belum ada akun. Klik 'Akun Baru' untuk memulai."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <Pagination 
                    currentPage={currentPage}
                    totalItems={filteredAccounts.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={setCurrentPage}
                />
            </>
            )}
            <AccountForm isOpen={isModalOpen} onClose={handleCloseModal} accountToEdit={editingAccount} />
            {canImport && <ImportAccountsModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />}
        </Card>
    );
};

export default Accounts;
