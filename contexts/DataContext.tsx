import React, { createContext, useContext, useState } from 'react';
import type { Account, Transaction, Asset, CompanySettings, TaxSettings, JournalEntry } from '../types';
import { defaultAccounts, defaultCompanySettings, defaultTaxSettings } from '../utils/helpers';
import { v4 as uuidv4 } from 'uuid';

// Kunci untuk caching di localStorage
export const CACHE_KEYS = {
    ACCOUNTS: 'financeflow_accounts',
    TRANSACTIONS: 'financeflow_transactions',
    ASSETS: 'financeflow_assets',
    COMPANY_SETTINGS: 'financeflow_company_settings',
    TAX_SETTINGS: 'financeflow_tax_settings',
};

type NewTransactionData = {
    transaction: Omit<Transaction, 'id' | 'entries'>;
    entries: Omit<JournalEntry, 'id' | 'transaction_id'>[];
};

interface DataContextType {
    accounts: Account[];
    transactions: Transaction[];
    assets: Asset[];
    companySettings: CompanySettings;
    taxSettings: TaxSettings;
    loading: boolean;
    error: string | null;
    transactionCount: number;
    accountCount: number;
    assetCount: number;
    addAccount: (account: Omit<Account, 'id'>) => Promise<void>;
    addAccountsBatch: (accounts: Omit<Account, 'id'>[]) => Promise<void>;
    updateAccount: (code: string, updates: Partial<Account>) => Promise<void>;
    deleteAccount: (code: string) => Promise<void>;
    addTransaction: (transaction: Omit<Transaction, 'id' | 'entries'>, entries: Omit<JournalEntry, 'id'|'transaction_id'>[]) => Promise<Transaction>;
    addTransactionsBatch: (transactionsData: NewTransactionData[]) => Promise<Transaction[]>;
    updateTransaction: (id: string, updates: Partial<Omit<Transaction, 'id' | 'entries'>>) => Promise<void>;
    deleteTransaction: (id: string) => Promise<void>;
    addAsset: (asset: Omit<Asset, 'id'>) => Promise<Asset>;
    updateAsset: (id: string, updates: Partial<Asset>) => Promise<void>;
    deleteAsset: (id: string) => Promise<void>;
    saveCompanySettings: (settings: CompanySettings) => Promise<void>;
    saveTaxSettings: (settings: TaxSettings) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const loadFromCache = <T,>(key: string, defaultValue: T): T => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.warn(`Error reading from localStorage key "${key}":`, error);
        return defaultValue;
    }
};

const saveToCache = (key: string, data: any) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error(`Error writing to localStorage key "${key}":`, error);
    }
};

const initializeAccounts = (): Account[] => {
    const cachedAccounts = loadFromCache<Account[]>(CACHE_KEYS.ACCOUNTS, []);
    if (cachedAccounts.length === 0) {
        const initialAccounts = defaultAccounts.map(acc => ({ ...acc, id: uuidv4() }));
        saveToCache(CACHE_KEYS.ACCOUNTS, initialAccounts);
        return initialAccounts;
    }
    return cachedAccounts;
};


export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [accounts, setAccounts] = useState<Account[]>(() => initializeAccounts());
    const [transactions, setTransactions] = useState<Transaction[]>(() => loadFromCache(CACHE_KEYS.TRANSACTIONS, []));
    const [assets, setAssets] = useState<Asset[]>(() => loadFromCache(CACHE_KEYS.ASSETS, []));
    const [companySettings, setCompanySettings] = useState<CompanySettings>(() => loadFromCache(CACHE_KEYS.COMPANY_SETTINGS, defaultCompanySettings));
    const [taxSettings, setTaxSettings] = useState<TaxSettings>(() => loadFromCache(CACHE_KEYS.TAX_SETTINGS, defaultTaxSettings));
    const [loading] = useState(false);
    const [error] = useState<string | null>(null);

    const transactionCount = transactions.length;
    const accountCount = accounts.length;
    const assetCount = assets.length;

    const addAccount = async (account: Omit<Account, 'id'>) => {
        await addAccountsBatch([account]);
    };

    const addAccountsBatch = async (accountsToAdd: Omit<Account, 'id'>[]) => {
        const newAccounts = accountsToAdd.map(acc => ({ ...acc, id: uuidv4() }));
        const updatedAccounts = [...accounts, ...newAccounts];
        setAccounts(updatedAccounts);
        saveToCache(CACHE_KEYS.ACCOUNTS, updatedAccounts);
    };
    
    const updateAccount = async (code: string, updates: Partial<Account>) => {
        const updatedAccounts = accounts.map(acc => acc.code === code ? { ...acc, ...updates } : acc);
        setAccounts(updatedAccounts);
        saveToCache(CACHE_KEYS.ACCOUNTS, updatedAccounts);
    };
    
    const deleteAccount = async (code: string) => {
        const updatedAccounts = accounts.filter(acc => acc.code !== code);
        setAccounts(updatedAccounts);
        saveToCache(CACHE_KEYS.ACCOUNTS, updatedAccounts);
    };

    const addTransaction = async (transaction: Omit<Transaction, 'id' | 'entries'>, entries: Omit<JournalEntry, 'id'|'transaction_id'>[]): Promise<Transaction> => {
       const newTxs = await addTransactionsBatch([{ transaction, entries }]);
       return newTxs[0];
    };
    
     const addTransactionsBatch = async (transactionsData: NewTransactionData[]): Promise<Transaction[]> => {
        const newTransactions: Transaction[] = [];
        // FIX: Explicitly type the Map to ensure type safety for balance calculations.
        const accountUpdates = new Map<string, number>(accounts.map(acc => [acc.code, acc.balance]));

        for (const { transaction, entries } of transactionsData) {
            const newTransactionId = uuidv4();
            const newTransaction = {
                ...transaction,
                id: newTransactionId,
                entries: entries.map(e => ({ ...e, id: uuidv4(), transaction_id: newTransactionId })),
            };
            newTransactions.push(newTransaction);

            entries.forEach(entry => {
                const account = accounts.find(a => a.code === entry.account_code);
                if (!account) return;

                const currentBalance = accountUpdates.get(entry.account_code) ?? 0;
                let newBalance = currentBalance;
                const isContraAsset = account.type === 'Aset' && account.name.toLowerCase().includes('akumulasi penyusutan');

                if ((account.type === 'Aset' || account.type === 'Beban') && !isContraAsset) {
                    newBalance += entry.debit - entry.credit;
                } else {
                    newBalance += entry.credit - entry.debit;
                }
                accountUpdates.set(entry.account_code, newBalance);
            });
        }

        const updatedTransactions = [...newTransactions, ...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTransactions(updatedTransactions);
        saveToCache(CACHE_KEYS.TRANSACTIONS, updatedTransactions);

        const updatedAccounts = accounts.map(acc => ({ ...acc, balance: accountUpdates.get(acc.code) ?? acc.balance }));
        setAccounts(updatedAccounts);
        saveToCache(CACHE_KEYS.ACCOUNTS, updatedAccounts);
        return newTransactions;
    };

    const updateTransaction = async (id: string, updates: Partial<Omit<Transaction, 'id' | 'entries'>>) => {
        const updatedTransactions = transactions.map(tx => (tx.id === id ? { ...tx, ...updates } : tx));
        setTransactions(updatedTransactions);
        saveToCache(CACHE_KEYS.TRANSACTIONS, updatedTransactions);
    };

    const deleteTransaction = async (id: string) => {
        const transactionToDelete = transactions.find(t => t.id === id);
        if (!transactionToDelete) throw new Error("Transaction not found");

        const updatedTransactions = transactions.filter(tx => tx.id !== id);
        setTransactions(updatedTransactions);
        saveToCache(CACHE_KEYS.TRANSACTIONS, updatedTransactions);

        // FIX: Explicitly type the Map to ensure type safety for balance calculations.
        const accountUpdates = new Map<string, number>(accounts.map(acc => [acc.code, acc.balance]));
        
        transactionToDelete.entries.forEach(entry => {
            const account = accounts.find(a => a.code === entry.account_code);
            if (!account) return;

            const currentBalance = accountUpdates.get(entry.account_code) ?? 0;
            let newBalance = currentBalance;
            const isContraAsset = account.type === 'Aset' && account.name.toLowerCase().includes('akumulasi penyusutan');
            
            if ((account.type === 'Aset' || account.type === 'Beban') && !isContraAsset) {
                newBalance -= (entry.debit - entry.credit);
            } else {
                newBalance -= (entry.credit - entry.debit);
            }
            accountUpdates.set(entry.account_code, newBalance);
        });
        const updatedAccounts = accounts.map(acc => ({...acc, balance: accountUpdates.get(acc.code) ?? acc.balance}));
        setAccounts(updatedAccounts);
        saveToCache(CACHE_KEYS.ACCOUNTS, updatedAccounts);
    };

    const addAsset = async (asset: Omit<Asset, 'id'>): Promise<Asset> => {
        const newAsset = { ...asset, id: uuidv4() };
        const updatedAssets = [...assets, newAsset];
        setAssets(updatedAssets);
        saveToCache(CACHE_KEYS.ASSETS, updatedAssets);
        return newAsset;
    };
    
    const updateAsset = async (id: string, updates: Partial<Asset>) => {
        const updatedAssets = assets.map(a => (a.id === id ? { ...a, ...updates } : a));
        setAssets(updatedAssets);
        saveToCache(CACHE_KEYS.ASSETS, updatedAssets);
    };
    
    const deleteAsset = async (id: string) => {
        const updatedAssets = assets.filter(a => a.id !== id);
        setAssets(updatedAssets);
        saveToCache(CACHE_KEYS.ASSETS, updatedAssets);
    };

    const saveCompanySettings = async (settings: CompanySettings) => {
        setCompanySettings(settings);
        saveToCache(CACHE_KEYS.COMPANY_SETTINGS, settings);
    };

    const saveTaxSettings = async (settings: TaxSettings) => {
        setTaxSettings(settings);
        saveToCache(CACHE_KEYS.TAX_SETTINGS, settings);
    };

    const value: DataContextType = {
        accounts, transactions, assets, companySettings, taxSettings,
        loading, error, transactionCount, accountCount, assetCount,
        addAccount, addAccountsBatch, updateAccount, deleteAccount,
        addTransaction, addTransactionsBatch, updateTransaction, deleteTransaction,
        addAsset, updateAsset, deleteAsset,
        saveCompanySettings, saveTaxSettings
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};