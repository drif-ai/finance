import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Account, Transaction, Asset, CompanySettings, TaxSettings, JournalEntry } from '../types';
import { defaultCompanySettings, defaultTaxSettings, getTodayDateString, CACHE_KEYS, loadFromCache, saveToCache } from '../utils/helpers';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

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
    addAccount: (account: Omit<Account, 'id' | 'balance'> & { balance?: number }) => Promise<void>;
    addAccountsBatch: (accounts: (Omit<Account, 'id' | 'balance'> & { balance?: number })[]) => Promise<Account[]>;
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

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { session, loading: authLoading } = useAuth();
    
    // Initialize state as empty. Data will be loaded from cache inside useEffect.
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [companySettings, setCompanySettings] = useState<CompanySettings>(defaultCompanySettings);
    const [taxSettings, setTaxSettings] = useState<TaxSettings>(defaultTaxSettings);
    
    // 'loading' now represents background syncing activity.
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const getCacheKey = (baseKey: string) => {
        const userId = session?.user?.id;
        if (!userId) return null;
        return `${baseKey}_${userId}`;
    };

    useEffect(() => {
        if (authLoading) {
            setLoading(true);
            return;
        }

        if (!session) {
            // Clear state when user logs out.
            setAccounts([]);
            setTransactions([]);
            setAssets([]);
            setCompanySettings(defaultCompanySettings);
            setTaxSettings(defaultTaxSettings);
            setLoading(false);
            return;
        }

        const userId = session.user.id;

        // --- STALE ---
        // Load data from user-specific cache immediately for an instant UI response.
        setAccounts(loadFromCache(`${CACHE_KEYS.ACCOUNTS}_${userId}`, []));
        setTransactions(loadFromCache(`${CACHE_KEYS.TRANSACTIONS}_${userId}`, []));
        setAssets(loadFromCache(`${CACHE_KEYS.ASSETS}_${userId}`, []));
        setCompanySettings(loadFromCache(`${CACHE_KEYS.COMPANY_SETTINGS}_${userId}`, defaultCompanySettings));
        setTaxSettings(loadFromCache(`${CACHE_KEYS.TAX_SETTINGS}_${userId}`, defaultTaxSettings));
        setLoading(false); // Stop initial loading, UI is now interactive with cached data.

        // --- REVALIDATE ---
        // Fetch fresh data from Supabase in the background.
        const fetchData = async () => {
            setLoading(true); // Indicate background sync has started.
            setError(null);
            try {
                const accountsPromise = supabase.from('accounts').select('*').order('code');
                const transactionsPromise = supabase.from('transactions').select('*, journal_entries(*)').order('date', { ascending: false });
                const assetsPromise = supabase.from('assets').select('*').order('date', { ascending: false });
                const companySettingsPromise = supabase.from('company_settings').select('*').limit(1);
                const taxSettingsPromise = supabase.from('tax_settings').select('*').limit(1);

                const [
                    { data: accountsData, error: accountsError },
                    { data: transactionsData, error: transactionsError },
                    { data: assetsData, error: assetsError },
                    { data: companySettingsDataArray, error: companySettingsError },
                    { data: taxSettingsDataArray, error: taxSettingsError },
                ] = await Promise.all([accountsPromise, transactionsPromise, assetsPromise, companySettingsPromise, taxSettingsPromise]);

                if (accountsError) throw accountsError;
                if (transactionsError) throw transactionsError;
                if (assetsError) throw assetsError;
                if (companySettingsError) throw companySettingsError;
                if (taxSettingsError) throw taxSettingsError;

                const formattedTransactions = transactionsData?.map(tx => ({ ...tx, entries: tx.journal_entries || [] })) || [];
                
                const companySettingsData = companySettingsDataArray?.[0];
                const taxSettingsData = taxSettingsDataArray?.[0];

                // Update state and user-specific cache with fresh data.
                setAccounts(accountsData || []);
                saveToCache(`${CACHE_KEYS.ACCOUNTS}_${userId}`, accountsData || []);
                
                setTransactions(formattedTransactions);
                saveToCache(`${CACHE_KEYS.TRANSACTIONS}_${userId}`, formattedTransactions);

                setAssets(assetsData || []);
                saveToCache(`${CACHE_KEYS.ASSETS}_${userId}`, assetsData || []);

                if (companySettingsData) {
                    setCompanySettings(companySettingsData);
                    saveToCache(`${CACHE_KEYS.COMPANY_SETTINGS}_${userId}`, companySettingsData);
                }
                if (taxSettingsData) {
                    setTaxSettings(taxSettingsData);
                    saveToCache(`${CACHE_KEYS.TAX_SETTINGS}_${userId}`, taxSettingsData);
                }

            } catch (err: any) {
                console.error("Gagal mengambil data sinkronisasi:", err);
                setError(`Gagal sinkronisasi data: ${err.message}`);
            } finally {
                setLoading(false); // Background sync finished.
            }
        };

        fetchData();
    }, [session, authLoading]);

    const transactionCount = transactions.length;
    const accountCount = accounts.length;
    const assetCount = assets.length;
    
    const addAccountsBatch = async (accountsToAdd: (Omit<Account, 'id' | 'balance'> & { balance?: number })[]) => {
        const key = getCacheKey(CACHE_KEYS.ACCOUNTS);
        if (!key) throw new Error("Pengguna tidak login");

        const accountsToInsert = accountsToAdd.map(({ balance, ...acc }) => ({...acc, balance: 0}));
        const { data, error } = await supabase.from('accounts').insert(accountsToInsert).select();
        if (error) throw error;
        
        const updatedAccounts = [...accounts, ...data].sort((a, b) => a.code.localeCompare(b.code));
        setAccounts(updatedAccounts);
        saveToCache(key, updatedAccounts);
        
        return data;
    };

    const addAccount = async (account: Omit<Account, 'id' | 'balance'> & { balance?: number }) => {
        const openingBalance = account.balance || 0;
        const { balance, ...accountData } = account;
        const newAccounts = await addAccountsBatch([accountData]);
        
        if (openingBalance !== 0 && newAccounts.length > 0) {
            const newAccount = newAccounts[0];
            const isDebitNormal = newAccount.type === 'Aset' || newAccount.type === 'Beban';
            
            await addTransaction(
                {
                    date: getTodayDateString(),
                    description: `Saldo Awal untuk Akun ${newAccount.code}`,
                    ref: 'SALDO-AWAL',
                },
                [
                    { account_code: newAccount.code, debit: isDebitNormal ? openingBalance : 0, credit: !isDebitNormal ? openingBalance : 0 },
                    { account_code: '3999', debit: !isDebitNormal ? openingBalance : 0, credit: isDebitNormal ? openingBalance : 0 }
                ]
            );
        }
    };
    
    const updateAccount = async (code: string, updates: Partial<Account>) => {
        const key = getCacheKey(CACHE_KEYS.ACCOUNTS);
        if (!key) throw new Error("Pengguna tidak login");
        
        const { data, error } = await supabase.from('accounts').update(updates).eq('code', code).select().single();
        if (error) throw error;
        const updatedAccounts = accounts.map(acc => acc.code === code ? data : acc);
        setAccounts(updatedAccounts);
        saveToCache(key, updatedAccounts);
    };
    
    const deleteAccount = async (code: string) => {
        const key = getCacheKey(CACHE_KEYS.ACCOUNTS);
        if (!key) throw new Error("Pengguna tidak login");

        const { error } = await supabase.from('accounts').delete().eq('code', code);
        if (error) throw error;
        const updatedAccounts = accounts.filter(acc => acc.code !== code);
        setAccounts(updatedAccounts);
        saveToCache(key, updatedAccounts);
    };

    const addTransaction = async (transaction: Omit<Transaction, 'id' | 'entries'>, entries: Omit<JournalEntry, 'id'|'transaction_id'>[]): Promise<Transaction> => {
       const [newTx] = await addTransactionsBatch([{ transaction, entries }]);
       return newTx;
    };
    
    const addTransactionsBatch = async (transactionsData: NewTransactionData[]): Promise<Transaction[]> => {
        const accountsKey = getCacheKey(CACHE_KEYS.ACCOUNTS);
        const transactionsKey = getCacheKey(CACHE_KEYS.TRANSACTIONS);
        if (!accountsKey || !transactionsKey) throw new Error("Pengguna tidak login");

        const newTransactionsResult: Transaction[] = [];

        for (const { transaction, entries } of transactionsData) {
            const { data: txData, error: txError } = await supabase.from('transactions').insert(transaction).select().single();
            if (txError) throw txError;
            
            const entriesWithTxId = entries.map(e => ({ ...e, transaction_id: txData.id }));
            const { data: entriesData, error: entriesError } = await supabase.from('journal_entries').insert(entriesWithTxId).select();
            
            if (entriesError) {
                await supabase.from('transactions').delete().eq('id', txData.id);
                throw entriesError;
            }
            
            const accountUpdates = new Map<string, number>();
            entries.forEach(entry => {
                const currentChange = accountUpdates.get(entry.account_code) || 0;
                const account = accounts.find(a => a.code === entry.account_code);
                if (!account) return;
                
                const isContraAsset = account.type === 'Aset' && account.name.toLowerCase().includes('akumulasi penyusutan');
                let change = (account.type === 'Aset' || account.type === 'Beban') && !isContraAsset
                    ? entry.debit - entry.credit
                    : entry.credit - entry.debit;
                
                accountUpdates.set(entry.account_code, currentChange + change);
            });

            const updatePromises = Array.from(accountUpdates.entries()).map(([code, balanceChange]) => 
                supabase.rpc('update_account_balance', { p_code: code, p_amount: balanceChange })
            );
            
            await Promise.all(updatePromises);

            const newFullTransaction = { ...txData, entries: entriesData || [] };
            newTransactionsResult.push(newFullTransaction);
        }

        const { data: updatedAccountsData } = await supabase.from('accounts').select('*').order('code');
        const updatedAccounts = updatedAccountsData || [];
        setAccounts(updatedAccounts);
        saveToCache(accountsKey, updatedAccounts);
        
        const updatedTransactions = [...newTransactionsResult, ...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTransactions(updatedTransactions);
        saveToCache(transactionsKey, updatedTransactions);
        
        return newTransactionsResult;
    };

    const updateTransaction = async (id: string, updates: Partial<Omit<Transaction, 'id' | 'entries'>>) => {
        const key = getCacheKey(CACHE_KEYS.TRANSACTIONS);
        if (!key) throw new Error("Pengguna tidak login");

        const { data, error } = await supabase.from('transactions').update(updates).eq('id', id).select().single();
        if (error) throw error;
        const updatedTransactions = transactions.map(tx => (tx.id === id ? { ...tx, ...data } : tx));
        setTransactions(updatedTransactions);
        saveToCache(key, updatedTransactions);
    };

    const deleteTransaction = async (id: string) => {
        const accountsKey = getCacheKey(CACHE_KEYS.ACCOUNTS);
        const transactionsKey = getCacheKey(CACHE_KEYS.TRANSACTIONS);
        if (!accountsKey || !transactionsKey) throw new Error("Pengguna tidak login");
        
        const transactionToDelete = transactions.find(t => t.id === id);
        if (!transactionToDelete) throw new Error("Transaksi tidak ditemukan");

        const accountUpdates = new Map<string, number>();
        transactionToDelete.entries.forEach(entry => {
            const currentChange = accountUpdates.get(entry.account_code) || 0;
            const account = accounts.find(a => a.code === entry.account_code);
            if (!account) return;
            const isContraAsset = account.type === 'Aset' && account.name.toLowerCase().includes('akumulasi penyusutan');
            let change = (account.type === 'Aset' || account.type === 'Beban') && !isContraAsset
                ? entry.debit - entry.credit
                : entry.credit - entry.debit;
            accountUpdates.set(entry.account_code, currentChange - change);
        });
        
        const updatePromises = Array.from(accountUpdates.entries()).map(([code, balanceChange]) => 
            supabase.rpc('update_account_balance', { p_code: code, p_amount: balanceChange })
        );
        await Promise.all(updatePromises);
        
        const { error: txError } = await supabase.from('transactions').delete().eq('id', id);
        if(txError) throw txError;

        const updatedTransactions = transactions.filter(tx => tx.id !== id);
        setTransactions(updatedTransactions);
        saveToCache(transactionsKey, updatedTransactions);
        
        const { data: updatedAccountsData } = await supabase.from('accounts').select('*').order('code');
        const updatedAccounts = updatedAccountsData || [];
        setAccounts(updatedAccounts);
        saveToCache(accountsKey, updatedAccounts);
    };

    const addAsset = async (asset: Omit<Asset, 'id'>): Promise<Asset> => {
        const key = getCacheKey(CACHE_KEYS.ASSETS);
        if (!key) throw new Error("Pengguna tidak login");
        
        const { data, error } = await supabase.from('assets').insert(asset).select().single();
        if (error) throw error;
        const updatedAssets = [data, ...assets].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAssets(updatedAssets);
        saveToCache(key, updatedAssets);
        return data;
    };
    
    const updateAsset = async (id: string, updates: Partial<Asset>) => {
        const key = getCacheKey(CACHE_KEYS.ASSETS);
        if (!key) throw new Error("Pengguna tidak login");
        
        const { data, error } = await supabase.from('assets').update(updates).eq('id', id).select().single();
        if (error) throw error;
        const updatedAssets = assets.map(a => (a.id === id ? data : a));
        setAssets(updatedAssets);
        saveToCache(key, updatedAssets);
    };
    
    const deleteAsset = async (id: string) => {
        const key = getCacheKey(CACHE_KEYS.ASSETS);
        if (!key) throw new Error("Pengguna tidak login");

        const { error } = await supabase.from('assets').delete().eq('id', id);
        if (error) throw error;
        const updatedAssets = assets.filter(a => a.id !== id);
        setAssets(updatedAssets);
        saveToCache(key, updatedAssets);
    };

    const saveCompanySettings = async (settings: CompanySettings) => {
        const key = getCacheKey(CACHE_KEYS.COMPANY_SETTINGS);
        if (!key) throw new Error("Pengguna tidak login");

        const { data, error } = await supabase.from('company_settings').upsert({ ...settings, id: 1 }).select().single();
        if (error) throw error;
        setCompanySettings(data);
        saveToCache(key, data);
    };

    const saveTaxSettings = async (settings: TaxSettings) => {
        const key = getCacheKey(CACHE_KEYS.TAX_SETTINGS);
        if (!key) throw new Error("Pengguna tidak login");
        
        const { data, error } = await supabase.from('tax_settings').upsert({ ...settings, id: 1 }).select().single();
        if (error) throw error;
        setTaxSettings(data);
        saveToCache(key, data);
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
