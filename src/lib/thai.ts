/** Convert Arabic digits to Thai numerals (๐-๙) — for TH Sarabun IT๙ style forms. */
const TH = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
export function toThaiDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => TH[Number(d)]);
}
