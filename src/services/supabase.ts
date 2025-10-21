import { createClient } from '@supabase/supabase-js';

// The user will provide these in a .env file for their Vite setup
// FIX: Cast import.meta to any to access env property without Vite-specific types.
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    // This provides a clear error message in the console if the .env variables are missing.
    const errorContainer = document.getElementById('root');
    if(errorContainer) {
        errorContainer.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: white;">
                <h1 style="font-size: 1.5rem; font-weight: bold;">Kesalahan Konfigurasi Supabase</h1>
                <p style="margin-top: 1rem;">Harap pastikan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY telah diatur di lingkungan Anda.</p>
                 <p style="margin-top: 0.5rem; font-size: 0.8rem; color: #9ca3af;">Anda perlu membuat file <code>.env</code> di root proyek dan menambahkan kredensial Supabase Anda di sana.</p>
            </div>
        `;
    }
    throw new Error('Supabase URL and Anon Key must be provided in environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);