
import React, { useState } from 'react';
import type { Section } from '../App';

interface NavButtonProps {
    label: string;
    section: Section;
    activeSection: Section;
    onClick: (section: Section) => void;
}

const NavButton: React.FC<NavButtonProps> = ({ label, section, activeSection, onClick }) => (
    <button
        onClick={() => onClick(section)}
        className={`w-full text-left md:text-center px-4 py-3 md:py-2 rounded-lg transition-all ${
            activeSection === section ? 'bg-white/20' : 'hover:bg-white/10'
        }`}
    >
        {label}
    </button>
);

interface HeaderProps {
    activeSection: Section;
    setActiveSection: (section: Section) => void;
}

const Header: React.FC<HeaderProps> = ({ activeSection, setActiveSection }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleNavClick = (section: Section) => {
        setActiveSection(section);
        setIsMenuOpen(false);
    };

    const navItems: { label: string; section: Section }[] = [
        { label: 'Dashboard', section: 'dashboard' },
        { label: 'Transaksi', section: 'transactions' },
        { label: 'Buku Besar', section: 'ledger' },
        { label: 'Akun', section: 'accounts' },
        { label: 'Rekonsiliasi Bank', section: 'reconciliation' },
        { label: 'Aset', section: 'assets' },
        { label: 'Laporan', section: 'reports' },
        { label: 'Pengaturan', section: 'settings' },
    ];

    return (
        <header className="glass-effect p-4 mb-4 md:mb-8 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm md:text-lg">FF</span>
                        </div>
                        <h1 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                            FinanceFlow Pro
                        </h1>
                    </div>
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-white p-2">
                        {isMenuOpen ? '✕' : '☰'}
                    </button>
                </div>
                <nav className={`${isMenuOpen ? 'block' : 'hidden'} md:flex md:justify-center md:space-x-4 mt-4 md:mt-0`}>
                    <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 w-full md:w-auto">
                        {navItems.map(item => (
                            <NavButton key={item.section} {...item} activeSection={activeSection} onClick={handleNavClick} />
                        ))}
                    </div>
                </nav>
            </div>
        </header>
    );
};

export default Header;