import type { DataRecord, FieldDefinition, ImageAttachment } from '@/types';

export interface ReportLayoutProps {
  records: DataRecord[];
  images: Map<string, ImageAttachment>;
  currency: string;
  customFields: FieldDefinition[];
  /** Number of grid columns (grid catalog only). */
  columns: number;
  /** Put every card on its own printed page. */
  oneCardPerPage: boolean;
  /** Show the quantity, unit price and total amount values. */
  showQuantities?: boolean;
}
