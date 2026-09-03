import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((v) => v.toString().padStart(2, '0'))
    .join(':');
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function calculateSectionScore(items: { score: number | null; maxScore: number; result: string | null }[]): number | null {
  const scored = items.filter((i) => i.result && i.result !== 'NA' && i.score !== null && i.maxScore);
  if (!scored.length) return null;
  const totalScore = scored.reduce((sum, i) => sum + (i.score || 0), 0);
  const totalMax = scored.reduce((sum, i) => sum + i.maxScore, 0);
  if (!totalMax) return null;
  return (totalScore / totalMax) * 5;
}

export function calculateOverallScore(
  sections: { score: number | null; maxScore: number | null; items: { score: number | null; maxScore: number; result: string | null }[] }[]
): number | null {
  let weightedScoreSum = 0;
  let totalMax = 0;
  for (const section of sections) {
    const sectionScore = section.score ?? calculateSectionScore(section.items);
    const sectionMax = section.maxScore ?? 5;
    if (sectionScore === null) continue;
    weightedScoreSum += sectionScore;
    totalMax += sectionMax;
  }
  if (!totalMax) return null;
  return (weightedScoreSum / totalMax) * 10;
}
