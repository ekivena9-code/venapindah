import React from 'react';
import { Card, CardType, FinancialPocket, Transaction } from '../../../types';
import Modal from '../../../shared/ui/Modal';
import { formatCurrency } from '../../../utils/currency';
import { customizeUiText, useUiTextOverrides } from '../../../utils/uiTextCustomization';

interface FinanceStatDetailModalProps {
    activeStatModal: string | null;
    onClose: () => void;
    cards: Card[];
    pockets: FinancialPocket[];
    thisMonthIncome: Transaction[];
    thisMonthExpense: Transaction[];
}

const statModalTitles: { [key: string]: string } = {
    assets: 'Rincian Total Aset',
    pockets: 'Rincian Dana di Kantong',
    income: `Pemasukan Bulan ${new Date().toLocaleString('id-ID', { month: 'long' })}`,
    expense: `Pengeluaran Bulan ${new Date().toLocaleString('id-ID', { month: 'long' })}`
};

const FinanceStatDetailModal: React.FC<FinanceStatDetailModalProps> = ({
    activeStatModal,
    onClose,
    cards,
    pockets,
    thisMonthIncome,
    thisMonthExpense
}) => {
    const uiTextOverrides = useUiTextOverrides();
    if (!activeStatModal) return null;
    const title = customizeUiText(
        `finance.detail.${activeStatModal}.title`,
        statModalTitles[activeStatModal] || '',
        uiTextOverrides,
    );

    return (
        <Modal
            isOpen={!!activeStatModal}
            onClose={onClose}
            title={title}
            size="2xl"
        >
            <div className="max-h-[60vh] overflow-y-auto pr-2">
                {activeStatModal === 'assets' && (
                    <div className="space-y-3">
                        {cards.map(card => (
                            <div key={card.id} className="p-3 bg-brand-bg rounded-lg flex justify-between items-center">
                                <p className="font-semibold text-brand-text-light">
                                    {card.cardHolderName} {card.cardType !== CardType.TUNAI ? `(${card.bankName} **** ${card.lastFourDigits})` : '(Tunai)'}
                                </p>
                                <p className="font-semibold text-brand-text-light">{formatCurrency(card.balance)}</p>
                            </div>
                        ))}
                    </div>
                )}
                {activeStatModal === 'pockets' && (
                    <div className="space-y-3">
                        {pockets.map(pocket => (
                            <div key={pocket.id} className="p-3 bg-brand-bg rounded-lg flex justify-between items-center">
                                <p className="font-semibold text-brand-text-light">{pocket.name}</p>
                                <p className="font-semibold text-brand-text-light">{formatCurrency(pocket.amount)}</p>
                            </div>
                        ))}
                    </div>
                )}
                {activeStatModal === 'income' && (
                    <div className="space-y-3">
                        {thisMonthIncome.length > 0 ? (
                            thisMonthIncome.map(tx => (
                                <div key={tx.id} className="p-3 bg-brand-bg rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-brand-text-light">{tx.description}</p>
                                        <p className="text-xs text-brand-text-secondary">{new Date(tx.date).toLocaleDateString('id-ID')}</p>
                                    </div>
                                    <p className="font-semibold text-[#166534]">{formatCurrency(tx.amount)}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-brand-text-secondary py-8">{customizeUiText('finance.detail.income.empty', 'Tidak ada pemasukan bulan ini.', uiTextOverrides)}</p>
                        )}
                    </div>
                )}
                {activeStatModal === 'expense' && (
                    <div className="space-y-3">
                        {thisMonthExpense.length > 0 ? (
                            thisMonthExpense.map(tx => (
                                <div key={tx.id} className="p-3 bg-brand-bg rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-brand-text-light">{tx.description}</p>
                                        <p className="text-xs text-brand-text-secondary">{new Date(tx.date).toLocaleDateString('id-ID')}</p>
                                    </div>
                                    <p className="font-semibold text-[#DC2626]">{formatCurrency(tx.amount)}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-brand-text-secondary py-8">{customizeUiText('finance.detail.expense.empty', 'Tidak ada pengeluaran bulan ini.', uiTextOverrides)}</p>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default FinanceStatDetailModal;
