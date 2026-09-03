import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatDuration, formatDateTime } from '@/lib/utils';

async function buildAuditHtml(auditId: string) {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    include: {
      factory: true,
      template: true,
      auditor: { select: { name: true, email: true } },
      sections: {
        orderBy: { sortOrder: 'asc' },
        include: {
          items: {
            orderBy: { item: { sortOrder: 'asc' } },
            include: { item: true, photos: true },
          },
        },
      },
      photos: true,
      caps: { include: { itemResult: { include: { item: true } } } },
    },
  });

  if (!audit) return null;

  const statusStyle = (status: string) => {
    const color = status === 'COMPLETED' ? 'green' : status === 'IN_PROGRESS' ? 'blue' : 'gray';
    return `display:inline-block;padding:4px 10px;border-radius:4px;background:${color};color:white;font-size:12px;text-transform:uppercase;`;
  };

  const resultBadge = (result: string | null) => {
    const color = result === 'PASS' ? '#16a34a' : result === 'FAIL' ? '#dc2626' : result === 'NA' ? '#6b7280' : '#9ca3af';
    return `display:inline-block;padding:2px 8px;border-radius:4px;background:${color};color:white;font-size:11px;`;
  };

  let sectionsHtml = '';
  for (const section of audit.sections) {
    const sectionScore = section.score !== null && section.score !== undefined ? section.score.toFixed(1) : '-';
    sectionsHtml += `
      <div style="margin-bottom:24px;">
        <h2 style="font-size:18px;margin-bottom:12px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">${section.title} <span style="font-size:14px;color:#64748b;">(Score: ${sectionScore} / ${section.maxScore || 5})</span></h2>
        ${section.items
          .map(
            (item) => `
          <div style="margin-bottom:16px;padding:12px;border:1px solid #e2e8f0;border-radius:6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <strong style="font-size:14px;">${item.item.text}</strong>
              <span style="${resultBadge(item.result)}">${item.result || 'Pending'}</span>
            </div>
            <div style="font-size:12px;color:#475569;margin-bottom:8px;">Score: ${item.score !== null && item.score !== undefined ? item.score : '-'} / ${item.item.maxScore}</div>
            ${item.findings ? `<div style="font-size:12px;color:#dc2626;margin-bottom:6px;"><strong>Findings:</strong> ${item.findings}</div>` : ''}
            ${item.remarks ? `<div style="font-size:12px;color:#64748b;margin-bottom:6px;"><strong>Remarks:</strong> ${item.remarks}</div>` : ''}
            ${item.photos.length > 0
              ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">${item.photos
                  .map(
                    (photo) => `<div style="width:140px;">
                      <img src="${photo.cloudStoragePath}" style="width:140px;height:100px;object-fit:cover;border-radius:4px;" />
                      <div style="font-size:10px;color:#64748b;">${photo.caption || ''}</div>
                    </div>`
                  )
                  .join('')}</div>`
              : ''}
          </div>`
          )
          .join('')}
      </div>`;
  }

  const capRows = audit.caps
    .map(
      (cap) => `
    <tr>
      <td style="border:1px solid #e2e8f0;padding:6px;font-size:12px;">${cap.itemResult.item.text}</td>
      <td style="border:1px solid #e2e8f0;padding:6px;font-size:12px;">${cap.finding}</td>
      <td style="border:1px solid #e2e8f0;padding:6px;font-size:12px;">${cap.correctiveAction || '-'}</td>
      <td style="border:1px solid #e2e8f0;padding:6px;font-size:12px;">${cap.status}</td>
    </tr>`
    )
    .join('');

  return `
    <html>
      <head>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 32px; max-width: 900px; margin: 0 auto; }
          h1 { font-size: 24px; margin-bottom: 8px; }
          .subtitle { color: #64748b; font-size: 14px; margin-bottom: 24px; }
          .meta { background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
          .meta-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { background: #f1f5f9; text-align: left; font-size: 12px; padding: 8px; border: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <h1>Audit Report</h1>
        <p class="subtitle">${audit.template.name} — ${audit.factory.name}</p>
        <div class="meta">
          <div class="meta-row"><span>Factory:</span><span>${audit.factory.name} — ${audit.factory.vendorName || ''}</span></div>
          <div class="meta-row"><span>Location:</span><span>${[audit.factory.city, audit.factory.country].filter(Boolean).join(', ') || '-'}</span></div>
          <div class="meta-row"><span>Auditor:</span><span>${audit.auditor.name || audit.auditor.email || '-'}</span></div>
          <div class="meta-row"><span>Status:</span><span style="${statusStyle(audit.status)}">${audit.status}</span></div>
          <div class="meta-row"><span>Scheduled:</span><span>${formatDateTime(audit.scheduledAt)}</span></div>
          <div class="meta-row"><span>Completed:</span><span>${formatDateTime(audit.endTime)}</span></div>
          <div class="meta-row"><span>Duration:</span><span>${formatDuration(audit.totalDuration)}</span></div>
          <div class="meta-row"><span>Overall Score:</span><span>${audit.overallScore !== null && audit.overallScore !== undefined ? audit.overallScore.toFixed(1) : '-'}</span></div>
        </div>

        ${sectionsHtml}

        <h2 style="font-size:18px;margin-top:32px;margin-bottom:12px;">Corrective Action Plans</h2>
        ${capRows ? `<table>
          <thead>
            <tr><th>Item</th><th>Finding</th><th>Corrective Action</th><th>Status</th></tr>
          </thead>
          <tbody>${capRows}</tbody>
        </table>` : '<p style="font-size:12px;color:#64748b;">No CAPs.</p>'}

        <h2 style="font-size:18px;margin-top:32px;margin-bottom:12px;">All Photos</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${audit.photos
            .map(
              (photo) => `<div style="width:140px;">
                <img src="${photo.cloudStoragePath}" style="width:140px;height:100px;object-fit:cover;border-radius:4px;" />
                <div style="font-size:10px;color:#64748b;">${photo.caption || ''}</div>
              </div>`
            )
            .join('')}
        </div>
      </body>
    </html>
  `;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const audit = await prisma.audit.findUnique({ where: { id: params.id }, select: { auditorId: true, status: true } });
  if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.user.role !== 'ADMIN' && audit.auditorId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (audit.status !== 'COMPLETED') {
    return NextResponse.json({ error: 'Report only available for completed audits' }, { status: 400 });
  }

  const html = await buildAuditHtml(params.id);
  if (!html) return NextResponse.json({ error: 'Failed to build report' }, { status: 500 });

  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    const pdfArray = new Uint8Array(pdf);
    const pdfBlob = new Blob([pdfArray.buffer], { type: 'application/pdf' });
    return new NextResponse(pdfBlob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="audit-report-${params.id}.pdf"`,
      },
    });
  } catch (err) {
    console.error('PDF generation failed', err);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
