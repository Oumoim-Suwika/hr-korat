/**
 * Converts a number to Thai Baht text string.
 * Example: 13080 -> หนึ่งหมื่นสามพันแปดสิบบาทถ้วน
 */
export function thaiBahtText(num: number): string {
  const number = Math.round(num * 100) / 100; // round to 2 decimals
  const parts = number.toString().split('.');
  const integerPart = parseInt(parts[0], 10);
  const decimalPart = parts[1] ? parseInt(parts[1].substring(0, 2).padEnd(2, '0'), 10) : 0;

  if (isNaN(integerPart)) return 'ศูนย์บาทถ้วน';

  const THAI_NUMBER = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const THAI_UNIT = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

  function convertSegment(numStr: string): string {
    let result = '';
    const len = numStr.length;
    for (let i = 0; i < len; i++) {
      const digit = parseInt(numStr[i], 10);
      const pos = len - 1 - i;
      if (digit !== 0) {
        if (pos === 1 && digit === 1) {
          result += 'สิบ';
        } else if (pos === 1 && digit === 2) {
          result += 'ยี่สิบ';
        } else if (pos === 0 && digit === 1 && len > 1) {
          // If the previous character is not 0 (or if it's the last character of a segment)
          result += 'เอ็ด';
        } else {
          result += THAI_NUMBER[digit] + THAI_UNIT[pos];
        }
      }
    }
    return result;
  }

  let text = '';
  if (integerPart === 0) {
    text = 'ศูนย์';
  } else {
    const intStr = integerPart.toString();
    const millionSegments: string[] = [];
    let temp = intStr;
    while (temp.length > 6) {
      millionSegments.unshift(temp.substring(temp.length - 6));
      temp = temp.substring(0, temp.length - 6);
    }
    millionSegments.unshift(temp);

    for (let i = 0; i < millionSegments.length; i++) {
      const segText = convertSegment(millionSegments[i]);
      text += segText;
      if (i < millionSegments.length - 1 && segText !== '') {
        text += 'ล้าน';
      }
    }
  }

  text += 'บาท';

  if (decimalPart === 0) {
    text += 'ถ้วน';
  } else {
    const decStr = decimalPart.toString().padStart(2, '0');
    const decText = convertSegment(decStr);
    text += decText + 'สตางค์';
  }

  return text;
}
