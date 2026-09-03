import { PrismaClient, Role, AuditStatus, ItemResult, CAPStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.$transaction([
    prisma.changeHistory.deleteMany(),
    prisma.cAPAttachment.deleteMany(),
    prisma.cAP.deleteMany(),
    prisma.photo.deleteMany(),
    prisma.auditItemResult.deleteMany(),
    prisma.auditSection.deleteMany(),
    prisma.gPSLog.deleteMany(),
    prisma.audit.deleteMany(),
    prisma.checklistItem.deleteMany(),
    prisma.templateSection.deleteMany(),
    prisma.auditTemplate.deleteMany(),
    prisma.factory.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // Users
  const admin = await prisma.user.create({
    data: {
      email: 'john@doe.com',
      name: 'John Doe',
      password: await bcrypt.hash('johndoe123', 10),
      role: Role.ADMIN,
      active: true,
    },
  });

  const auditor = await prisma.user.create({
    data: {
      email: 'auditor@vcm.com',
      name: 'Sample Auditor',
      password: await bcrypt.hash('auditor123', 10),
      role: Role.AUDITOR,
      active: true,
    },
  });

  // Factories
  const factories = await prisma.$transaction(
    [
      { name: 'Furnitures Co.', vendorName: 'Furnitures Vendor Ltd.', address: '123 Factory Lane', city: 'Dongguan', country: 'China', contactName: 'Li Wei', contactEmail: 'liwei@furnituresco.com' },
      { name: 'Textiles Plus', vendorName: 'Textiles Plus Group', address: '456 Mill Road', city: 'Shenzhen', country: 'China', contactName: 'Wang Fang', contactEmail: 'wangfang@textilesplus.com' },
      { name: 'ElectroWorks', vendorName: 'ElectroWorks Mfg', address: '789 Tech Park', city: 'Ho Chi Minh City', country: 'Vietnam', contactName: 'Nguyen An', contactEmail: 'nguyenan@electroworks.com' },
    ].map((f) => prisma.factory.create({ data: f }))
  );

  // Templates
  const templateData = [
    {
      code: 'template-mfg',
      name: 'Onboarding Audit',
      description: 'Comprehensive manufacturing audit based on QIMA structure.',
      sections: [
        {
          title: 'Management Systems',
          items: ['Management commitment and responsibility', 'Documented quality policy and objectives', 'Organizational chart and responsibilities', 'Internal audit process'],
        },
        {
          title: 'Facility and Environment',
          items: ['Facility cleanliness and organization', 'Environmental controls', 'Security and access control', 'Maintenance program'],
        },
        {
          title: 'Incoming Materials',
          items: ['Incoming inspection procedures', 'Supplier evaluation records', 'Material traceability', 'Storage and handling'],
        },
        {
          title: 'Production Control',
          items: ['Production planning and workflow', 'Work instructions availability', 'In-process inspection', 'Non-conforming product control'],
        },
        {
          title: 'Final Inspection and Testing',
          items: ['Final inspection procedures', 'Testing equipment calibration', 'Packaging and labeling checks', 'Shipping inspection'],
        },
      ],
    },
    {
      code: 'template-technical',
      name: 'Technical Compliance',
      description: 'Documentation, product testing, equipment calibration and safety.',
      sections: [
        { title: 'Documentation', items: ['Technical files', 'Specifications and drawings', 'Test reports', 'Certificates of compliance'] },
        { title: 'Product Testing', items: ['Test plan availability', 'Test records', 'Failure analysis', 'Lab accreditation'] },
        { title: 'Equipment and Calibration', items: ['Calibration schedule', 'Calibration certificates', 'Measurement uncertainty', 'Out-of-calibration control'] },
        { title: 'Product Safety', items: ['Hazard analysis', 'Safety labeling', 'Risk assessment', 'Recall procedure'] },
      ],
    },
    {
      code: 'template-ethical',
      name: 'Ethical Compliance',
      description: 'Labor, wages, health & safety, management and grievance.',
      sections: [
        { title: 'Labor', items: ['Age verification records', 'Voluntary employment', 'Freedom of association', 'Disciplinary records'] },
        { title: 'Wages and Hours', items: ['Payroll records', 'Overtime compliance', 'Timekeeping system', 'Minimum wage compliance'] },
        { title: 'Health and Safety', items: ['Emergency exits', 'PPE availability', 'Incident records', 'Chemical storage'] },
        { title: 'Management and Grievance', items: ['Grievance procedure', 'Worker interviews', 'Management accountability', 'Corrective action tracking'] },
      ],
    },
    {
      code: 'template-sharp-tools',
      name: 'Sharp Tools',
      description: 'Sharp tools policy, broken needle/blade management, storage and training.',
      sections: [
        { title: 'Sharp Tools Policy', items: ['Written sharp tools policy', 'Policy communication', 'Responsibility assignment', 'Review schedule'] },
        { title: 'Broken Needle/Blade Management', items: ['Broken needle log', 'Search procedure', 'Disposal records', 'Incident investigation'] },
        { title: 'Storage', items: ['Secure tool storage', 'Access control', 'Inventory checks', 'Issuance records'] },
        { title: 'Training', items: ['Training records', 'Training content', 'Competency verification', 'Refresher training'] },
      ],
    },
    {
      code: 'template-traceability',
      name: 'Traceability',
      description: 'Supply chain mapping, lot traceability, record keeping and verification.',
      sections: [
        { title: 'Supply Chain Mapping', items: ['Supplier list', 'Subcontractor records', 'Material flowchart', 'Risk assessment'] },
        { title: 'Lot Traceability', items: ['Lot numbering system', 'Traceability test', 'Record retention', 'Forward and backward traceability'] },
        { title: 'Record Keeping', items: ['Batch records', 'Inventory records', 'Shipping records', 'Electronic records backup'] },
        { title: 'Verification', items: ['Traceability drill', 'Mock recall', 'Corrective actions', 'Verification frequency'] },
      ],
    },
  ];

  const templates: any[] = [];
  for (const t of templateData) {
    const template = await prisma.auditTemplate.create({
      data: {
        code: t.code,
        name: t.name,
        description: t.description,
        sections: {
          create: t.sections.map((s: any, sIdx: number) => ({
            title: s.title,
            sortOrder: sIdx,
            items: {
              create: s.items.map((text: string, iIdx: number) => ({
                text,
                maxScore: 5,
                sortOrder: iIdx,
              })),
            },
          })),
        },
      },
      include: { sections: { include: { items: true } } },
    });
    templates.push(template);
  }

  // Scheduled audits
  const onboardingTemplate = templates.find((t) => t.code === 'template-mfg')!;
  await prisma.audit.create({
    data: {
      status: AuditStatus.SCHEDULED,
      factoryId: factories[1].id,
      templateId: onboardingTemplate.id,
      auditorId: auditor.id,
      scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.audit.create({
    data: {
      status: AuditStatus.SCHEDULED,
      factoryId: factories[2].id,
      templateId: templates.find((t) => t.code === 'template-ethical')!.id,
      auditorId: admin.id,
      scheduledAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  // Completed example audit
  const completedAudit = await prisma.audit.create({
    data: {
      status: AuditStatus.COMPLETED,
      factoryId: factories[0].id,
      templateId: onboardingTemplate.id,
      auditorId: auditor.id,
      scheduledAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
      totalDuration: 4 * 60 * 60,
      overallScore: 8.5,
      notes: 'Example completed audit for Furnitures Co.',
    },
  });

  // Build audit sections and item results
  for (const [sIdx, section] of onboardingTemplate.sections.entries()) {
    const sectionScore = [3.8, 4.2, 3.5, 4.0, 4.5][sIdx] ?? 4;
    const auditSection = await prisma.auditSection.create({
      data: {
        auditId: completedAudit.id,
        title: section.title,
        sortOrder: sIdx,
        score: sectionScore,
        maxScore: 5,
      },
    });

    for (const [iIdx, item] of section.items.entries()) {
      const failed = (sIdx === 2 && iIdx === 2) || (sIdx === 3 && iIdx === 3) || (sIdx === 4 && iIdx === 0);
      const na = iIdx === 1 && sIdx === 0;
      const score = na ? null : failed ? 2 : 4 + (iIdx % 2);
      const result = na ? ItemResult.NA : failed ? ItemResult.FAIL : ItemResult.PASS;
      const requiresCap = failed;

      const itemResult = await prisma.auditItemResult.create({
        data: {
          auditId: completedAudit.id,
          sectionId: auditSection.id,
          itemId: item.id,
          result,
          score,
          findings: failed ? `Finding: ${item.text} not fully compliant.` : null,
          remarks: `Remark sample for ${item.text}.`,
          requiresCap,
        },
      });

      if (failed) {
        await prisma.cAP.create({
          data: {
            auditId: completedAudit.id,
            itemResultId: itemResult.id,
            finding: `Finding: ${item.text} not fully compliant.`,
            correctiveAction: 'Implement corrective action within 30 days.',
            status: iIdx === 0 ? CAPStatus.OPEN : CAPStatus.IN_PROGRESS,
            targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      }
    }
  }

  // Seed 6 GPS logs for completed audit
  for (let i = 0; i < 6; i++) {
    await prisma.gPSLog.create({
      data: {
        auditId: completedAudit.id,
        latitude: 23.0207 + i * 0.001,
        longitude: 113.7518 + i * 0.001,
        accuracy: 5 + i,
      },
    });
  }

  // Seed 6 public photo URLs (CDN placeholders)
  const photoCaptions = [
    'Production line overview',
    'Incoming material inspection area',
    'Work instruction posted',
    'Final inspection station',
    'CAP evidence - corrective action board',
    'Factory entrance sign',
  ];
  for (let i = 0; i < 6; i++) {
    await prisma.photo.create({
      data: {
        auditId: completedAudit.id,
        cloudStoragePath: `https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&q=80`,
        caption: photoCaptions[i],
        isPublic: true,
      },
    });
  }

  console.log('Seed complete');
  console.log({ admin: admin.email, auditor: auditor.email, factories: factories.length, templates: templates.length });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
