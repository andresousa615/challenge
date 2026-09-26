// Largest quantity accepted on a line (also keeps it inside the DB's INTEGER range).
export const MAX_QUANTITY = 9_999_999;

export type EmailInput = {
  id: string;
  from: string;
  received_at: string;
  body: string;
};

export type ExtractedLine = {
  reference: string;
  quantity: number | null;
};

export type Extraction = {
  contact: string | null;
  companyName: string | null;
  requestedDate: string | null; // YYYY-MM-DD
  lines: ExtractedLine[];
};
