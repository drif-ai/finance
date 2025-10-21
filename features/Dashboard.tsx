import React, { useState, useMemo } from 'react';
import Card from '../components/Card';
import { useData } from '../contexts/DataContext';
import { formatCurrency, formatDate, calculatePeriodFinancials } from '../utils/helpers';
import type { Transaction, Account } from '../types';

// Helper to get start and end of the current year
const getYearRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    const end = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
    return { start, end };
};


const SummaryCard: React.FC<{ title: string; value: number; icon: string; color: string }> = ({ title, value, icon, color }) => {
    const colorClasses = {
        green: 'text-green-400 bg-green-500/20',
        red: 'text-red-400 bg-red-500/20',
        blue: 'text-blue-400 bg-blue-500/20',
        purple: 'text-purple-400 bg-purple-500/20',
    };

    return (
        <Card>
            <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                    <p className="text-gray-300 text-xs md:text-sm">{title}</p>
                    <p className={`text-lg md:text-2xl font-bold ${colorClasses[color]?.split(' ')[0]} truncate`}>{formatCurrency(value)}</p>
                </div>
                <div className={`w-10 h-10 md:w-12 md:h-12 ${colorClasses[color]?.split(' ')[1]} rounded-lg flex items-center justify-center ml-3`}>
                    <span className={`text-lg md:text-xl ${colorClasses[color]?.split(' ')[0]}`}>{icon}</span>
                </div>
            </div>
        </Card>
    );
};

const RecentTransactions: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
    const recentTxs = transactions.slice(0, 5);
    return(
    <Card>
        <h3 className="text-lg md:text-xl font-semibold mb-4">Transaksi Terbaru (dalam Periode)</h3>
        <div className="md:hidden space-y-3">
            {recentTxs.length > 0 ? recentTxs.map(tx => (
                <div key={tx.id} className="p-3 bg-slate-800/50 rounded-lg">
                    <div className="flex justify-between items-center">
                        <p className="text-sm flex-1 truncate pr-2">{tx.description}</p>
                        <p className="font-mono text-base font-semibold">{formatCurrency(tx.entries.reduce((sum, entry) => sum + entry.debit, 0))}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(tx.date)}</p>
                </div>
            )) : (
                <div className="text-center text-gray-400 py-6">Belum ada transaksi pada periode ini.</div>
            )}
        </div>
        <div className="hidden md:block overflow-x-auto -mx-4 md:mx-0">
             <table className="w-full min-w-[600px]">
                <thead>
                    <tr className="border-b border-gray-600">
                        <th className="text-left py-2 md:py-3 px-2 md:px-4 text-sm md:text-base">Tanggal</th>
                        <th className="text-left py-2 md:py-3 px-2 md:px-4 text-sm md:text-base">Deskripsi</th>
                        <th className="text-right py-2 md:py-3 px-2 md:px-4 text-sm md:text-base">Jumlah</th>
                    </tr>
                </thead>
                <tbody>
                    {recentTxs.length > 0 ? (
                        recentTxs.map(tx => (
                            <tr key={tx.id} className="border-b border-gray-700 last:border-b-0">
                                <td className="py-2 md:py-3 px-2 md:px-4 text-gray-300 text-sm md:text-base">{formatDate(tx.date)}</td>
                                <td className="py-2 md:py-3 px-2 md:px-4 text-gray-300 text-sm md:text-base">{tx.description}</td>
                                <td className="py-2 md:py-3 px-2 md:px-4 text-right text-sm md:text-base font-mono">
                                    {formatCurrency(tx.entries.reduce((sum, entry) => sum + entry.debit, 0))}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr className="border-b border-gray-700">
                            <td className="py-3 px-4 text-gray-300 text-center" colSpan={3}>Belum ada transaksi pada periode ini.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </Card>
)};

const ComparisonChart: React.FC<{ startData: any, endData: any }> = ({ startData, endData }) => {
    const items = [
        { label: 'Aset', start: startData.totalAssets, end: endData.totalAssets, color: 'bg-green-500' },
        { label: 'Liabilitas', start: startData.totalLiabilities, end: endData.totalLiabilities, color: 'bg-red-500' },
        { label: 'Modal', start: startData.totalEquity, end: endData.totalEquity, color: 'bg-blue-500' },
    ];
    
    const maxValue = Math.max(...items.flatMap(i => [i.start, i.end]));

    return (
        <Card>
            <h3 className="text-lg md:text-xl font-semibold mb-4">Grafik Komparasi Periode</h3>
            <div className="space-y-4">
                {items.map(item => {
                    const startPercentage = maxValue > 0 ? (item.start / maxValue) * 100 : 0;
                    const endPercentage = maxValue > 0 ? (item.end / maxValue) * 100 : 0;
                    return (
                        <div key={item.label}>
                            <div className="flex justify-between items-center text-sm mb-1">
                                <span className="font-semibold">{item.label}</span>
                                <span className="text-gray-400">
                                    {formatCurrency(item.start)} &rarr; {formatCurrency(item.end)}
                                </span>
                            </div>
                            <div className="space-y-1.5">
                                <div className="w-full bg-slate-700 rounded-full h-3">
                                    <div className="bg-slate-500 h-3 rounded-full" style={{ width: `${startPercentage}%` }} title={`Awal: ${formatCurrency(item.start)}`}></div>
                                </div>
                                <div className="w-full bg-slate-700 rounded-full h-3">
                                    <div className={`${item.color} h-3 rounded-full`} style={{ width: `${endPercentage}%` }} title={`Akhir: ${formatCurrency(item.end)}`}></div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
             <div className="flex justify-end text-xs mt-4 space-x-4">
                <span className="flex items-center"><div className="w-3 h-3 rounded-full bg-slate-500 mr-1.5"></div> Awal Periode</span>
                <span className="flex items-center"><div className="w-3 h-3 rounded-full bg-green-500 mr-1.5"></div> Akhir Periode</span>
            </div>
        </Card>
    )
}

const Dashboard: React.FC = () => {
    const { accounts, transactions, loading, error } = useData();
    const [period, setPeriod] = useState(getYearRange());

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPeriod(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const financialData = useMemo(() => {
        if (loading || !period.start || !period.end || period.start > period.end) return null;
        
        const endData = calculatePeriodFinancials(accounts, transactions, { start: period.start, end: period.end });

        const prevDay = new Date(period.start);
        prevDay.setDate(prevDay.getDate() - 1);
        const startOfPeriodEnd = prevDay.toISOString().split('T')[0];

        // We assume the year started at 0 for simplicity of calculation for "startData"
        const startData = calculatePeriodFinancials(accounts, transactions, { start: '1970-01-01', end: startOfPeriodEnd });

        return { startData, endData };
    }, [accounts, transactions, period, loading]);

    if (loading && accounts.length === 0) return <div className="text-center p-8">Loading dashboard data...</div>;
    if (error) return <div className="text-center p-8 text-red-400">Error: {error}</div>;

    const periodTransactions = transactions.filter(tx => tx.date >= period.start && tx.date <= period.end);

    return (
        <div>
            <div className="mb-6 p-4 bg-slate-800/50 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <h3 className="md:col-span-3 text-lg font-semibold">Filter Dashboard</h3>
                <div className="md:col-span-1">
                    <label htmlFor="start" className="block text-sm font-medium text-gray-300 mb-1">Periode Mulai</label>
                    <input type="date" name="start" id="start" value={period.start} onChange={handleDateChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2" />
                </div>
                <div className="md:col-span-1">
                    <label htmlFor="end" className="block text-sm font-medium text-gray-300 mb-1">Periode Selesai</label>
                    <input type="date" name="end" id="end" value={period.end} onChange={handleDateChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2" />
                </div>
            </div>

            {financialData ? (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
                        <SummaryCard title="Total Aset (Akhir)" value={financialData.endData.totalAssets} icon="💰" color="green" />
                        <SummaryCard title="Total Liabilitas (Akhir)" value={financialData.endData.totalLiabilities} icon="📊" color="red" />
                        <SummaryCard title="Modal (Akhir)" value={financialData.endData.totalEquityWithPL} icon="🏦" color="blue" />
                        <SummaryCard title="Laba/Rugi Periode" value={financialData.endData.netIncome} icon="📈" color="purple" />
                    </div>
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                        <ComparisonChart startData={financialData.startData} endData={financialData.endData} />
                        <RecentTransactions transactions={periodTransactions} />
                    </div>
                </>
            ) : (
                <div className="text-center py-8 text-yellow-400">Harap pilih rentang tanggal yang valid untuk menampilkan data.</div>
            )}
        </div>
    );
};

export default Dashboard;