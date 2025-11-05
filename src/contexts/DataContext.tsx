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
    
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [companySettings, setCompanySettings] = useState<CompanySettings>(defaultCompanySettings);
    const [taxSettings, setTaxSettings] = useState<TaxSettings>(defaultTaxSettings);
    
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
            setAccounts([]);
            setTransactions([]);
            setAssets([]);
            setCompanySettings(defaultCompanySettings);
            setTaxSettings(defaultTaxSettings);
            setLoading(false);
            return;
        }

        const userId = session.user.id;

        const cachedAccounts = loadFromCache(`${CACHE_KEYS.ACCOUNTS}_${userId}`, []);
        setAccounts(cachedAccounts);
        const cachedTransactions = loadFromCache(`${CACHE_KEYS.TRANSACTIONS}_${userId}`, []);
        setTransactions(cachedTransactions);
        setAssets(loadFromCache(`${CACHE_KEYS.ASSETS}_${userId}`, []));
        setCompanySettings(loadFromCache(`${CACHE_KEYS.COMPANY_SETTINGS}_${userId}`, defaultCompanySettings));
        setTaxSettings(loadFromCache(`${CACHE_KEYS.TAX_SETTINGS}_${userId}`, defaultTaxSettings));
        setLoading(cachedAccounts.length === 0 && cachedTransactions.length === 0);

        const revalidate = async () => {
            setError(null);
            try {
                const accountsPromise = supabase.from('accounts').select('*').order('code');
                const transactionsPromise = supabase.from('transactions').select('*, journal_entries(*)').order('date', { ascending: false });
                const assetsPromise = supabase.from('assets').select('*').order('date', { ascending: false });
                const companySettingsPromise = supabase.from('company_settings').select('*').limit(1).maybeSingle();
                const taxSettingsPromise = supabase.from('tax_settings').select('*').limit(1).maybeSingle();

                const [
                    { data: accountsData, error: accountsError },
                    { data: transactionsData, error: transactionsError },
                    { data: assetsData, error: assetsError },
                    { data: companySettingsData, error: companySettingsError },
                    { data: taxSettingsData, error: taxSettingsError },
                ] = await Promise.all([accountsPromise, transactionsPromise, assetsPromise, companySettingsPromise, taxSettingsPromise]);

                if (accountsError) throw accountsError;
                if (transactionsError) throw transactionsError;
                if (assetsError) throw assetsError;
                if (companySettingsError) throw companySettingsError;
                if (taxSettingsError) throw taxSettingsError;
                
                const formattedTransactions = transactionsData?.map(tx => ({ ...tx, entries: tx.journal_entries || [] })) || [];
                
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
                console.error("Gagal sinkronisasi data:", err);
                setError(`Gagal sinkronisasi data: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };

        revalidate();

        const allChangesChannel = supabase.channel(`public-db-changes-${userId}`)
            .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                console.log('Realtime change received!', payload);
                revalidate();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(allChangesChannel);
        };
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
        
        // Let the realtime subscription handle state updates
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
        const { error } = await supabase.from('accounts').update(updates).eq('code', code);
        if (error) throw error;
        // Let realtime handle state update
    };
    
    const deleteAccount = async (code: string) => {
        const { error } = await supabase.from('accounts').delete().eq('code', code);
        if (error) throw error;
        // Let realtime handle state update
    };

    const addTransaction = async (transaction: Omit<Transaction, 'id' | 'entries'>, entries: Omit<JournalEntry, 'id'|'transaction_id'>[]): Promise<Transaction> => {
       const [newTx] = await addTransactionsBatch([{ transaction, entries }]);
       return newTx;
    };
    
     const addTransactionsBatch = async (transactionsData: NewTransactionData[]): Promise<Transaction[]> => {
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
        
        // Let realtime handle state updates, but return the created transactions
        return newTransactionsResult;
    };

    const updateTransaction = async (id: string, updates: Partial<Omit<Transaction, 'id' | 'entries'>>) => {
        const { error } = await supabase.from('transactions').update(updates).eq('id', id);
        if (error) throw error;
        // Let realtime handle state update
    };

    const deleteTransaction = async (id: string) => {
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
        // Let realtime handle state update
    };

    const addAsset = async (asset: Omit<Asset, 'id'>): Promise<Asset> => {
        const { data, error } = await supabase.from('assets').insert(asset).select().single();
        if (error) throw error;
        // Let realtime handle state update
        return data;
    };
    
    const updateAsset = async (id: string, updates: Partial<Asset>) => {
        const { error } = await supabase.from('assets').update(updates).eq('id', id);
        if (error) throw error;
        // Let realtime handle state update
    };
    
    const deleteAsset = async (id: string) => {
        const { error } = await supabase.from('assets').delete().eq('id', id);
        if (error) throw error;
        // Let realtime handle state update
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