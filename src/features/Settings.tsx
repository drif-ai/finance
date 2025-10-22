import React, { useState, useEffect, useRef } from 'react';
import Card from '../components/Card';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { CACHE_KEYS } from '../utils/helpers';
import type { CompanySettings } from '../types';

const StatItem: React.FC<{ label: string; value: number | string, icon: string }> = ({ label, value, icon }) => (
    <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
        <div className="flex items-center">
            <span className="mr-3 text-lg">{icon}</span>
            <span className="text-gray-300">{label}</span>
        </div>
        <span className="font-bold text-lg">{value}</span>
    </div>
);

const DataStatistics: React.FC = () => {
    const { transactionCount, accountCount, assetCount, loading } = useData();

    if (loading && transactionCount === 0) {
        return (
             <div className="text-center text-gray-400 py-8">
                <p>Memuat statistik...</p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <StatItem label="Total Transaksi" value={transactionCount} icon="🔄" />
            <StatItem label="Total Akun" value={accountCount} icon="📚" />
            <StatItem label="Total Aset" value={assetCount} icon="🏠" />
        </div>
    );
};

const DataManagement: React.FC = () => {
    const { profile } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isRestoring, setIsRestoring] = useState(false);

    const handleBackup = () => {
        try {
            const backupData: { [key: string]: string | null } = {};
            for (const key of Object.values(CACHE_KEYS)) {
                backupData[key] = localStorage.getItem(key);
            }
            
            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const date = new Date().toISOString().split('T')[0];
            a.download = `financeflow_backup_${date}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Backup failed:", error);
            alert("Gagal membuat backup data.");
        }
    };

    const handleRestoreClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsRestoring(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const data = JSON.parse(text) as Record<string, string | null>;

                const requiredKeys = Object.values(CACHE_KEYS);
                const dataKeys = Object.keys(data);
                const isValid = requiredKeys.every(k => dataKeys.includes(k) && (typeof data[k] === 'string' || data[k] === null));

                if (!isValid) {
                    alert('File backup tidak valid atau formatnya rusak.');
                    return;
                }

                if (window.confirm('PERINGATAN: Tindakan ini akan menimpa SEMUA data cache lokal yang ada saat ini. Data akan disinkronkan ulang dari server saat aplikasi dimuat ulang. Apakah Anda yakin ingin melanjutkan?')) {
                    Object.keys(data).forEach(key => {
                        if (data[key] !== null) {
                            localStorage.setItem(key, data[key] as string);
                        } else {
                            localStorage.removeItem(key);
                        }
                    });
                    alert('Cache berhasil dipulihkan. Aplikasi akan dimuat ulang sekarang untuk sinkronisasi.');
                    window.location.reload();
                }
            } catch (error) {
                console.error("Restore failed:", error);
                alert('Gagal memproses file backup. Pastikan file tersebut adalah file JSON yang valid.');
            } finally {
                setIsRestoring(false);
                if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
            }
        };
        reader.readAsText(file);
    };

    return (
         <div className="space-y-4">
            <p className="text-sm text-gray-400">
                Simpan semua data cache lokal Anda ke dalam satu file, atau pulihkan dari file backup sebelumnya. Berguna untuk memindahkan data antar perangkat atau sebagai cadangan.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
                <button
                    onClick={handleBackup}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                    Backup Cache Lokal
                </button>
                {profile?.role === 'admin' && (
                    <>
                        <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                        <button
                            onClick={handleRestoreClick}
                            disabled={isRestoring}
                            className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-gray-500"
                        >
                            {isRestoring ? 'Memproses...' : 'Restore Cache dari File'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};


const CompanySettingsManager: React.FC = () => {
    const { companySettings, saveCompanySettings } = useData();
    const { profile } = useAuth();
    const [formData, setFormData] = useState<CompanySettings>(companySettings);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    
    const canEdit = profile?.role === 'admin';

    useEffect(() => {
        setFormData(companySettings);
    }, [companySettings]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setIsSaved(false);
        try {
            await saveCompanySettings(formData);
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 3000);
        } catch (error: any) {
            console.error("Failed to save company settings:", error);
            alert(`Error: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };
    
    const InputField: React.FC<{ name: keyof CompanySettings, label: string, type?: string, placeholder?: string, required?: boolean }> = ({ name, label, type = 'text', placeholder, required = false }) => (
        <div>
            <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
            <input
                type={type}
                name={name}
                id={name}
                value={formData[name] || ''}
                onChange={handleChange}
                placeholder={placeholder}
                required={required}
                className="w-full bg-slate-700 border border-slate-600 rounded-md p-2"
                disabled={!canEdit}
            />
        </div>
    );

    return (
        <div>
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <InputField name="name" label="Nama Perusahaan" required />
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="address" className="block text-sm font-medium text-gray-300 mb-1">Alamat</label>
                        <textarea name="address" id="address" value={formData.address} onChange={handleChange} rows={3} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2" disabled={!canEdit}></textarea>
                    </div>
                    <InputField name="phone" label="Telepon" />
                    <InputField name="email" label="Email" type="email" />
                    <InputField name="website" label="Website" type="url" />
                    <InputField name="owner" label="Pemilik" />
                    <InputField name="npwp" label="NPWP" />
                    <InputField name="businessType" label="Jenis Usaha" />
                    <InputField name="currency" label="Mata Uang" />
                    <InputField name="taxYear" label="Tahun Pajak" />
                    <div className="md:col-span-2">
                        <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">Deskripsi Singkat</label>
                        <textarea name="description" id="description" value={formData.description} onChange={handleChange} rows={2} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2" disabled={!canEdit}></textarea>
                    </div>
                </div>
                {canEdit && (
                    <div className="mt-6 flex justify-end items-center gap-4">
                        {isSaved && <p className="text-green-400 text-sm">Pengaturan disimpan.</p>}
                        <button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/80 text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-500">
                            {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
};


const Settings: React.FC = () => {
    return (
        <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-6">Pengaturan Sistem</h2>
            <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 md:gap-8">
                <Card>
                    <h3 className="text-xl font-semibold mb-4">Informasi Perusahaan</h3>
                    <CompanySettingsManager />
                </Card>
                 <Card>
                    <h3 className="text-xl font-semibold mb-4">Manajemen Cache Lokal</h3>
                    <DataManagement />
                </Card>
                 <Card>
                    <h3 className="text-xl font-semibold mb-4">Statistik Data</h3>
                    <p className="text-sm text-gray-400 mb-4">Jumlah catatan yang saat ini tersimpan di database.</p>
                    <DataStatistics />
                </Card>
            </div>
        </div>
    );
};

export default Settings;