import React, { useState, useMemo, useEffect } from 'react';
import Card from '../components/Card';
import Pagination from '../components/Pagination';
import { useData } from '../contexts/DataContext';
import { formatCurrency, formatDate } from '../utils/helpers';
import type { JournalEntry } from '../types';

interface LedgerEntry extends JournalEntry {
    date: string;
    description: string;
    ref: string;
    running_balance: number;
}

const Ledger: React.FC = () => {
    const { accounts, transactions, loading, error, companySettings } = useData();
    const [selectedAccountCode, setSelectedAccountCode] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 15;


    const sortedAccounts = useMemo(() => {
        return [...accounts].sort((a, b) => a.code.localeCompare(b.code));
    }, [accounts]);

    const { ledgerEntries, selectedAccount } = useMemo(() => {
        if (!selectedAccountCode) {
            return { ledgerEntries: [], selectedAccount: null };
        }

        const account = accounts.find(acc => acc.code === selectedAccountCode);
        if (!account) {
            return { ledgerEntries: [], selectedAccount: null };
        }
        
        const relevantTransactions = transactions
            .filter(tx => tx.entries.some(e => e.account_code === selectedAccountCode))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let runningBalance = account.balance;

        const entries: LedgerEntry[] = [];
        const reversedTransactions = [...relevantTransactions].reverse();

        for (const tx of reversedTransactions) {
            const entry = tx.entries.find(e => e.account_code === selectedAccountCode);
            if (entry) {
                const change = entry.debit - entry.credit;
                const isContraAsset = account.type === 'Aset' && account.name.toLowerCase().includes('akumulasi penyusutan');
                
                // Hitung saldo sebelum transaksi ini dengan membalikkan logikanya
                const balanceBeforeThisTx = ((account.type === 'Aset' || account.type === 'Beban') && !isContraAsset)
                    ? runningBalance - change // Balikkan akun dengan saldo normal Debit
                    : runningBalance + change; // Balikkan akun dengan saldo normal Kredit (termasuk kontra-aset)
                
                entries.unshift({
                    ...entry,
                    date: tx.date,
                    description: tx.description,
                    ref: tx.ref,
                    running_balance: runningBalance,
                });

                runningBalance = balanceBeforeThisTx;
            }
        }

        const filteredEntries = entries.filter(entry => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = entry.description.toLowerCase().includes(searchLower) || (entry.ref && entry.ref.toLowerCase().includes(searchLower));
            const matchesStartDate = startDate ? entry.date >= startDate : true;
            const matchesEndDate = endDate ? entry.date <= endDate : true;
            return matchesSearch && matchesStartDate && matchesEndDate;
        });

        return { ledgerEntries: filteredEntries, selectedAccount: account };
    }, [selectedAccountCode, accounts, transactions, searchTerm, startDate, endDate]);

    const paginatedLedgerEntries = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return ledgerEntries.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [ledgerEntries, currentPage]);
    
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, startDate, endDate, selectedAccountCode]);
    
    const handlePrint = () => {
        window.print();
    };

    const periodText = useMemo(() => {
        if (startDate && endDate) {
            return `Untuk Periode ${formatDate(startDate)} s/d ${formatDate(endDate)}`;
        } else if (startDate) {
            return `Mulai dari ${formatDate(startDate)}`;
        } else if (endDate) {
            return `Sampai dengan ${formatDate(endDate)}`;
        }
        return 'Seluruh Periode';
    }, [startDate, endDate]);

    return (
        <div className="printable-area">
            <Card>
                <div className="print-header hidden">
                    {selectedAccount && (
                        <>
                            <h1>{companySettings.name}</h1>
                            <h2>Buku Besar: {selectedAccount.name} ({selectedAccount.code})</h2>
                            <p>{periodText}</p>
                        </>
                    )}
                </div>

                <h2 className="text-2xl md:text-3xl font-bold mb-4 no-print">Buku Besar</h2>
                
                <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end no-print">
                    <div className="lg:col-span-4">
                        <label htmlFor="account-select" className="block text-sm font-medium text-gray-300 mb-1">Pilih Akun</label>
                        <select 
                            id="account-select"
                            value={selectedAccountCode} 
                            onChange={e => setSelectedAccountCode(e.target.value)}
                            className="w-full bg-slate-700 border border-slate-600 rounded-md p-2"
                        >
                            <option value="">-- Tampilkan Buku Besar untuk --</option>
                            {sortedAccounts.map(acc => (
                                <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="lg:col-span-1">
                        <label htmlFor="search" className="block text-sm font-medium text-gray-300 mb-1">Cari Deskripsi/Ref</label>
                        <input id="search" type="text" placeholder="Cari..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2" disabled={!selectedAccountCode}/>
                    </div>
                    <div>
                        <label htmlFor="startDate" className="block text-sm font-medium text-gray-300 mb-1">Tanggal Mulai</label>
                        <input type="date" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2" disabled={!selectedAccountCode}/>
                    </div>
                    <div>
                        <label htmlFor="endDate" className="block text-sm font-medium text-gray-300 mb-1">Tanggal Akhir</label>
                        <input type="date" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2" disabled={!selectedAccountCode}/>
                    </div>
                    <div>
                        <button onClick={handlePrint} className="bg-accent hover:bg-accent/80 text-white font-bold py-2 px-4 rounded-lg w-full" disabled={!selectedAccountCode}>Cetak</button>
                    </div>
                </div>

                {loading && <p className="no-print">Memuat data...</p>}
                {error && <p className="text-red-400 no-print">Error: {error}</p>}

                {!loading && !error && selectedAccount && (
                <>
                    <Card className="mb-6 !bg-slate-900/50">
                        <div className="flex flex-col md:flex-row justify-between md:items-center">
                            <div>
                                <h3 className="text-xl font-semibold">{selectedAccount.name} ({selectedAccount.code})</h3>
                                <p className="text-gray-400">{selectedAccount.type}</p>
                            </div>
                            <div className="text-left md:text-right mt-2 md:mt-0">
                                <p className="text-gray-400 text-sm">Saldo Akhir (Saat Ini)</p>
                                <p className="text-2xl font-bold">{formatCurrency(selectedAccount.balance)}</p>
                            </div>
                        </div>
                    </Card>
                    
                    {/* Desktop Table */}
                    <div className="overflow-x-auto hidden md:block">
                        <table className="w-full min-w-[800px]">
                            <thead>
                                <tr className="border-b border-gray-600">
                                    <th className="text-left py-3 px-4">Tanggal</th>
                                    <th className="text-left py-3 px-4">Deskripsi</th>
                                    <th className="text-left py-3 px-4">Ref</th>
                                    <th className="text-right py-3 px-4">Debit</th>
                                    <th className="text-right py-3 px-4">Kredit</th>
                                    <th className="text-right py-3 px-4">Saldo Berjalan</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedLedgerEntries.length > 0 ? (
                                    paginatedLedgerEntries.map((entry, index) => (
                                        <tr key={`${entry.transaction_id}-${index}`} className="border-b border-gray-700 hover:bg-slate-800/50">
                                            <td className="py-3 px-4">{formatDate(entry.date)}</td>
                                            <td className="py-3 px-4">{entry.description}</td>
                                            <td className="py-3 px-4 text-gray-400">{entry.ref || '-'}</td>
                                            <td className="py-3 px-4 text-right font-mono text-green-400">{entry.debit > 0 ? formatCurrency(entry.debit) : '-'}</td>
                                            <td className="py-3 px-4 text-right font-mono text-red-400">{entry.credit > 0 ? formatCurrency(entry.credit) : '-'}</td>
                                            <td className="py-3 px-4 text-right font-mono">{formatCurrency(entry.running_balance)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="text-center text-gray-400 py-8">
                                            Tidak ada transaksi untuk akun ini pada periode atau kriteria yang dipilih.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-3">
                        {paginatedLedgerEntries.length > 0 ? paginatedLedgerEntries.map((entry, index) => (
                            <Card key={`${entry.transaction_id}-${index}`} className="!p-3">
                                <p className="font-semibold">{entry.description}</p>
                                <p className="text-xs text-gray-400">{formatDate(entry.date)} {entry.ref ? `• Ref: ${entry.ref}` : ''}</p>
                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-700">
                                    <div className="flex space-x-4">
                                        <p><span className="text-green-400 font-mono">{entry.debit > 0 ? formatCurrency(entry.debit) : '-'}</span></p>
                                        <p><span className="text-red-400 font-mono">{entry.credit > 0 ? formatCurrency(entry.credit) : '-'}</span></p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-gray-400">Saldo</p>
                                        <p className="font-mono font-semibold">{formatCurrency(entry.running_balance)}</p>
                                    </div>
                                </div>
                            </Card>
                        )) : (
                           <div className="text-center text-gray-400 py-8">Tidak ada transaksi yang cocok.</div>
                        )}
                    </div>

                    <Pagination 
                        currentPage={currentPage}
                        totalItems={ledgerEntries.length}
                        itemsPerPage={ITEMS_PER_PAGE}
                        onPageChange={setCurrentPage}
                    />
                </>
                )}
                
                {!loading && !selectedAccountCode && (
                    <div className="text-center text-gray-400 py-16 no-print">
                        <p className="text-lg">Silakan pilih akun untuk melihat buku besarnya.</p>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default Ledger;