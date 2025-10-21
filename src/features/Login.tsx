import React, { useState } from 'react';
import Card from '../components/Card';
import { supabase } from '../services/supabase';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            // The onAuthStateChange listener in AuthContext will handle the redirect.
        } catch (error: any) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="flex items-center justify-center min-h-screen px-4">
            <Card className="w-full max-w-sm">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center mx-auto mb-4">
                        <span className="text-white font-bold text-3xl">FF</span>
                    </div>
                    <h1 className="text-2xl font-bold">Selamat Datang</h1>
                    <p className="text-gray-400">Masuk untuk mengelola keuangan Anda</p>
                </div>

                {error && <p className="bg-red-500/20 text-red-400 text-center text-sm p-3 rounded-md mb-4">{error}</p>}
                {message && <p className="bg-green-500/20 text-green-400 text-center text-sm p-3 rounded-md mb-4">{message}</p>}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">Alamat Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-slate-700 border border-slate-600 rounded-md p-2"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">Kata Sandi</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-slate-700 border border-slate-600 rounded-md p-2"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary hover:bg-primary/80 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-500"
                    >
                        {loading ? 'Memproses...' : 'Masuk'}
                    </button>
                </form>
            </Card>
        </div>
    );
};

export default Login;
