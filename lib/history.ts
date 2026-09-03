import { prisma } from './prisma';

export async function recordChange(
  entityType: string,
  entityId: string,
  action: string,
  changes: Record<string, unknown> | null,
  userId: string
) {
  try {
    await prisma.changeHistory.create({
      data: {
        entityType,
        entityId,
        action,
        changes: (changes || {}) as any,
        userId,
      },
    });
  } catch (err) {
    // Non-blocking audit trail
    console.error('Failed to record change history', err);
  }
}
