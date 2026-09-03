import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';
import { getFileUrl } from '@/lib/s3';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const where = session.user.role === 'ADMIN' ? {} : { audit: { auditorId: session.user.id } };

  const caps = await prisma.cAP.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      audit: { include: { factory: true, template: true, auditor: { select: { name: true } } } },
      itemResult: { include: { item: true, photos: true } },
      attachments: true,
    },
  });

  const workbook = new ExcelJS.Workbook();

  // Summary sheet
  const summary = workbook.addWorksheet('Summary');
  summary.columns = [
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Count', key: 'count', width: 12 },
  ];
  const counts: Record<string, number> = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0 };
  for (const cap of caps) counts[cap.status] = (counts[cap.status] || 0) + 1;
  summary.addRows(Object.entries(counts).map(([status, count]) => ({ status, count })));

  // Per-CAP sheets
  for (const cap of caps) {
    const name = `${cap.status.slice(0, 3)} ${cap.audit.factory.name}`.replace(/[*:/?\[\]]/g, '_').slice(0, 31) || `CAP_${cap.id.slice(0, 6)}`;
    const sheet = workbook.addWorksheet(name);
    sheet.columns = [
      { header: 'Field', key: 'field', width: 24 },
      { header: 'Value', key: 'value', width: 60 },
    ];

    sheet.addRows([
      { field: 'Factory', value: cap.audit.factory.name },
      { field: 'Vendor', value: cap.audit.factory.vendorName || '' },
      { field: 'Template', value: cap.audit.template.name },
      { field: 'Auditor', value: cap.audit.auditor.name || '' },
      { field: 'Finding', value: cap.finding },
      { field: 'Corrective Action', value: cap.correctiveAction || '' },
      { field: 'Status', value: cap.status },
      { field: 'Target Date', value: cap.targetDate ? cap.targetDate.toISOString() : '' },
      { field: 'Plan Date', value: cap.planDate ? cap.planDate.toISOString() : '' },
      { field: 'Action Date', value: cap.actionDate ? cap.actionDate.toISOString() : '' },
      { field: 'Verified By', value: cap.verifiedBy || '' },
      { field: 'Audit Link', value: `${process.env.NEXTAUTH_URL}/audits/${cap.audit.id}` },
    ]);

    // Hyperlink on audit link cell
    const linkCell = sheet.getCell(12, 2);
    linkCell.value = { text: 'Open Audit', hyperlink: `${process.env.NEXTAUTH_URL}/audits/${cap.audit.id}` };
    linkCell.style = { font: { color: { argb: 'FF0000FF' }, underline: true } };

    // Evidence photos (max 3 to keep size reasonable)
    let row = 14;
    sheet.getCell(row, 1).value = 'Evidence Photos';
    row++;
    for (const photo of cap.itemResult.photos.slice(0, 3)) {
      const url = await getFileUrl(photo.cloudStoragePath);
      try {
        const res = await fetch(url);
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          const buffer = Buffer.from(new Uint8Array(arrayBuffer)) as any;
          const imageId = workbook.addImage({ buffer, extension: 'jpeg' });
          sheet.addImage(imageId, { tl: { col: 1, row: row - 1 }, ext: { width: 200, height: 150 } });
          sheet.getCell(row, 2).value = photo.caption || '';
          row += 8;
        }
      } catch (err) {
        console.error('Failed to embed CAP photo', err);
      }
    }

    // Attachments list
    row += 1;
    sheet.getCell(row, 1).value = 'Attachments';
    row++;
    for (const att of cap.attachments) {
      const url = await getFileUrl(att.cloudStoragePath);
      const cell = sheet.getCell(row, 2);
      cell.value = { text: att.fileName, hyperlink: url };
      cell.style = { font: { color: { argb: 'FF0000FF' }, underline: true } };
      row++;
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="caps-export.xlsx"',
    },
  });
}
