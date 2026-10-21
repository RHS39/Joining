/**
 * Helpers for working with user-defined fields.
 */
import type { FieldDefinition } from '@/types';

export interface FieldSection {
  /** Section heading, `''` for fields without a section. */
  section: string;
  /** Fields of the section, in their original order. */
  fields: FieldDefinition[];
}

/** Heading used for the fields that have no explicit section. */
export const DEFAULT_SECTION = 'Details';

/**
 * Group the fields by their section, keeping the order in which the sections
 * and the fields were defined.
 */
export function groupFieldsBySection(fields: FieldDefinition[]): FieldSection[] {
  const groups: FieldSection[] = [];
  const indexBySection = new Map<string, number>();

  fields.forEach((field) => {
    const section = field.section?.trim() ?? '';
    const existing = indexBySection.get(section);
    if (existing === undefined) {
      indexBySection.set(section, groups.length);
      groups.push({ section, fields: [field] });
      return;
    }
    groups[existing].fields.push(field);
  });

  return groups;
}

/** Fields that carry a value in the given record. */
export function countFilledFields(record: { custom?: Record<string, unknown> }, fields: FieldDefinition[]): number {
  const custom = record.custom ?? {};
  return fields.filter((field) => {
    const value = custom[field.key];
    return value !== null && value !== undefined && value !== '';
  }).length;
}
