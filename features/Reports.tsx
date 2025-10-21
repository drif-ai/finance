import React, { useState, useMemo } from 'react';
import Card from '../components/Card';
import { useData } from '../contexts/DataContext';
import { formatCurrency, formatDate, calculatePeriodFinancials, subtractMonths, subtractYears } from '../utils/helpers';
import type { Account, Transaction } from '../types';

// Helper to get start and end of the current year
const getYearRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    const end = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
    return { start, end };
};

const ReportRow: React.FC<{ label: string; amount?: number; isTotal?: boolean; indent?: boolean; isHeader?: boolean }> = ({ label, amount, isTotal = false, indent = false, isHeader = false }) => (
    <div className={`flex justify-between py-2 ${isTotal ? 'border-t border-gray-600 mt-2 pt-2 font-bold' : isHeader ? '' : 'border-b border-gray-800'} ${indent ? 'pl-6' : ''}`}>
        <span className={`${isTotal ? 'text-white' : 'text-gray-300'} ${isHeader ? 'font-bold text-lg' : ''}`}>{label}</span>
        {amount !== undefined && <span className={`font-mono ${isHeader ? 'font-bold text-lg' : ''}`}>{isHeader ? '' : formatCurrency(amount)}</span>}
    </div>
);

type FinancialData = ReturnType<typeof calculatePeriodFinancials>;

const IncomeStatement: React.FC<{ data: FinancialData, period: { start: string, end: string } }> = ({ data, period }) => {
    if (!data) return null;
    const { revenues, totalRevenue, expenses, totalExpense, netIncome } = data;
    return (
        <div>
            <h3 className="text-xl font-semibold mb-2">Laporan Laba Rugi</h3>
            <p className="text-sm text-gray-400 mb-4">Untuk Periode {formatDate(period.start)} s/d {formatDate(period.end)}</p>

            <div className="space-y-4">
                <div>
                    <ReportRow label="Pendapatan" isHeader />
                    {revenues.map(acc => <ReportRow key={acc.code} label={acc.name} amount={acc.balance} indent />)}
                    <ReportRow label="Total Pendapatan" amount={totalRevenue} isTotal />
                </div>
                <div>
                    <ReportRow label="Beban" isHeader />
                    {expenses.map(acc => <ReportRow key={acc.code} label={acc.name} amount={acc.balance} indent />)}
                    <ReportRow label="Total Beban" amount={totalExpense} isTotal />
                </div>
                <div className="bg-slate-900/50 p-4 rounded-lg">
                     <ReportRow label="Laba (Rugi) Bersih" amount={netIncome} isTotal />
                </div>
            </div>
        </div>
    );
};

const BalanceSheet: React.FC<{ data: FinancialData, period: { end: string } }> = ({ data, period }) => {
    if (!data) return null;
    const { assets, totalAssets, liabilities, totalLiabilities, equityWithPL, totalEquityWithPL, totalLiabilitiesAndEquity, isBalanced } = data;

    return (
        <div>
            <h3 className="text-xl font-semibold mb-2">Neraca</h3>
             <p className="text-sm text-gray-400 mb-4">Per {formatDate(period.end)}</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                    <h4 className="font-bold text-lg mb-2 border-b border-gray-600 pb-2">Aset</h4>
                    {assets.map(acc => <ReportRow key={acc.code} label={acc.name} amount={acc.balance} />)}
                    <ReportRow label="Total Aset" amount={totalAssets} isTotal />
                </div>
                <div>
                    <div className="mb-6">
                        <h4 className="font-bold text-lg mb-2 border-b border-gray-600 pb-2">Liabilitas</h4>
                        {liabilities.map(acc => <ReportRow key={acc.code} label={acc.name} amount={acc.balance} />)}
                        <ReportRow label="Total Liabilitas" amount={totalLiabilities} isTotal />
                    </div>
                     <div>
                        <h4 className="font-bold text-lg mb-2 border-b border-gray-600 pb-2">Modal</h4>
                        {equityWithPL.map(acc => <ReportRow key={acc.code} label={acc.name} amount={acc.balance} />)}
                        <ReportRow label="Total Modal" amount={totalEquityWithPL} isTotal />
                    </div>
                    <div className="mt-6">
                         <ReportRow label="Total Liabilitas dan Modal" amount={totalLiabilitiesAndEquity} isTotal />
                    </div>
                </div>
            </div>
            <div className={`mt-8 p-4 rounded-lg text-center ${isBalanced ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                <p className="font-bold">{isBalanced ? 'Seimbang (Balanced)' : 'Tidak Seimbang (Unbalanced)'}</p>
                 {!isBalanced && <p className="text-sm">Selisih: {formatCurrency(Math.abs(totalAssets - totalLiabilitiesAndEquity))}</p>}
            </div>
        </div>
    );
};

const CashFlowStatement: React.FC<{ data: FinancialData, period: { start: string, end: string } }> = ({ data, period }) => {
    if (!data) return null;
    const { cashFlow } = data;
    return (
         <div>
            <h3 className="text-xl font-semibold mb-2">Laporan Arus Kas</h3>
            <p className="text-sm text-gray-400 mb-4">Untuk Periode {formatDate(period.start)} s/d {formatDate(period.end)}</p>
             <div className="bg-slate-900/50 p-4 rounded-lg space-y-2">
                 <ReportRow label="Saldo Kas Awal Periode" amount={cashFlow.startCash} />
                 <ReportRow label="Kenaikan (Penurunan) Bersih Kas" amount={cashFlow.netChange} />
                 <ReportRow label="Saldo Kas Akhir Periode" amount={cashFlow.endCash} isTotal />
            </div>
        </div>
    );
}

const ComparativeReport: React.FC<{ currentData: FinancialData, previousData: FinancialData, currentPeriod: any, previousPeriod: any }> = ({ currentData, previousData, currentPeriod, previousPeriod }) => {
    if(!currentData || !previousData) return null;

    const formatChange = (current: number, previous: number) => {
        const change = current - previous;
        const percentChange = previous !== 0 ? (change / Math.abs(previous)) * 100 : 0;
        const color = change >= 0 ? 'text-green-400' : 'text-red-400';
        return (
            <td className={`p-2 font-mono text-right ${color}`}>
                {formatCurrency(change)} ({percentChange.toFixed(1)}%)
            </td>
        );
    }
    
    return (
        <div>
            <h3 className="text-xl font-semibold mb-4">Laporan Keuangan Komparatif</h3>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-sm">
                    <thead>
                        <tr className="border-b border-gray-600">
                            <th className="text-left p-2">Deskripsi</th>
                            <th className="text-right p-2">Periode Saat Ini ({formatDate(currentPeriod.end)})</th>
                            <th className="text-right p-2">Periode Sebelumnya ({formatDate(previousPeriod.end)})</th>
                            <th className="text-right p-2">Perubahan</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="font-bold bg-slate-800/50"><td colSpan={4} className="p-2">Laba Rugi</td></tr>
                        <tr>
                            <td className="p-2 pl-6">Pendapatan</td>
                            <td className="p-2 font-mono text-right">{formatCurrency(currentData.totalRevenue)}</td>
                            <td className="p-2 font-mono text-right">{formatCurrency(previousData.totalRevenue)}</td>
                            {formatChange(currentData.totalRevenue, previousData.totalRevenue)}
                        </tr>
                        <tr>
                            <td className="p-2 pl-6">Beban</td>
                            <td className="p-2 font-mono text-right">{formatCurrency(currentData.totalExpense)}</td>
                            <td className="p-2 font-mono text-right">{formatCurrency(previousData.totalExpense)}</td>
                            {formatChange(currentData.totalExpense, previousData.totalExpense)}
                        </tr>
                        <tr className="font-semibold border-t border-slate-700">
                            <td className="p-2 pl-6">Laba Bersih</td>
                            <td className="p-2 font-mono text-right">{formatCurrency(currentData.netIncome)}</td>
                            <td className="p-2 font-mono text-right">{formatCurrency(previousData.netIncome)}</td>
                            {formatChange(currentData.netIncome, previousData.netIncome)}
                        </tr>
                         <tr className="font-bold bg-slate-800/50"><td colSpan={4} className="p-2">Neraca</td></tr>
                        <tr>
                            <td className="p-2 pl-6">Total Aset</td>
                            <td className="p-2 font-mono text-right">{formatCurrency(currentData.totalAssets)}</td>
                            <td className="p-2 font-mono text-right">{formatCurrency(previousData.totalAssets)}</td>
                            {formatChange(currentData.totalAssets, previousData.totalAssets)}
                        </tr>
                         <tr>
                            <td className="p-2 pl-6">Total Liabilitas</td>
                            <td className="p-2 font-mono text-right">{formatCurrency(currentData.totalLiabilities)}</td>
                            <td className="p-2 font-mono text-right">{formatCurrency(previousData.totalLiabilities)}</td>
                            {formatChange(currentData.totalLiabilities, previousData.totalLiabilities)}
                        </tr>
                         <tr className="font-semibold border-t border-slate-700">
                            <td className="p-2 pl-6">Total Modal</td>
                            <td className="p-2 font-mono text-right">{formatCurrency(currentData.totalEquityWithPL)}</td>
                            <td className="p-2 font-mono text-right">{formatCurrency(previousData.totalEquityWithPL)}</td>
                            {formatChange(currentData.totalEquityWithPL, previousData.totalEquityWithPL)}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    )
}


const Reports: React.FC = () => {
    const { accounts, transactions, companySettings, loading, error } = useData();
    const [activeTab, setActiveTab] = useState<'income' | 'balance' | 'cashflow' | 'comparative'>('income');
    const [period, setPeriod] = useState(getYearRange());
    const [comparePeriod, setComparePeriod] = useState<'prev_month' | 'prev_6_months' | 'prev_year'>('prev_month');

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPeriod(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handlePrint = () => window.print();

    const reportData = useMemo(() => {
        if (!period.start || !period.end || period.start > period.end) return null;
        return calculatePeriodFinancials(accounts, transactions, period);
    }, [accounts, transactions, period]);

    const comparativeData = useMemo(() => {
        if (activeTab !== 'comparative' || !period.start || !period.end) return null;
        
        const currentData = calculatePeriodFinancials(accounts, transactions, period);
        
        let prevPeriod;
        if (comparePeriod === 'prev_month') {
            prevPeriod = { start: subtractMonths(period.start, 1), end: subtractMonths(period.end, 1) };
        } else if (comparePeriod === 'prev_6_months') {
            prevPeriod = { start: subtractMonths(period.start, 6), end: subtractMonths(period.end, 6) };
        } else { // prev_year
            prevPeriod = { start: subtractYears(period.start, 1), end: subtractYears(period.end, 1) };
        }
        
        const previousData = calculatePeriodFinancials(accounts, transactions, prevPeriod);

        return { currentData, previousData, currentPeriod: period, previousPeriod: prevPeriod };
    }, [accounts, transactions, period, comparePeriod, activeTab]);

    const TabButton: React.FC<{ tab: any; label: string }> = ({ tab, label }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-sm rounded-md transition-colors ${activeTab === tab ? 'bg-primary text-white' : 'bg-slate-700 hover:bg-slate-600'}`}
        >
            {label}
        </button>
    );

    return (
        <div className="printable-area">
            <Card>
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4 no-print">
                     <h2 className="text-2xl md:text-3xl font-bold">Laporan Keuangan</h2>
                    <div className="flex flex-wrap items-center gap-2">
                        <TabButton tab="income" label="Laba Rugi" />
                        <TabButton tab="balance" label="Neraca" />
                        <TabButton tab="cashflow" label="Arus Kas" />
                        <TabButton tab="comparative" label="Laporan Komparatif" />
                    </div>
                </div>
                
                 <div className="mb-6 p-4 bg-slate-800/50 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-4 items-end no-print">
                    <div className="md:col-span-1">
                        <label htmlFor="start" className="block text-sm font-medium text-gray-300 mb-1">Periode Mulai</label>
                        <input type="date" name="start" id="start" value={period.start} onChange={handleDateChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2" />
                    </div>
                    <div className="md:col-span-1">
                        <label htmlFor="end" className="block text-sm font-medium text-gray-300 mb-1">Periode Selesai</label>
                        <input type="date" name="end" id="end" value={period.end} onChange={handleDateChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2" />
                    </div>
                    <div className="md:col-span-1 flex justify-end">
                         <button onClick={handlePrint} className="bg-accent hover:bg-accent/80 text-white font-bold py-2 px-6 rounded-lg w-full md:w-auto">
                            Cetak Laporan
                        </button>
                    </div>
                    {activeTab === 'comparative' && (
                        <div className="md:col-span-3">
                            <label htmlFor="comparePeriod" className="block text-sm font-medium text-gray-300 mb-1">Bandingkan dengan</label>
                            <select id="comparePeriod" value={comparePeriod} onChange={e => setComparePeriod(e.target.value as any)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2">
                                <option value="prev_month">Bulan Sebelumnya</option>
                                <option value="prev_6_months">6 Bulan Sebelumnya</option>
                                <option value="prev_year">Tahun Sebelumnya</option>
                            </select>
                        </div>
                    )}
                </div>

                {loading && accounts.length === 0 && <div className="text-center py-8 no-print">Memuat data laporan...</div>}
                {error && <div className="text-center py-8 text-red-400 no-print">Error: {error}</div>}
                
                <div id="report-content">
                    {activeTab !== 'comparative' && !reportData && <div className="text-center py-8 text-yellow-400 no-print">Harap pilih rentang tanggal yang valid.</div>}
                    
                    <div className="print-header hidden">
                        <h1>{companySettings.name}</h1>
                    </div>

                    {activeTab === 'income' && <IncomeStatement data={reportData} period={period} />}
                    {activeTab === 'balance' && <BalanceSheet data={reportData} period={period} />}
                    {activeTab === 'cashflow' && <CashFlowStatement data={reportData} period={period} />}
                    {activeTab === 'comparative' && comparativeData && <ComparativeReport {...comparativeData} />}
                </div>

            </Card>
        </div>
    );
};

export default Reports;