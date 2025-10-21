export type AccountType = 'Aset' | 'Liabilitas' | 'Modal' | 'Pendapatan' | 'Beban';

export interface Account {
    id?: string;
    code: string;
    name: string;
    type: AccountType;
    balance: number;
    description: string;
}

export interface JournalEntry {
    id?: string;
    transaction_id?: string;
    account_code: string;
    debit: number;
    credit: number;
}

export interface Transaction {
    id?: string;
    date: string;
    ref: string;
    description: string;
    entries: JournalEntry[];
}

export interface Asset {
    id?: string;
    name: string;
    category: string;
    cost: number;
    date: string;
    life: number | null;
    residual: number;
    method: 'straight-line' | 'declining-balance' | 'sum-of-years' | null;
    is_depreciable: boolean;
    accumulated_depreciation: number;
    depreciation_expense_account_code: string | null;
    accumulated_depreciation_account_code: string | null;
    asset_account_code: string | null;
}

export interface CompanySettings {
    name: string;
    address: string;
    phone: string;
    email: string;
    npwp: string;
    businessType: string;
    currency: string;
    taxYear: string;
    periodStart: string;
    website: string;
    owner: string;
    description: string;
}

export interface TaxSettings {
    enableIncomeTax: boolean;
    corporateTaxRate: number;
    taxCalculationBasis: 'income-before-tax' | 'operating-income' | 'gross-profit' | 'revenue';
    minimumTaxableIncome: number;
    roundTaxAmount: boolean;
    taxExpenseAccount: string;
    taxPayableAccount: string;
    autoCreateTaxEntry: boolean;
}