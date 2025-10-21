
import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '' }) => {
    return (
        <div className={`glass-effect p-4 md:p-6 rounded-xl card-hover ${className}`}>
            {children}
        </div>
    );
};

export default Card;
