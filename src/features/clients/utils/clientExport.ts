import ExcelJS from 'exceljs';
import { TransactionType } from '../../../types';
import type { TeamProjectPayment, Transaction } from '../../../types';
import type { ClientWithSummary } from '../hooks/useClients';

type ExportCell = string | number | boolean;
type ExportRow = Record<string, ExportCell>;

const currencyFormat = '"Rp" #,##0;[Red]-"Rp" #,##0';
const currencyColumns = new Set([
    'Total Package', 'Total Dibayar', 'Sisa Pembayaran', 'Total Acara', 'Harga Satuan Paket',
    'DP Teridentifikasi dari Transaksi', 'Total Pembayaran Masuk', 'Total Pengeluaran Proyek',
    'Nominal', 'Fee Acara', 'Fee Honor', 'Diskon', 'Biaya Cetak', 'Biaya Transport',
]);

const createWorksheet = (
    workbook: ExcelJS.Workbook,
    name: string,
    headers: string[],
    rows: ExportRow[],
) => {
    const worksheet = workbook.addWorksheet(name, {
        views: [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2', showGridLines: false }],
    });
    worksheet.columns = headers.map(header => ({
        header,
        key: header,
        width: Math.min(38, Math.max(15, header.length + 4)),
        style: currencyColumns.has(header) ? { numFmt: currencyFormat } : undefined,
    }));
    rows.forEach(row => worksheet.addRow(row));
    worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: headers.length },
    };
    worksheet.getRow(1).height = 30;
    worksheet.getRow(1).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF800F0F' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        cell.border = { bottom: { style: 'medium', color: { argb: 'FFB88746' } } };
    });
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
            row.height = 22;
            row.eachCell(cell => {
                cell.alignment = { vertical: 'top', wrapText: true };
                if (rowNumber % 2 === 0) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F8FA' } };
                }
            });
        }
    });
    return worksheet;
};

const serialize = (value: unknown) => value == null ? '' : JSON.stringify(value);

export const buildClientExportWorkbook = (
    clients: ClientWithSummary[],
    transactions: Transaction[],
    teamProjectPayments: TeamProjectPayment[],
): ExcelJS.Workbook => {
    const projects = clients.flatMap(client => client.projects.map(project => ({ client, project })));
    const projectById = new Map(projects.map(({ project }) => [project.id, project]));
    const clientById = new Map(clients.map(client => [client.id, client]));
    const projectIds = new Set(projectById.keys());
    const transactionsByProject = new Map<string, Transaction[]>();
    transactions.forEach(transaction => {
        if (!transaction.projectId || !projectIds.has(transaction.projectId)) return;
        const projectTransactions = transactionsByProject.get(transaction.projectId) || [];
        projectTransactions.push(transaction);
        transactionsByProject.set(transaction.projectId, projectTransactions);
    });

    const clientRows: ExportRow[] = clients.map(client => ({
        'ID Pengantin': client.id,
        'Nama': client.name,
        'Email': client.email || '',
        'Telepon': client.phone || '',
        'WhatsApp': client.whatsapp || '',
        'Instagram': client.instagram || '',
        'Alamat': client.address || '',
        'Alamat Rumah': client.homeAddress || '',
        'Jenis Pengantin': client.clientType || '',
        'Status': client.status || '',
        'Tanggal Bergabung': client.since || '',
        'Kontak Terakhir': client.lastContact || '',
        'Total Acara': client.projects.length,
        'Total Package': client.totalProjectValue,
        'Total Dibayar': client.projects.reduce((sum, project) => sum + (project.amountPaid || 0), 0),
        'Sisa Pembayaran': client.balanceDue,
        'Status Pembayaran Terbaru': client.overallPaymentStatus || '',
        'Package Terbaru': client.PackageTerbaru,
    }));

    const projectRows: ExportRow[] = projects.map(({ client, project }) => {
        const projectTransactions = transactionsByProject.get(project.id) || [];
        const identifiedDp = projectTransactions
            .filter(transaction => transaction.type === TransactionType.INCOME
                && /(^|\W)dp(\W|$)/i.test(`${transaction.description} ${transaction.category}`))
            .reduce((sum, transaction) => sum + transaction.amount, 0);
        const projectExpenses = projectTransactions
            .filter(transaction => transaction.type === TransactionType.EXPENSE)
            .reduce((sum, transaction) => sum + transaction.amount, 0);
        const projectPayments = projectTransactions
            .filter(transaction => transaction.type === TransactionType.INCOME)
            .reduce((sum, transaction) => sum + transaction.amount, 0);

        return {
            'ID Pengantin': client.id,
            'Nama Pengantin': client.name,
            'ID Acara': project.id,
            'Nama Acara': project.projectName,
            'Jenis Acara': project.projectType,
            'Tanggal Acara': project.date,
            'Jam Mulai': project.startTime || '',
            'Jam Selesai': project.endTime || '',
            'Lokasi': project.location || '',
            'Alamat Lengkap': project.address || '',
            'Google Maps': project.googleMapsLink || '',
            'Status Acara': project.status || '',
            'Status Booking': project.bookingStatus || '',
            'Progress (%)': project.progress,
            'Nama Paket': project.packageName || '',
            'ID Paket': project.packageId || '',
            'Durasi Paket': project.durationSelection || '',
            'Harga Satuan Paket': project.unitPrice ?? '',
            'Add-On': (project.addOns || []).map(item => `${item.name} (${item.price})`).join('; '),
            'Paket Tambahan': (project.additionalPackages || []).map(item => `${item.name} (${item.price})`).join('; '),
            'Total Acara': project.totalCost,
            'Total Dibayar': project.amountPaid,
            'Total Pembayaran Masuk': projectPayments,
            'DP Teridentifikasi dari Transaksi': identifiedDp,
            'Sisa Pembayaran': project.totalCost - project.amountPaid,
            'Total Pengeluaran Proyek': projectExpenses,
            'Status Pembayaran': project.paymentStatus || '',
            'Bukti DP': project.dpProofUrl || '',
            'Diskon': project.discountAmount ?? 0,
            'Kode Promo ID': project.promoCodeId || '',
            'Biaya Cetak': project.printingCost ?? 0,
            'Detail Cetak': serialize(project.printingDetails),
            'Biaya Transport': project.transportCost ?? 0,
            'Transport Terbayar': project.transportPaid ?? false,
            'Detail Transport': serialize(project.transportDetails),
            'Biaya Tambahan': serialize(project.customCosts),
            'Drive Acara': project.driveLink || '',
            'Drive Klien': project.clientDriveLink || '',
            'Drive Hasil Akhir': project.finalDriveLink || '',
            'Catatan': project.notes || '',
            'Tugas': serialize(project.tasks),
            'Tim Ditugaskan': (project.team || []).map(member => `${member.name} (${member.role})`).join('; '),
        };
    });

    const projectTransactions = transactions.filter(transaction => transaction.projectId && projectIds.has(transaction.projectId));
    const paymentRows: ExportRow[] = projectTransactions
        .filter(transaction => transaction.type === TransactionType.INCOME)
        .map(transaction => {
            const project = projectById.get(transaction.projectId!);
            const client = project ? clientById.get(project.clientId) : undefined;
            return {
                'ID Pengantin': client?.id || '',
                'Nama Pengantin': client?.name || '',
                'ID Acara': transaction.projectId || '',
                'Nama Acara': project?.projectName || '',
                'ID Transaksi': transaction.id,
                'Tanggal': transaction.date,
                'Tipe': transaction.type,
                'Deskripsi / Keterangan': transaction.description,
                'Kategori': transaction.category,
                'Nominal': transaction.amount,
                'Metode Pembayaran': transaction.method,
                'ID Kartu': transaction.cardId || '',
                'ID Kantong': transaction.pocketId || '',
                'ID Item Cetak': transaction.printingItemId || '',
                'Tanda Tangan Vendor': transaction.vendorSignature || '',
                'Dibuat Pada': transaction.createdAt || '',
                'Diperbarui Pada': transaction.updatedAt || '',
            };
        });

    const expenseRows: ExportRow[] = projectTransactions
        .filter(transaction => transaction.type === TransactionType.EXPENSE)
        .map(transaction => {
            const project = projectById.get(transaction.projectId!);
            const client = project ? clientById.get(project.clientId) : undefined;
            return {
                'ID Pengantin': client?.id || '',
                'Nama Pengantin': client?.name || '',
                'ID Acara': transaction.projectId || '',
                'Nama Acara': project?.projectName || '',
                'Tanggal Acara': project?.date || '',
                'ID Pengeluaran': transaction.id,
                'Tanggal Pengeluaran': transaction.date,
                'Deskripsi Pengeluaran': transaction.description,
                'Kategori': transaction.category,
                'Nominal': transaction.amount,
                'Metode Pembayaran': transaction.method,
                'ID Kartu': transaction.cardId || '',
                'ID Kantong': transaction.pocketId || '',
                'ID Item Cetak': transaction.printingItemId || '',
            };
        });

    const teamRows: ExportRow[] = [];
    const matchedTeamPaymentIds = new Set<string>();
    projects.forEach(({ client, project }) => {
        (project.team || []).forEach(member => {
            const matchingPayments = teamProjectPayments.filter(payment =>
                payment.projectId === project.id && payment.teamMemberId === member.memberId,
            );
            if (matchingPayments.length === 0) {
                teamRows.push({
                    'ID Pengantin': client.id,
                    'Nama Pengantin': client.name,
                    'ID Acara': project.id,
                    'Nama Acara': project.projectName,
                    'Tanggal Acara': project.date,
                    'ID Anggota Tim': member.memberId,
                    'Nama Anggota Tim': member.name,
                    'Peran': member.role,
                    'Subpekerjaan': member.subJob || '',
                    'Fee Acara': member.fee,
                    'Tanggal Tugas': '',
                    'Fee Honor': '',
                    'Status Pembayaran Honor': '',
                    'ID Pembayaran Tim': '',
                });
                return;
            }

            matchingPayments.forEach(payment => {
                matchedTeamPaymentIds.add(payment.id);
                teamRows.push({
                    'ID Pengantin': client.id,
                    'Nama Pengantin': client.name,
                    'ID Acara': project.id,
                    'Nama Acara': project.projectName,
                    'Tanggal Acara': project.date,
                    'ID Anggota Tim': member.memberId,
                    'Nama Anggota Tim': member.name,
                    'Peran': member.role || payment.role || '',
                    'Subpekerjaan': member.subJob || '',
                    'Fee Acara': member.fee,
                    'Tanggal Tugas': payment.date,
                    'Fee Honor': payment.fee,
                    'Status Pembayaran Honor': payment.status,
                    'ID Pembayaran Tim': payment.id,
                });
            });
        });
    });

    teamProjectPayments
        .filter(payment => projectIds.has(payment.projectId) && !matchedTeamPaymentIds.has(payment.id))
        .forEach(payment => {
            const project = projectById.get(payment.projectId);
            const client = project ? clientById.get(project.clientId) : undefined;
            teamRows.push({
                'ID Pengantin': client?.id || '',
                'Nama Pengantin': client?.name || '',
                'ID Acara': project?.id || payment.projectId,
                'Nama Acara': project?.projectName || '',
                'Tanggal Acara': project?.date || '',
                'ID Anggota Tim': payment.teamMemberId,
                'Nama Anggota Tim': payment.teamMemberName,
                'Peran': payment.role || '',
                'Subpekerjaan': '',
                'Fee Acara': '',
                'Tanggal Tugas': payment.date,
                'Fee Honor': payment.fee,
                'Status Pembayaran Honor': payment.status,
                'ID Pembayaran Tim': payment.id,
            });
        });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Vena Pindah';
    workbook.created = new Date();
    workbook.modified = new Date();

    const summary = workbook.addWorksheet('Ringkasan', { views: [{ showGridLines: false }] });
    summary.columns = [{ width: 34 }, { width: 26 }, { width: 5 }, { width: 34 }, { width: 26 }];
    summary.mergeCells('A1:E1');
    summary.getCell('A1').value = 'BACKUP DATA PENGANTIN';
    summary.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF800F0F' } };
    summary.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
    summary.getCell('A1').alignment = { vertical: 'middle' };
    summary.getRow(1).height = 38;
    summary.mergeCells('A2:E2');
    summary.getCell('A2').value = `Dibuat ${new Date().toLocaleString('id-ID')}`;
    summary.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } };
    summary.addRow([]);
    const summaryHeader = summary.addRow(['RINGKASAN DATA', 'JUMLAH / NILAI', '', 'RINGKASAN KEUANGAN', 'NILAI']);
    summaryHeader.height = 26;
    [1, 2, 4, 5].forEach(column => {
        const cell = summaryHeader.getCell(column);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF800F0F' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', wrapText: true };
    });
    const summaryRows: [string, ExportCell, string, string, ExportCell][] = [
        ['Pengantin', clients.length, '', 'Nilai Total Proyek', projects.reduce((sum, item) => sum + item.project.totalCost, 0)],
        ['Acara / Proyek', projects.length, '', 'Total Pembayaran Masuk', projectTransactions.filter(item => item.type === TransactionType.INCOME).reduce((sum, item) => sum + item.amount, 0)],
        ['Transaksi Pembayaran', paymentRows.length, '', 'Total Pengeluaran Proyek', expenseRows.reduce((sum, item) => sum + Number(item.Nominal || 0), 0)],
        ['Pengeluaran Proyek', expenseRows.length, '', 'Sisa Pembayaran', projects.reduce((sum, item) => sum + item.project.totalCost - item.project.amountPaid, 0)],
        ['Data Honor Tim', teamRows.length, '', 'Total Fee Tim', teamProjectPayments.filter(payment => projectIds.has(payment.projectId)).reduce((sum, payment) => sum + payment.fee, 0)],
    ];
    summaryRows.forEach(values => {
        const row = summary.addRow(values);
        row.height = 23;
        row.getCell(2).numFmt = '#,##0';
        row.getCell(5).numFmt = currencyFormat;
        row.eachCell(cell => {
            cell.alignment = { vertical: 'middle', wrapText: true };
            if (row.number % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F8FA' } };
        });
    });

    createWorksheet(workbook, 'Pengantin', [
        'ID Pengantin', 'Nama', 'Email', 'Telepon', 'WhatsApp', 'Instagram', 'Alamat', 'Alamat Rumah',
        'Jenis Pengantin', 'Status', 'Tanggal Bergabung', 'Kontak Terakhir', 'Total Acara', 'Total Package',
        'Total Dibayar', 'Sisa Pembayaran', 'Status Pembayaran Terbaru', 'Package Terbaru',
    ], clientRows);
    createWorksheet(workbook, 'Acara & Paket', [
        'ID Pengantin', 'Nama Pengantin', 'ID Acara', 'Nama Acara', 'Jenis Acara', 'Tanggal Acara', 'Jam Mulai',
        'Jam Selesai', 'Lokasi', 'Alamat Lengkap', 'Google Maps', 'Status Acara', 'Status Booking', 'Progress (%)',
        'Nama Paket', 'ID Paket', 'Durasi Paket', 'Harga Satuan Paket', 'Add-On', 'Paket Tambahan', 'Total Acara',
        'Total Dibayar', 'Total Pembayaran Masuk', 'DP Teridentifikasi dari Transaksi', 'Sisa Pembayaran',
        'Total Pengeluaran Proyek', 'Status Pembayaran', 'Bukti DP',
        'Diskon', 'Kode Promo ID', 'Biaya Cetak', 'Detail Cetak', 'Biaya Transport', 'Transport Terbayar',
        'Detail Transport', 'Biaya Tambahan', 'Drive Acara', 'Drive Klien', 'Drive Hasil Akhir', 'Catatan', 'Tugas',
        'Tim Ditugaskan',
    ], projectRows);
    createWorksheet(workbook, 'Pembayaran', [
        'ID Pengantin', 'Nama Pengantin', 'ID Acara', 'Nama Acara', 'ID Transaksi', 'Tanggal', 'Tipe',
        'Deskripsi / Keterangan', 'Kategori', 'Nominal', 'Metode Pembayaran', 'ID Kartu', 'ID Kantong',
        'ID Item Cetak', 'Tanda Tangan Vendor', 'Dibuat Pada', 'Diperbarui Pada',
    ], paymentRows);
    createWorksheet(workbook, 'Pengeluaran Proyek', [
        'ID Pengantin', 'Nama Pengantin', 'ID Acara', 'Nama Acara', 'Tanggal Acara', 'ID Pengeluaran',
        'Tanggal Pengeluaran', 'Deskripsi Pengeluaran', 'Kategori', 'Nominal', 'Metode Pembayaran', 'ID Kartu',
        'ID Kantong', 'ID Item Cetak',
    ], expenseRows);
    createWorksheet(workbook, 'Tim & Honor', [
        'ID Pengantin', 'Nama Pengantin', 'ID Acara', 'Nama Acara', 'Tanggal Acara', 'ID Anggota Tim',
        'Nama Anggota Tim', 'Peran', 'Subpekerjaan', 'Fee Acara', 'Tanggal Tugas', 'Fee Honor',
        'Status Pembayaran Honor', 'ID Pembayaran Tim',
    ], teamRows);
    return workbook;
};

export const exportClientsToExcel = async (
    clients: ClientWithSummary[],
    transactions: Transaction[],
    teamProjectPayments: TeamProjectPayment[],
) => {
    const workbook = buildClientExportWorkbook(clients, transactions, teamProjectPayments);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `data-pengantin-lengkap-${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
};