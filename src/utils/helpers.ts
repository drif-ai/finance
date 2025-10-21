import type { CompanySettings, TaxSettings, Account, Transaction } from '../types';

export const formatCurrency = (amount: number, currency = 'IDR') => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

export const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

export const getTodayDateString = () => new Date().toISOString().split('T')[0];

export const subtractMonths = (dateStr: string, months: number): string => {
    const date = new Date(dateStr);
    date.setMonth(date.getMonth() - months);
    return date.toISOString().split('T')[0];
};

export const subtractYears = (dateStr: string, years: number): string => {
    const date = new Date(dateStr);
    date.setFullYear(date.getFullYear() - years);
    return date.toISOString().split('T')[0];
};

export const defaultCompanySettings: CompanySettings = {
    name: 'An Nahl Islamic School',
    address: 'Jl. Raya Ciangsana KM.07 Gunung Putri Bogor',
    phone: '',
    email: '',
    npwp: '',
    businessType: 'education',
    currency: 'IDR',
    taxYear: new Date().getFullYear().toString(),
    periodStart: getTodayDateString(),
    website: '',
    owner: '',
    description: '',
};

export const defaultTaxSettings: TaxSettings = {
    enableIncomeTax: false,
    corporateTaxRate: 25,
    taxCalculationBasis: 'income-before-tax',
    minimumTaxableIncome: 0,
    roundTaxAmount: true,
    taxExpenseAccount: '5500',
    taxPayableAccount: '2300',
    autoCreateTaxEntry: false,
};

export const defaultAccounts: Omit<Account, 'id'>[] = [
    // Aset Lancar
    {code: '1100', name: 'Kas', type: 'Aset', balance: 0, description: 'Kas di tangan perusahaan'},
    {code: '1200', name: 'Bank', type: 'Aset', balance: 0, description: 'Rekening bank perusahaan'},
    {code: '1300', name: 'Piutang Dagang', type: 'Aset', balance: 0, description: 'Tagihan kepada pelanggan'},
    {code: '1400', name: 'Persediaan', type: 'Aset', balance: 0, description: 'Barang dagangan'},
    // Aset Tetap
    {code: '1501', name: 'Peralatan Kantor', type: 'Aset', balance: 0, description: 'Peralatan operasional kantor'},
    {code: '1601', name: 'Akum. Penyusutan - Peralatan Kantor', type: 'Aset', balance: 0, description: 'Akumulasi penyusutan peralatan kantor'},
    {code: '1511', name: 'Kendaraan', type: 'Aset', balance: 0, description: 'Kendaraan operasional'},
    {code: '1611', name: 'Akum. Penyusutan - Kendaraan', type: 'Aset', balance: 0, description: 'Akumulasi penyusutan kendaraan'},
    // Liabilitas
    {code: '2100', name: 'Utang Dagang', type: 'Liabilitas', balance: 0, description: 'Utang kepada supplier'},
    {code: '2200', name: 'Utang Bank', type: 'Liabilitas', balance: 0, description: 'Pinjaman bank'},
    {code: '2300', name: 'Utang Pajak Penghasilan', type: 'Liabilitas', balance: 0, description: 'Utang pajak penghasilan yang belum dibayar'},
    // Modal
    {code: '3100', name: 'Modal Saham', type: 'Modal', balance: 0, description: 'Modal disetor pemegang saham'},
    {code: '3200', name: 'Laba Ditahan', type: 'Modal', balance: 0, description: 'Akumulasi laba yang ditahan'},
    {code: '3999', name: 'Modal Saldo Awal', type: 'Modal', balance: 0, description: 'Akun penyeimbang untuk saldo awal impor'},
    // Pendapatan
    {code: '4100', name: 'Pendapatan Jasa Pendidikan', type: 'Pendapatan', balance: 0, description: 'Pendapatan dari jasa pendidikan'},
    // Beban
    {code: '5100', name: 'Beban Pokok Pendapatan', type: 'Beban', balance: 0, description: 'Biaya langsung terkait pendapatan'},
    {code: '5200', name: 'Beban Gaji', type: 'Beban', balance: 0, description: 'Gaji karyawan'},
    {code: '5300', name: 'Beban Sewa', type: 'Beban', balance: 0, description: 'Biaya sewa tempat usaha'},
    {code: '5401', name: 'Beban Penyusutan - Peralatan Kantor', type: 'Beban', balance: 0, description: 'Penyusutan aset peralatan kantor'},
    {code: '5411', name: 'Beban Penyusutan - Kendaraan', type: 'Beban', balance: 0, description: 'Penyusutan aset kendaraan'},
    {code: '5500', name: 'Beban Pajak Penghasilan', type: 'Beban', balance: 0, description: 'Beban pajak penghasilan badan'},
];

export const calculatePeriodFinancials = (accounts: Account[], transactions: Transaction[], period: { start: string, end: string }) => {
    
    // 1. Calculate balance changes within the period
    const periodChanges = new Map<string, number>(accounts.map(a => [a.code, 0]));
    transactions
        .filter(tx => tx.date >= period.start && tx.date <= period.end)
        .forEach(tx => {
            tx.entries.forEach(e => {
                const change = e.debit - e.credit;
                periodChanges.set(e.account_code, (periodChanges.get(e.account_code) || 0) + change);
            });
        });

    // 2. Calculate opening balances (balances right before the period start)
    const openingBalances = new Map<string, number>(accounts.map(a => [a.code, 0]));
     transactions
        .filter(tx => tx.date < period.start)
        .forEach(tx => {
            tx.entries.forEach(e => {
                const change = e.debit - e.credit;
                openingBalances.set(e.account_code, (openingBalances.get(e.account_code) || 0) + change);
            });
        });

    // 3. Calculate Income Statement figures (from period changes)
    const revenues = accounts.filter(a => a.type === 'Pendapatan').map(a => ({...a, balance: -(periodChanges.get(a.code) || 0)}));
    const expenses = accounts.filter(a => a.type === 'Beban').map(a => ({...a, balance: periodChanges.get(a.code) || 0}));
    const totalRevenue = revenues.reduce((s, a) => s + a.balance, 0);
    const totalExpense = expenses.reduce((s, a) => s + a.balance, 0);
    const netIncome = totalRevenue - totalExpense;

    // 4. Calculate Balance Sheet figures (opening balance + period change)
    const closingBalances = new Map<string, number>();
    accounts.forEach(a => {
        const opening = openingBalances.get(a.code) || 0;
        const change = periodChanges.get(a.code) || 0;
        closingBalances.set(a.code, opening + change);
    });

    const assets = accounts.filter(a => a.type === 'Aset').map(a => ({...a, balance: closingBalances.get(a.code) || 0}));
    const liabilities = accounts.filter(a => a.type === 'Liabilitas').map(a => ({...a, balance: -(closingBalances.get(a.code) || 0)}));
    const equity = accounts.filter(a => a.type === 'Modal').map(a => ({...a, balance: -(closingBalances.get(a.code) || 0)}));
    
    // Add net income to retained earnings for the balance sheet
    const equityWithPL = equity.map(a => a.code === '3200' ? {...a, balance: a.balance + netIncome} : a);

    const totalAssets = assets.reduce((s, a) => s + (a.name.toLowerCase().includes('akumulasi') ? -(a.balance) : a.balance), 0);
    const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0);
    const totalEquity = equity.reduce((s, a) => s + a.balance, 0);
    const totalEquityWithPL = equityWithPL.reduce((s, a) => s + a.balance, 0);
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquityWithPL;
    
    // 5. Calculate Cash Flow (simplified)
    const cashAccountCodes = accounts.filter(a => a.type === 'Aset' && (a.name.toLowerCase().includes('kas') || a.name.toLowerCase().includes('bank'))).map(a => a.code);
    const startCash = cashAccountCodes.reduce((s, code) => s + (openingBalances.get(code) || 0), 0);
    const endCash = cashAccountCodes.reduce((s, code) => s + (closingBalances.get(code) || 0), 0);
    const netChange = endCash - startCash;


    return {
        revenues, totalRevenue, expenses, totalExpense, netIncome,
        assets, totalAssets, liabilities, totalLiabilities, equity, totalEquity, equityWithPL, totalEquityWithPL,
        totalLiabilitiesAndEquity,
        isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
        cashFlow: { startCash, endCash, netChange }
    };
}