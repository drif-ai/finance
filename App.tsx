
import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import Dashboard from './features/Dashboard';
import Transactions from './features/Transactions';
import Ledger from './features/Ledger';
import Reconciliation from './features/Reconciliation';
import Assets from './features/Assets';
import Reports from './features/Reports';
import Settings from './features/Settings';
import Accounts from './features/Accounts';

export type Section = 'dashboard' | 'transactions' | 'ledger' | 'accounts' | 'reconciliation' | 'assets' | 'reports' | 'settings';

const App: React.FC = () => {
    const [activeSection, setActiveSection] = useState<Section>('dashboard');

    const renderSection = useCallback(() => {
        switch (activeSection) {
            case 'dashboard':
                return <Dashboard />;
            case 'transactions':
                return <Transactions />;
            case 'ledger':
                return <Ledger />;
            case 'accounts':
                return <Accounts />;
            case 'reconciliation':
                return <Reconciliation />;
            case 'assets':
                return <Assets />;
            case 'reports':
                return <Reports />;
            case 'settings':
                return <Settings />;
            default:
                return <Dashboard />;
        }
    }, [activeSection]);

    return (
        <div className="min-h-screen">
            <Header activeSection={activeSection} setActiveSection={setActiveSection} />
            <main className="max-w-7xl mx-auto px-4 pb-12">
                {renderSection()}
            </main>
        </div>
    );
};

export default App;