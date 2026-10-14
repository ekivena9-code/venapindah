import { describe, expect, it } from 'vitest';
import type { Worksheet } from 'exceljs';
import { buildClientExportWorkbook } from './clientExport';

const cellValue = (sheet: Worksheet, rowNumber: number, header: string) => {
    const headers = sheet.getRow(1).values as (string | undefined)[];
    return sheet.getRow(rowNumber).getCell(headers.indexOf(header)).value;
};

describe('client detail workbook export', () => {
    it('exports client, project, payment, and team details in linked sheets', () => {
        const project = {
            id: 'project-1',
            clientId: 'client-1',
            projectName: 'Wedding Rina',
            projectType: 'Pernikahan',
            date: '2026-11-20',
            packageName: 'Paket Gold',
            packageId: 'package-1',
            addOns: [],
            totalCost: 12000000,
            amountPaid: 4000000,
            paymentStatus: 'DP Terbayar',
            progress: 25,
            team: [{ memberId: 'member-1', name: 'Ayu', role: 'Fotografer', fee: 1000000 }],
            dpProofUrl: 'https://example.com/dp.jpg',
            location: 'Jakarta',
        };
        const client = {
            id: 'client-1',
            name: 'Rina',
            email: 'rina@example.com',
            phone: '0812345678',
            whatsapp: '0812345678',
            instagram: '@rina',
            since: '2026-01-01',
            lastContact: '2026-02-01',
            status: 'Aktif',
            clientType: 'Langsung',
            address: 'Jakarta',
            projects: [project],
            totalProjectValue: 12000000,
            balanceDue: 8000000,
            PackageTerbaru: 'Paket Gold',
            overallPaymentStatus: 'DP Terbayar',
            mostRecentProject: project,
        } as any;

        const workbook = buildClientExportWorkbook(
            [client],
            [{
                id: 'transaction-1',
                projectId: 'project-1',
                date: '2026-02-01',
                description: 'DP Paket Gold',
                amount: 4000000,
                type: 'Pemasukan',
                category: 'Pembayaran Pengantin',
                method: 'Transfer Bank',
            } as any, {
                id: 'expense-1',
                projectId: 'project-1',
                date: '2026-02-02',
                description: 'Sewa perlengkapan',
                amount: 750000,
                type: 'Pengeluaran',
                category: 'Operasional Acara',
                method: 'Transfer Bank',
            } as any],
            [{
                id: 'team-payment-1',
                projectId: 'project-1',
                teamMemberName: 'Ayu',
                teamMemberId: 'member-1',
                role: 'Fotografer',
                date: '2026-11-20',
                status: 'Unpaid',
                fee: 1000000,
            }],
        );

        expect(workbook.worksheets.map(sheet => sheet.name)).toEqual([
            'Ringkasan', 'Pengantin', 'Acara & Paket', 'Pembayaran', 'Pengeluaran Proyek', 'Tim & Honor',
        ]);
        const projectSheet = workbook.getWorksheet('Acara & Paket')!;
        const paymentSheet = workbook.getWorksheet('Pembayaran')!;
        const expenseSheet = workbook.getWorksheet('Pengeluaran Proyek')!;
        const teamSheet = workbook.getWorksheet('Tim & Honor')!;

        expect(cellValue(projectSheet, 2, 'DP Teridentifikasi dari Transaksi')).toBe(4000000);
        expect(cellValue(projectSheet, 2, 'Bukti DP')).toBe('https://example.com/dp.jpg');
        expect(cellValue(projectSheet, 2, 'Total Pengeluaran Proyek')).toBe(750000);
        expect(cellValue(paymentSheet, 2, 'ID Pengantin')).toBe('client-1');
        expect(cellValue(paymentSheet, 2, 'Deskripsi / Keterangan')).toBe('DP Paket Gold');
        expect(paymentSheet.rowCount).toBe(2);
        expect(cellValue(expenseSheet, 2, 'ID Pengeluaran')).toBe('expense-1');
        expect(cellValue(expenseSheet, 2, 'Nominal')).toBe(750000);
        expect(cellValue(teamSheet, 2, 'Status Pembayaran Honor')).toBe('Unpaid');
        expect(cellValue(teamSheet, 2, 'Nama Anggota Tim')).toBe('Ayu');
        expect(projectSheet.views[0].state).toBe('frozen');
        expect(projectSheet.autoFilter).toBeTruthy();
    });
});