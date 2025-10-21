import React, { useState, useMemo, useRef } from 'react';
import Card from '../components/Card';
import { useData } from '../contexts/DataContext';
import { formatCurrency, formatDate } from '../utils/helpers';
import * as XLSX from 'xlsx';
// FIX: Changed to a named import for TransactionForm and specified TransactionPrefillData is a type. This resolves the props error.
import { TransactionForm, type TransactionPrefillData } from './Transactions';
import type { Transaction } from '../types';

type BankTransaction = {
    id: string; // a unique id for the session
    date: string;
    description: string;
    debit: number;
    credit: number;
};

type AppTransaction = {
    id: string;
    date: string;
    description: string;
    debit: number;
    credit: number;
};

type MatchStatus = 'unmatched' | 'matched';
type MatchedPair = { bankTxId: string; appTxId: string; };

const Reconciliation: React.FC = () => {
    const { accounts, transactions, loading, error } = useData();
    const [selectedAccountCode, setSelectedAccountCode] = useState<string>('');
    const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
    const [matchedPairs, setMatchedPairs] = useState<MatchedPair[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [prefillData, setPrefillData] = useState<TransactionPrefillData | null>(null);
    const [journalingBankTx, setJournalingBankTx] = useState<BankTransaction | null>(null);

    const bankAndCashAccounts = useMemo(() => {
        return accounts.filter(acc => ['1100', '1200'].includes(acc.code) || acc.name.toLowerCase().includes('bank') || acc.name.toLowerCase().includes('kas'))
            .sort((a, b) => a.code.localeCompare(b.code));
    }, [accounts]);

    const appTransactions = useMemo((): AppTransaction[] => {
        if (!selectedAccountCode) return [];
        return transactions
            .filter(tx => tx.entries.some(e => e.account_code === selectedAccountCode))
            .map(tx => {
                const entry = tx.entries.find(e => e.account_code === selectedAccountCode)!;
                return {
                    id: tx.id!,
                    date: tx.date,
                    description: tx.description,
                    debit: entry.debit,
                    credit: entry.credit,
                };
            }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [selectedAccountCode, transactions]);

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setImportError(null);
        setBankTransactions([]);
        setMatchedPairs([]);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = XLSX.utils.sheet_to_json(worksheet);

                if (json.length === 0) {
                    throw new Error("File Excel kosong atau format tidak dikenali.");
                }

                const importedTxs: BankTransaction[] = json.map((row, index) => {
                    // Check for required columns (case-insensitive)
                    const dateKey = Object.keys(row).find(k => k.toLowerCase() === 'tanggal');
                    const descKey = Object.keys(row).find(k => k.toLowerCase() === 'deskripsi' || k.toLowerCase() === 'keterangan');
                    const debitKey = Object.keys(row).find(k => k.toLowerCase() === 'debit');
                    const creditKey = Object.keys(row).find(k => k.toLowerCase() === 'kredit');

                    if (!dateKey || !descKey) {
                        throw new Error(`Baris ${index + 2} di Excel tidak memiliki kolom 'Tanggal' atau 'Deskripsi'.`);
                    }
                    
                    const date = new Date(row[dateKey]);
                     if (isNaN(date.getTime())) {
                         throw new Error(`Format tanggal tidak valid pada baris ${index + 2}: "${row[dateKey]}"`);
                     }

                    return {
                        id: `bank-${Date.now()}-${index}`,
                        date: date.toISOString().split('T')[0],
                        description: row[descKey]?.toString() || '',
                        debit: Number(row[debitKey]) || 0,
                        credit: Number(row[creditKey]) || 0,
                    };
                });
                setBankTransactions(importedTxs);
            } catch (err: any) {
                setImportError(`Gagal memproses file: ${err.message}`);
                console.error(err);
            } finally {
                setIsProcessing(false);
                if(fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleDownloadTemplate = () => {
        const exampleData = [
            { 'Tanggal': '2023-10-26', 'Deskripsi': 'Transfer dari Klien A', 'Debit': 5000000, 'Kredit': 0 },
            { 'Tanggal': '2023-10-27', 'Deskripsi': 'Pembayaran Tagihan Listrik', 'Debit': 0, 'Kredit': 750000 },
            { 'Tanggal': '2023-10-28', 'Deskripsi': 'Gaji Karyawan', 'Debit': 0, 'Kredit': 15000000 },
        ];
        
        const worksheet = XLSX.utils.json_to_sheet(exampleData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Mutasi Bank");

        // Set column widths for better readability
        worksheet['!cols'] = [
            { wch: 15 }, // Tanggal
            { wch: 40 }, // Deskripsi
            { wch: 20 }, // Debit
            { wch: 20 }, // Kredit
        ];

        XLSX.writeFile(workbook, "Template_Mutasi_Bank.xlsx");
    };

    const handleAutoMatch = () => {
        const newMatches: MatchedPair[] = [...matchedPairs];
        const unmatchedBankTxs = bankTransactions.filter(btx => !newMatches.some(p => p.bankTxId === btx.id));
        const unmatchedAppTxs = appTransactions.filter(atx => !newMatches.some(p => p.appTxId === atx.id));

        for (const bankTx of unmatchedBankTxs) {
            const potentialMatchIndex = unmatchedAppTxs.findIndex(appTx => 
                appTx.date === bankTx.date &&
                (appTx.debit === bankTx.debit && appTx.credit === bankTx.credit)
            );

            if (potentialMatchIndex !== -1) {
                const matchedAppTx = unmatchedAppTxs[potentialMatchIndex];
                newMatches.push({ bankTxId: bankTx.id, appTxId: matchedAppTx.id });
                // Remove from pool to prevent one-to-many matches
                unmatchedAppTxs.splice(potentialMatchIndex, 1);
            }
        }
        setMatchedPairs(newMatches);
    };

    const handleCreateJournal = (bankTx: BankTransaction) => {
        const prefill: TransactionPrefillData = {
            date: bankTx.date,
            description: `(Rekonsiliasi) ${bankTx.description}`,
            debitAccount: bankTx.credit > 0 ? undefined : { code: selectedAccountCode, amount: bankTx.debit },
            creditAccount: bankTx.debit > 0 ? undefined : { code: selectedAccountCode, amount: bankTx.credit },
        };
        setPrefillData(prefill);
        setJournalingBankTx(bankTx);
        setIsModalOpen(true);
    }
    
    const handleModalClose = () => {
        setIsModalOpen(false);
        setPrefillData(null);
        setJournalingBankTx(null);
    };

    const handleTransactionSuccess = (newTx: Transaction) => {
        if (journalingBankTx && newTx?.id) {
            setMatchedPairs(prev => [...prev, { bankTxId: journalingBankTx.id, appTxId: newTx.id! }]);
        }
    };

    const {unmatchedBank, unmatchedApp, matchedBank, matchedApp} = useMemo(() => {
        const matchedBankIds = new Set(matchedPairs.map(p => p.bankTxId));
        const matchedAppIds = new Set(matchedPairs.map(p => p.appTxId));
        return {
            unmatchedBank: bankTransactions.filter(tx => !matchedBankIds.has(tx.id)),
            unmatchedApp: appTransactions.filter(tx => !matchedAppIds.has(tx.id)),
            matchedBank: bankTransactions.filter(tx => matchedBankIds.has(tx.id)),
            matchedApp: appTransactions.filter(tx => matchedAppIds.has(tx.id)),
        }
    }, [bankTransactions, appTransactions, matchedPairs]);

    const renderTable = (title: string, items: (BankTransaction[] | AppTransaction[]), isBankTable: boolean = false) => (
        <Card className="flex-1 min-w-[400px]">
            <h3 className="text-lg font-semibold mb-3">{title} ({items.length})</h3>
            <div className="overflow-auto max-h-[400px]">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-600">
                            <th className="text-left py-2 px-2">Tgl</th>
                            <th className="text-left py-2 px-2">Deskripsi</th>
                            <th className="text-right py-2 px-2">Debit</th>
                            <th className="text-right py-2 px-2">Kredit</th>
                            {isBankTable && <th className="text-center py-2 px-2">Aksi</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {items.length > 0 ? items.map(tx => (
                            <tr key={tx.id} className="border-b border-gray-700">
                                <td className="py-2 px-2">{formatDate(tx.date)}</td>
                                <td className="py-2 px-2">{isBankTable ? (tx as BankTransaction).description : (tx as AppTransaction).description}</td>
                                <td className="py-2 px-2 text-right font-mono text-green-400">{tx.debit > 0 ? formatCurrency(tx.debit) : '-'}</td>
                                <td className="py-2 px-2 text-right font-mono text-red-400">{tx.credit > 0 ? formatCurrency(tx.credit) : '-'}</td>
                                {isBankTable && <td className="py-2 px-2 text-center">
                                    <button onClick={() => handleCreateJournal(tx as BankTransaction)} className="text-xs bg-secondary hover:bg-secondary/80 px-2 py-1 rounded">
                                        Buat Jurnal
                                    </button>
                                </td>}
                            </tr>
                        )) : (
                             <tr><td colSpan={isBankTable ? 5 : 4} className="text-center text-gray-400 py-6">Tidak ada data.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    );

    return (
        <Card>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Rekonsiliasi Bank</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-6 bg-slate-800/50 p-4 rounded-lg">
                <div className="md:col-span-1">
                    <label htmlFor="account-select" className="block text-sm font-medium text-gray-300 mb-1">Pilih Akun Bank/Kas</label>
                    <select 
                        id="account-select"
                        value={selectedAccountCode} 
                        onChange={e => {
                            setSelectedAccountCode(e.target.value);
                            setBankTransactions([]);
                            setMatchedPairs([]);
                        }}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-2"
                        disabled={loading}
                    >
                        <option value="">-- Pilih Akun --</option>
                        {bankAndCashAccounts.map(acc => (
                            <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>
                        ))}
                    </select>
                </div>
                <div className="md:col-span-2 flex flex-col sm:flex-row gap-2">
                    <input type="file" accept=".xlsx, .xls" onChange={handleFileImport} className="hidden" ref={fileInputRef} />
                    <button 
                        onClick={handleDownloadTemplate}
                        className="w-full sm:w-auto bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg"
                    >
                        Unduh Template
                    </button>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!selectedAccountCode || isProcessing}
                        className="w-full sm:flex-1 bg-primary hover:bg-primary/80 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? 'Memproses...' : 'Impor Mutasi Bank (.xlsx)'}
                    </button>
                </div>
                <div className="md:col-span-3 text-center">
                     <p className="text-xs text-gray-400 mt-1">Harap siapkan file Excel dengan kolom: Tanggal, Deskripsi, Debit, Kredit.</p>
                </div>
            </div>

            {importError && <div className="text-center p-4 my-4 text-red-400 bg-red-500/20 rounded-lg">{importError}</div>}
            
            {selectedAccountCode && bankTransactions.length > 0 && (
                <div className="flex justify-center mb-6">
                    <button 
                        onClick={handleAutoMatch}
                        disabled={isProcessing}
                        className="bg-accent hover:bg-accent/80 text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-500"
                    >
                        Auto-Match Transaksi
                    </button>
                </div>
            )}

            {selectedAccountCode && (
                <>
                    <div className="mb-6">
                        <h3 className="text-xl font-semibold mb-2">Belum Terekonsiliasi (Unmatched)</h3>
                        <div className="flex flex-col md:flex-row gap-4">
                            {renderTable("Mutasi Bank", unmatchedBank, true)}
                            {renderTable("Transaksi Aplikasi", unmatchedApp)}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xl font-semibold mb-2">Sudah Terekonsiliasi (Matched) - {matchedPairs.length} Pasang</h3>
                        <Card>
                            <div className="overflow-auto max-h-[300px]">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-600">
                                            <th className="text-left py-2 px-2">Tgl</th>
                                            <th className="text-left py-2 px-2">Deskripsi Bank</th>
                                            <th className="text-left py-2 px-2">Deskripsi Aplikasi</th>
                                            <th className="text-right py-2 px-2">Jumlah</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {matchedPairs.length > 0 ? matchedPairs.map(pair => {
                                            const bankTx = bankTransactions.find(t => t.id === pair.bankTxId);
                                            const appTx = appTransactions.find(t => t.id === pair.appTxId);
                                            if (!bankTx || !appTx) return null;
                                            return (
                                                <tr key={pair.bankTxId} className="border-b border-gray-700 bg-green-500/10">
                                                    <td className="py-2 px-2">{formatDate(bankTx.date)}</td>
                                                    <td className="py-2 px-2">{bankTx.description}</td>
                                                    <td className="py-2 px-2">{appTx.description}</td>
                                                    <td className="py-2 px-2 text-right font-mono">{formatCurrency(bankTx.debit > 0 ? bankTx.debit : bankTx.credit)}</td>
                                                </tr>
                                            )
                                        }) : (
                                             <tr><td colSpan={4} className="text-center text-gray-400 py-6">Belum ada transaksi yang cocok.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>
                </>
            )}

            {!selectedAccountCode && (
                 <div className="text-center text-gray-400 py-16">
                    <p className="text-lg">Silakan pilih akun untuk memulai rekonsiliasi.</p>
                </div>
            )}

            <TransactionForm 
                isOpen={isModalOpen}
                onClose={handleModalClose}
                prefillData={prefillData}
                onSuccess={handleTransactionSuccess}
            />

        </Card>
    );
};

export default Reconciliation;