import React, { useState, useEffect, useMemo } from 'react';
import Card from '../components/Card';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { useData } from '../contexts/DataContext';
import { formatDate, formatCurrency, getTodayDateString } from '../utils/helpers';
import type { Asset } from '../types';

type AssetFormData = Omit<Asset, 'id'>;

const AssetForm: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    assetToEdit?: Asset | null;
}> = ({ isOpen, onClose, assetToEdit }) => {
    const { addAsset, updateAsset, accounts, addTransaction } = useData();
    const [formData, setFormData] = useState<AssetFormData>({
        name: '',
        category: '',
        cost: 0,
        date: getTodayDateString(),
        life: null,
        residual: 0,
        method: null,
        is_depreciable: false,
        accumulated_depreciation: 0,
        depreciation_expense_account_code: null,
        accumulated_depreciation_account_code: null,
        asset_account_code: null,
    });
    const [paymentAccountCode, setPaymentAccountCode] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const expenseAccounts = useMemo(() => accounts.filter(acc => acc.type === 'Beban').sort((a,b) => a.code.localeCompare(b.code)), [accounts]);
    const accumulatedDepreciationAccounts = useMemo(() => accounts.filter(acc => acc.type === 'Aset' && acc.name.toLowerCase().includes("akumulasi")).sort((a,b) => a.code.localeCompare(b.code)), [accounts]);
    const assetTypeAccounts = useMemo(() => accounts.filter(acc => acc.type === 'Aset' && !acc.name.toLowerCase().includes("akumulasi")).sort((a,b) => a.code.localeCompare(b.code)), [accounts]);
    const paymentAccounts = useMemo(() => accounts.filter(acc => acc.type === 'Aset' || acc.type === 'Liabilitas').sort((a,b) => a.code.localeCompare(b.code)), [accounts]);


    useEffect(() => {
        if (assetToEdit) {
            setFormData({
                name: assetToEdit.name,
                category: assetToEdit.category,
                cost: assetToEdit.cost,
                date: assetToEdit.date,
                life: assetToEdit.life,
                residual: assetToEdit.residual,
                method: assetToEdit.method,
                is_depreciable: assetToEdit.is_depreciable,
                accumulated_depreciation: assetToEdit.accumulated_depreciation,
                depreciation_expense_account_code: assetToEdit.depreciation_expense_account_code,
                accumulated_depreciation_account_code: assetToEdit.accumulated_depreciation_account_code,
                asset_account_code: assetToEdit.asset_account_code
            });
            setPaymentAccountCode('');
        } else {
            setFormData({
                name: '',
                category: '',
                cost: 0,
                date: getTodayDateString(),
                life: null,
                residual: 0,
                method: null,
                is_depreciable: false,
                accumulated_depreciation: 0,
                depreciation_expense_account_code: null,
                accumulated_depreciation_account_code: null,
                asset_account_code: null,
            });
            setPaymentAccountCode('');
        }
        setFormError(null);
    }, [assetToEdit, isOpen]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ 
                ...prev, 
                is_depreciable: checked, 
                method: checked ? 'straight-line' : null, 
                life: checked ? (prev.life || 5) : null,
                depreciation_expense_account_code: checked ? prev.depreciation_expense_account_code : null,
                accumulated_depreciation_account_code: checked ? prev.accumulated_depreciation_account_code : null,
            }));
        } else if (type === 'number') {
            setFormData(prev => ({ ...prev, [name]: Number(value) || 0 }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value === '' ? null : value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        if (formData.is_depreciable && (!formData.depreciation_expense_account_code || !formData.accumulated_depreciation_account_code)) {
            setFormError("Untuk aset yang dapat disusutkan, akun beban dan akumulasi harus dipilih.");
            return;
        }

        setIsSubmitting(true);
        try {
            if (assetToEdit?.id) {
                await updateAsset(assetToEdit.id, formData);
            } else {
                 if (!formData.asset_account_code || !paymentAccountCode) {
                    setFormError("Untuk aset baru, Akun Aset dan Akun Pembayaran (Kredit) harus dipilih untuk penjurnalan.");
                    setIsSubmitting(false);
                    return;
                }
                const newAsset = await addAsset(formData);
                if (newAsset && formData.cost > 0) {
                    await addTransaction({
                        date: formData.date,
                        ref: `ASET-${newAsset.id?.substring(0, 4)}`,
                        description: `Pembelian Aset: ${formData.name}`,
                    }, [
                        { account_code: formData.asset_account_code, debit: formData.cost, credit: 0 },
                        { account_code: paymentAccountCode, debit: 0, credit: formData.cost },
                    ]);
                }
            }
            onClose();
        } catch (error: any) {
            setFormError(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formInputClasses = "w-full bg-slate-900 border border-slate-700 rounded-md p-2 focus:ring-1 focus:ring-primary focus:border-primary transition-colors";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={assetToEdit ? 'Edit Aset' : 'Tambah Aset Baru'} size="lg">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Nama Aset</label>
                        <input type="text" name="name" id="name" value={formData.name} onChange={handleInputChange} className={formInputClasses} required />
                    </div>
                    <div>
                        <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-1">Kategori</label>
                        <input type="text" name="category" id="category" value={formData.category} onChange={handleInputChange} className={formInputClasses} placeholder="e.g., Peralatan Kantor" />
                    </div>
                    <div>
                        <label htmlFor="date" className="block text-sm font-medium text-gray-300 mb-1">Tanggal Perolehan</label>
                        <input type="date" name="date" id="date" value={formData.date} onChange={handleInputChange} className={formInputClasses} required />
                    </div>
                    <div>
                        <label htmlFor="cost" className="block text-sm font-medium text-gray-300 mb-1">Harga Perolehan</label>
                        <input type="number" name="cost" id="cost" value={formData.cost || ''} onChange={handleInputChange} className={formInputClasses} required />
                    </div>
                    <div>
                         <label htmlFor="accumulated_depreciation" className="block text-sm font-medium text-gray-300 mb-1">Akumulasi Penyusutan Awal</label>
                        <input type="number" name="accumulated_depreciation" id="accumulated_depreciation" value={formData.accumulated_depreciation || ''} onChange={handleInputChange} className={formInputClasses} disabled={!assetToEdit} />
                        {!assetToEdit && <p className="text-xs text-gray-400 mt-1">Default 0 untuk aset baru.</p>}
                    </div>
                </div>
                
                 {!assetToEdit && (
                    <div className="md:col-span-2 pt-4 border-t border-slate-700">
                        <h4 className="font-semibold text-lg mb-2">Jurnal Pembelian</h4>
                        <p className="text-xs text-gray-400 mb-4">Otomatis buat jurnal transaksi untuk pembelian aset baru ini.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="asset_account_code" className="block text-sm font-medium text-gray-300 mb-1">Debit (Akun Aset)</label>
                                <select name="asset_account_code" id="asset_account_code" value={formData.asset_account_code || ''} onChange={handleInputChange} className={formInputClasses}>
                                    <option value="">Pilih Akun Aset...</option>
                                    {assetTypeAccounts.map(acc => <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="paymentAccountCode" className="block text-sm font-medium text-gray-300 mb-1">Kredit (Dibayar Dari)</label>
                                <select id="paymentAccountCode" value={paymentAccountCode} onChange={e => setPaymentAccountCode(e.target.value)} className={formInputClasses}>
                                    <option value="">Pilih Akun Pembayaran...</option>
                                    {paymentAccounts.map(acc => <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                )}


                <div className="pt-4 border-t border-slate-700">
                    <label className="flex items-center space-x-2">
                        <input type="checkbox" name="is_depreciable" checked={formData.is_depreciable} onChange={handleInputChange} className="h-4 w-4 rounded bg-slate-700 border-slate-600 text-primary focus:ring-primary" />
                        <span>Aset ini dapat disusutkan</span>
                    </label>
                </div>

                {formData.is_depreciable && (
                    <div className="space-y-4 p-4 bg-slate-900 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label htmlFor="life" className="block text-sm font-medium text-gray-300 mb-1">Masa Manfaat (Tahun)</label>
                                <input type="number" name="life" id="life" value={formData.life || ''} onChange={handleInputChange} className={formInputClasses} />
                            </div>
                            <div>
                                <label htmlFor="residual" className="block text-sm font-medium text-gray-300 mb-1">Nilai Residu</label>
                                <input type="number" name="residual" id="residual" value={formData.residual || ''} onChange={handleInputChange} className={formInputClasses} />
                            </div>
                            <div>
                                <label htmlFor="method" className="block text-sm font-medium text-gray-300 mb-1">Metode</label>
                                <select name="method" id="method" value={formData.method || ''} onChange={handleInputChange} className={formInputClasses}>
                                    <option value="straight-line">Garis Lurus</option>
                                    <option value="declining-balance" disabled>Saldo Menurun</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-700">
                             <div>
                                <label htmlFor="depreciation_expense_account_code" className="block text-sm font-medium text-gray-300 mb-1">Akun Beban Penyusutan</label>
                                <select name="depreciation_expense_account_code" id="depreciation_expense_account_code" value={formData.depreciation_expense_account_code || ''} onChange={handleInputChange} className={formInputClasses} required={formData.is_depreciable}>
                                    <option value="">Pilih akun...</option>
                                    {expenseAccounts.map(acc => <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>)}
                                </select>
                            </div>
                             <div>
                                <label htmlFor="accumulated_depreciation_account_code" className="block text-sm font-medium text-gray-300 mb-1">Akun Akumulasi Penyusutan</label>
                                <select name="accumulated_depreciation_account_code" id="accumulated_depreciation_account_code" value={formData.accumulated_depreciation_account_code || ''} onChange={handleInputChange} className={formInputClasses} required={formData.is_depreciable}>
                                    <option value="">Pilih akun...</option>
                                    {accumulatedDepreciationAccounts.map(acc => <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {formError && <p className="text-red-400 text-sm">{formError}</p>}

                <div className="mt-6 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="py-2 px-4 rounded-md bg-slate-600 hover:bg-slate-500">Batal</button>
                    <button type="submit" disabled={isSubmitting} className="py-2 px-4 rounded-md bg-primary hover:bg-primary/80 disabled:bg-gray-500">
                        {isSubmitting ? 'Menyimpan...' : (assetToEdit ? 'Simpan Perubahan' : 'Tambah Aset')}
                    </button>
                </div>
            </form>
        </Modal>
    )
}

const DepreciationModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    asset: Asset | null;
}> = ({ isOpen, onClose, asset }) => {
    const { addTransaction, updateAsset } = useData();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [depreciationDate, setDepreciationDate] = useState('');
    
    useEffect(() => {
        if (isOpen) {
            const today = new Date();
            const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            setDepreciationDate(lastDay.toISOString().split('T')[0]);
        }
    }, [isOpen]);

    if (!asset || !asset.is_depreciable) return null;

    const bookValue = asset.cost - asset.accumulated_depreciation;
    const monthlyDepreciation = (asset.cost - asset.residual) / ((asset.life || 1) * 12);
    const isFullyDepreciated = bookValue <= asset.residual;
    
    const handleRunDepreciation = async () => {
        if (isFullyDepreciated) {
            alert("Aset sudah disusutkan sepenuhnya.");
            return;
        }

        if (!asset.depreciation_expense_account_code || !asset.accumulated_depreciation_account_code) {
            alert("Akun beban atau akumulasi penyusutan belum diatur untuk aset ini. Silakan edit aset terlebih dahulu.");
            return;
        }

        const depreciationAmount = Math.max(0, Math.min(monthlyDepreciation, bookValue - asset.residual));

        if (depreciationAmount <= 0) {
             alert("Tidak ada penyusutan yang dapat dijalankan.");
             return;
        }

        setIsSubmitting(true);
        try {
            await addTransaction({
                date: depreciationDate,
                ref: `DEP-${asset.id?.substring(0, 4)}`,
                description: `Penyusutan bulanan untuk aset: ${asset.name}`,
            }, [
                { account_code: asset.depreciation_expense_account_code, debit: depreciationAmount, credit: 0 },
                { account_code: asset.accumulated_depreciation_account_code, debit: 0, credit: depreciationAmount },
            ]);

            await updateAsset(asset.id!, {
                accumulated_depreciation: asset.accumulated_depreciation + depreciationAmount
            });

            alert(`Jurnal penyusutan sebesar ${formatCurrency(depreciationAmount)} berhasil dibuat.`);
            onClose();

        } catch(err: any) {
            alert(`Gagal menjalankan penyusutan: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Penyusutan: ${asset.name}`}>
            <div className="space-y-3">
                <p className="flex justify-between"><span>Harga Perolehan:</span> <span>{formatCurrency(asset.cost)}</span></p>
                <p className="flex justify-between"><span>Akumulasi Penyusutan:</span> <span>({formatCurrency(asset.accumulated_depreciation)})</span></p>
                <p className="flex justify-between font-bold border-t border-slate-600 pt-2"><span>Nilai Buku Saat Ini:</span> <span>{formatCurrency(bookValue)}</span></p>
                <p className="flex justify-between text-sm text-gray-400"><span>Nilai Residu:</span> <span>{formatCurrency(asset.residual)}</span></p>
                <hr className="border-slate-600" />
                <p className="flex justify-between font-bold text-lg"><span>Penyusutan Bulanan:</span> <span className="text-accent">{formatCurrency(monthlyDepreciation)}</span></p>
                <hr className="border-slate-600" />
                 <div className="pt-2">
                    <label htmlFor="depreciationDate" className="block text-sm font-medium text-gray-300 mb-1">Tanggal Jurnal Penyusutan</label>
                    <input 
                        type="date" 
                        id="depreciationDate"
                        value={depreciationDate} 
                        onChange={e => setDepreciationDate(e.target.value)} 
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-2"
                    />
                </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={onClose} className="py-2 px-4 rounded-md bg-slate-600 hover:bg-slate-500">Batal</button>
                <button
                    onClick={handleRunDepreciation}
                    disabled={isSubmitting || isFullyDepreciated}
                    className="py-2 px-4 rounded-md bg-accent hover:bg-accent/80 disabled:bg-gray-500"
                >
                    {isSubmitting ? 'Memproses...' : (isFullyDepreciated ? 'Tersusutkan Penuh' : 'Buat Jurnal Penyusutan')}
                </button>
            </div>
        </Modal>
    )
}

const Assets: React.FC = () => {
    const { assets, loading, error, deleteAsset } = useData();
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDepreciationModalOpen, setIsDepreciationModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [depreciationAsset, setDepreciationAsset] = useState<Asset | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    const assetCategories = useMemo(() => ['All', ...[...new Set(assets.map(a => a.category).filter(Boolean))]], [assets]);
    
    const filteredAssets = useMemo(() => {
        return assets.filter(asset => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = asset.name.toLowerCase().includes(searchLower) || asset.category.toLowerCase().includes(searchLower);
            const matchesCategory = selectedCategory === 'All' ? true : asset.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [assets, searchTerm, selectedCategory]);

    const paginatedAssets = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredAssets.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredAssets, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedCategory]);

    const handleOpenFormModal = (asset?: Asset) => {
        setEditingAsset(asset || null);
        setIsFormModalOpen(true);
    };

    const handleCloseFormModal = () => {
        setIsFormModalOpen(false);
        setEditingAsset(null);
    };

    const handleOpenDepreciationModal = (asset: Asset) => {
        setDepreciationAsset(asset);
        setIsDepreciationModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Apakah Anda yakin ingin menghapus aset ini?')) {
            try {
                await deleteAsset(id);
            } catch (err: any) {
                alert(`Gagal menghapus aset: ${err.message}`);
            }
        }
    };

    return (
        <Card>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl md:text-3xl font-bold">Manajemen Aset</h2>
                <button onClick={() => handleOpenFormModal()} className="bg-primary hover:bg-primary/80 text-white font-bold py-2 px-4 rounded-lg">
                    + Aset Baru
                </button>
            </div>

            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                    type="text"
                    placeholder="Cari nama atau kategori aset..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-md p-2"
                />
                <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-md p-2"
                >
                    {assetCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
            </div>

            {loading && assets.length === 0 && <div className="text-center py-8">Memuat daftar aset...</div>}
            {error && <div className="text-center py-8 text-red-400">Error: {error}</div>}

            {!loading && !error && (
            <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                        <thead>
                            <tr className="border-b border-gray-600">
                                <th className="text-left py-3 px-4">Nama Aset</th>
                                <th className="text-left py-3 px-4">Tgl. Perolehan</th>
                                <th className="text-right py-3 px-4">Harga Perolehan</th>
                                <th className="text-right py-3 px-4">Akum. Penyusutan</th>
                                <th className="text-right py-3 px-4">Nilai Buku</th>
                                <th className="text-center py-3 px-4">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedAssets.length > 0 ? (
                                paginatedAssets.map(asset => {
                                    const bookValue = asset.cost - asset.accumulated_depreciation;
                                    return (
                                        <tr key={asset.id} className="border-b border-gray-700 hover:bg-slate-800/50">
                                            <td className="py-3 px-4">{asset.name} <span className="text-gray-400 text-sm">({asset.category})</span></td>
                                            <td className="py-3 px-4">{formatDate(asset.date)}</td>
                                            <td className="py-3 px-4 text-right font-mono">{formatCurrency(asset.cost)}</td>
                                            <td className="py-3 px-4 text-right font-mono">({formatCurrency(asset.accumulated_depreciation)})</td>
                                            <td className="py-3 px-4 text-right font-mono font-bold">{formatCurrency(bookValue)}</td>
                                            <td className="py-3 px-4 text-center space-x-2">
                                                {asset.is_depreciable && <button onClick={() => handleOpenDepreciationModal(asset)} className="text-accent hover:underline text-sm">Penyusutan</button>}
                                                <button onClick={() => handleOpenFormModal(asset)} className="text-blue-400 hover:underline text-sm">Edit</button>
                                                <button onClick={() => handleDelete(asset.id!)} className="text-red-400 hover:underline text-sm">Hapus</button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={6} className="text-center text-gray-400 py-8">
                                        {assets.length > 0 ? 'Tidak ada aset yang cocok dengan kriteria.' : "Belum ada aset. Klik 'Aset Baru' untuk memulai."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                    {paginatedAssets.length > 0 ? paginatedAssets.map(asset => {
                        const bookValue = asset.cost - asset.accumulated_depreciation;
                        return (
                            <Card key={asset.id} className="!p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="font-bold">{asset.name}</p>
                                        <p className="text-sm text-gray-400">{asset.category} &bull; {formatDate(asset.date)}</p>
                                    </div>
                                    <p className="font-mono font-semibold text-lg">{formatCurrency(bookValue)}</p>
                                </div>
                                <div className="text-xs space-y-1 text-gray-300 border-t border-b border-slate-700 py-2 my-2">
                                    <p className="flex justify-between"><span>Harga Perolehan:</span> <span className="font-mono">{formatCurrency(asset.cost)}</span></p>
                                    <p className="flex justify-between"><span>Akum. Penyusutan:</span> <span className="font-mono">({formatCurrency(asset.accumulated_depreciation)})</span></p>
                                </div>
                                <div className="mt-2 flex justify-end space-x-4">
                                    {asset.is_depreciable && <button onClick={() => handleOpenDepreciationModal(asset)} className="text-accent hover:underline text-sm">Penyusutan</button>}
                                    <button onClick={() => handleOpenFormModal(asset)} className="text-blue-400 hover:underline text-sm">Edit</button>
                                    <button onClick={() => handleDelete(asset.id!)} className="text-red-400 hover:underline text-sm">Hapus</button>
                                </div>
                            </Card>
                        )
                    }) : (
                        <div className="text-center text-gray-400 py-8">
                            {assets.length > 0 ? 'Tidak ada aset yang cocok.' : "Belum ada aset."}
                        </div>
                    )}
                </div>

                <Pagination 
                    currentPage={currentPage}
                    totalItems={filteredAssets.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={setCurrentPage}
                />
            </>
            )}
            <AssetForm isOpen={isFormModalOpen} onClose={handleCloseFormModal} assetToEdit={editingAsset} />
            <DepreciationModal isOpen={isDepreciationModalOpen} onClose={() => setIsDepreciationModalOpen(false)} asset={depreciationAsset} />
        </Card>
    );
};

export default Assets;