/**
 * Utility to normalize task categories to their canonical names.
 * This prevents duplicate dropdown entries and inconsistent casings.
 */

export const CANONICAL_CATEGORIES = [
  'WORK',
  'DRAWING',
  'MATERIAL',
  'SELECTION',
  'Mandatory SAT Report',
  'Site Schedule Mandatory',
  'Photo of Site (Mandatory)',
  'SNAG LIST'
] as const;

export type CanonicalCategory = typeof CANONICAL_CATEGORIES[number];

/**
 * Normalizes any category string to one of the canonical forms.
 */
export function normalizeCategory(cat: string): string {
  const norm = (cat || '').trim().toUpperCase();
  
  // Strict mappings
  if (norm === 'WORK') return 'WORK';
  if (norm === 'DRAWING') return 'DRAWING';
  if (norm === 'MATERIAL') return 'MATERIAL';
  if (norm === 'SELECTION') return 'SELECTION';
  if (norm === 'DECISION') return 'SELECTION'; // legacy mapping
  if (norm === 'SNAG LIST' || norm === 'SNAG') return 'SNAG LIST';
  
  if (norm === 'MANDATORY SAT REPORT' || norm === 'SATURDAY REPORT' || norm.includes('SAT REPORT')) {
    return 'Mandatory SAT Report';
  }
  
  if (
    norm === 'SITE SCHEDULE MANDATORY' || 
    norm === 'SITE WEEKLY SCHEDULE PHOTO' || 
    norm === 'MANDATORY UPLOADS' ||
    norm.includes('SCHEDULE MANDATORY') ||
    norm.includes('WEEKLY SCHEDULE')
  ) {
    return 'Site Schedule Mandatory';
  }
  
  if (
    norm === 'PHOTO OF SITE (MANDATORY)' || 
    norm === 'SITE PHOTO' || 
    norm.includes('PHOTO OF SITE')
  ) {
    return 'Photo of Site (Mandatory)';
  }

  // Find partial/case-insensitive match in CANONICAL_CATEGORIES
  const found = CANONICAL_CATEGORIES.find(
    (c) => c.toUpperCase() === norm
  );
  if (found) return found;

  // Additional formatting: if it is entirely lowercase and matches lowercase equivalents
  const lowerMap: Record<string, string> = {
    'work': 'WORK',
    'drawing': 'DRAWING',
    'material': 'MATERIAL',
    'selection': 'SELECTION',
    'snag list': 'SNAG LIST',
    'mandatory sat report': 'Mandatory SAT Report',
    'site schedule mandatory': 'Site Schedule Mandatory',
    'photo of site (mandatory)': 'Photo of Site (Mandatory)'
  };

  const lowerKey = (cat || '').trim().toLowerCase();
  if (lowerMap[lowerKey]) {
    return lowerMap[lowerKey];
  }

  // Otherwise, default to WORK or capitalise cleanly if matches one of the known patterns
  return cat || 'WORK';
}
