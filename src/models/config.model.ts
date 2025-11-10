export type ConfigUpdateInput = {
  child_age_range?: number | null;
  child_themes?: string[] | string | null;   // array o CSV
  allowed_themes?: string[] | string | null; // array o CSV
  blocked_themes?: string[] | string | null; // array o CSV
  parent_pin?: string | null;
};