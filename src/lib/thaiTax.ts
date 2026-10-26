/**
 * คำนวณภาษีหัก ณ ที่จ่าย และเงินสมทบประกันสังคม สำหรับสลิปเงินเดือน
 * (requirement 11.1).
 *
 * อัตราภาษีขั้นบันไดอ้างอิงประกาศกรมสรรพากร "อัตราภาษีเงินได้บุคคลธรรมดา"
 * ซึ่งใช้ตั้งแต่ปีภาษี 2560 เป็นต้นมา — ดู https://www.rd.go.th/59670.html
 *
 * วิธีคำนวณภาษีหัก ณ ที่จ่ายเป็นวิธีมาตรฐานตามมาตรา 50(1) แห่งประมวลรัษฎากร
 * (ประมาณเงินได้ทั้งปีจากงวดปัจจุบัน แล้วเฉลี่ยภาษีกลับเป็นรายงวด):
 *
 *   1. เงินได้ทั้งปี (ประมาณ) = เงินได้งวดนี้ × จำนวนงวดต่อปี
 *   2. หักค่าใช้จ่าย 50% แต่ไม่เกิน 100,000 บาท
 *   3. หักค่าลดหย่อนส่วนตัว 60,000 บาท + เงินสมทบประกันสังคมที่จ่ายทั้งปี
 *   4. เงินได้สุทธิ -> คำนวณภาษีตามขั้นบันได
 *   5. ภาษีต่องวด = ภาษีทั้งปี ÷ จำนวนงวดต่อปี
 *
 * ค่าลดหย่อนอื่น (คู่สมรส/บุตร/เบี้ยประกัน/กองทุน ฯลฯ) ไม่ได้รวมในที่นี้ จึงเป็น
 * การประมาณการเพื่อหัก ณ ที่จ่าย ไม่ใช่ภาระภาษีสุดท้ายของผู้มีเงินได้.
 *
 * พารามิเตอร์ทั้งหมดปรับได้ผ่านหน้าตั้งค่า (เก็บใน app_settings) เพื่อให้ฝ่าย
 * การเงินแก้ตามประกาศที่เปลี่ยนแปลงได้เองโดยไม่ต้องแก้โค้ด.
 */

export interface TaxBracket {
  /** เพดานเงินได้สุทธิของขั้นนี้ (null = ขั้นสูงสุด ไม่มีเพดาน) */
  upTo: number | null;
  /** อัตราภาษีของขั้นนี้ (%) */
  ratePct: number;
}

export interface PayrollTaxConfig {
  // ---- ประกันสังคม ----
  ssoRatePct: number;        // อัตราเงินสมทบลูกจ้าง (%)
  ssoWageFloor: number;      // ฐานค่าจ้างต่ำสุดที่ใช้คำนวณ
  ssoWageCeiling: number;    // ฐานค่าจ้างสูงสุดที่ใช้คำนวณ
  ssoMonthlyMax: number;     // เพดานเงินสมทบต่อเดือน
  // ---- ภาษีเงินได้ ----
  expenseDeductionPct: number;   // หักค่าใช้จ่าย (%)
  expenseDeductionCap: number;   // เพดานค่าใช้จ่าย
  personalAllowance: number;     // ค่าลดหย่อนส่วนตัว
  payPeriodsPerYear: number;     // จำนวนงวดจ่ายต่อปี
  brackets: TaxBracket[];
}

/**
 * ค่าตั้งต้น: อัตราภาษีขั้นบันไดยืนยันจากกรมสรรพากร (rd.go.th/59670.html).
 * ตัวเลขประกันสังคมเป็นค่าที่ใช้กันทั่วไป — ฝ่ายการเงินควรยืนยันกับประกาศ
 * สำนักงานประกันสังคมที่บังคับใช้อยู่ก่อนใช้งานจริง (ปรับได้ในหน้าตั้งค่า).
 */
export const DEFAULT_TAX_CONFIG: PayrollTaxConfig = {
  ssoRatePct: 5,
  ssoWageFloor: 1650,
  ssoWageCeiling: 15000,
  ssoMonthlyMax: 750,
  expenseDeductionPct: 50,
  expenseDeductionCap: 100000,
  personalAllowance: 60000,
  payPeriodsPerYear: 12,
  brackets: [
    { upTo: 150000, ratePct: 0 },      // ยกเว้น
    { upTo: 300000, ratePct: 5 },
    { upTo: 500000, ratePct: 10 },
    { upTo: 750000, ratePct: 15 },
    { upTo: 1000000, ratePct: 20 },
    { upTo: 2000000, ratePct: 25 },
    { upTo: 5000000, ratePct: 30 },
    { upTo: null, ratePct: 35 },
  ],
};

export const TAX_CONFIG_KEY = 'payroll_tax_config';

/** รวมค่าที่โหลดมาจาก server กับค่าตั้งต้น (กันกรณีค่าเก่าไม่มีฟิลด์ใหม่) */
export function mergeTaxConfig(partial: Partial<PayrollTaxConfig> | null | undefined): PayrollTaxConfig {
  if (!partial) return DEFAULT_TAX_CONFIG;
  const brackets = Array.isArray(partial.brackets) && partial.brackets.length
    ? partial.brackets
    : DEFAULT_TAX_CONFIG.brackets;
  return { ...DEFAULT_TAX_CONFIG, ...partial, brackets };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * ข้าราชการไม่อยู่ในระบบประกันสังคม (มีสวัสดิการ/กบข. แยก) จึงไม่หักเงินสมทบ.
 * ตรวจจากฟิลด์ประเภทการจ้างของบุคลากร.
 */
export function ssoApplies(employeeType?: string | null): boolean {
  if (!employeeType) return true;          // ไม่ระบุ = ถือเป็นลูกจ้าง
  return !/ข้าราชการ|พนักงานราชการ/.test(employeeType);
}

/** เงินสมทบประกันสังคมส่วนของลูกจ้าง ต่อเดือน */
export function socialSecurity(monthlyWage: number, cfg: PayrollTaxConfig): number {
  if (monthlyWage <= 0) return 0;
  const base = Math.min(Math.max(monthlyWage, cfg.ssoWageFloor), cfg.ssoWageCeiling);
  const contribution = base * (cfg.ssoRatePct / 100);
  return round2(Math.min(contribution, cfg.ssoMonthlyMax));
}

/** ภาษีทั้งปีจากเงินได้สุทธิ ตามขั้นบันได */
export function annualTaxFromNet(netIncome: number, brackets: TaxBracket[]): number {
  if (netIncome <= 0) return 0;
  let tax = 0;
  let lower = 0;
  for (const b of brackets) {
    const upper = b.upTo ?? Infinity;
    if (netIncome > lower) {
      const taxableInBand = Math.min(netIncome, upper) - lower;
      tax += taxableInBand * (b.ratePct / 100);
    }
    lower = upper;
    if (netIncome <= upper) break;
  }
  return round2(tax);
}

export interface PayslipBreakdown {
  /** เงินเดือน/ค่าจ้างฐานของงวดนี้ */
  base: number;
  /** ค่าตอบแทน OT ของงวดนี้ */
  ot: number;
  /** รายได้รวมก่อนหัก */
  gross: number;
  /** เงินสมทบประกันสังคม (หัก) */
  sso: number;
  /** ภาษีหัก ณ ที่จ่าย (หัก) */
  tax: number;
  /** รวมรายการหัก */
  totalDeductions: number;
  /** ยอดรับสุทธิ */
  net: number;
  /** ---- รายละเอียดการคำนวณภาษี (แสดงให้ตรวจสอบย้อนกลับได้) ---- */
  detail: {
    annualGross: number;
    expenseDeduction: number;
    personalAllowance: number;
    annualSso: number;
    annualNetIncome: number;
    annualTax: number;
    ssoApplied: boolean;
  };
}

/**
 * คำนวณสลิปเงินเดือนของคนหนึ่ง สำหรับงวดหนึ่ง.
 *
 * @param base  เงินเดือน/ค่าจ้างฐานของงวดนี้
 * @param ot    ค่าตอบแทน OT ของงวดนี้ (เป็นเงินได้ที่ต้องเสียภาษีเช่นกัน)
 */
export function computePayslip(args: {
  base: number;
  ot: number;
  employeeType?: string | null;
  cfg: PayrollTaxConfig;
}): PayslipBreakdown {
  const { base, ot, employeeType, cfg } = args;
  const gross = round2(base + ot);

  const applySso = ssoApplies(employeeType);
  // ประกันสังคมคิดจากค่าจ้าง ไม่รวม OT (ค่าล่วงเวลาไม่ถือเป็นค่าจ้างตามฐานสมทบ)
  const sso = applySso ? socialSecurity(base, cfg) : 0;

  const periods = cfg.payPeriodsPerYear > 0 ? cfg.payPeriodsPerYear : 12;
  const annualGross = gross * periods;
  const expenseDeduction = Math.min(annualGross * (cfg.expenseDeductionPct / 100), cfg.expenseDeductionCap);
  const annualSso = sso * periods;
  const annualNetIncome = Math.max(0, annualGross - expenseDeduction - cfg.personalAllowance - annualSso);
  const annualTax = annualTaxFromNet(annualNetIncome, cfg.brackets);
  const tax = round2(annualTax / periods);

  const totalDeductions = round2(sso + tax);
  return {
    base: round2(base), ot: round2(ot), gross,
    sso, tax, totalDeductions,
    net: round2(gross - totalDeductions),
    detail: {
      annualGross: round2(annualGross),
      expenseDeduction: round2(expenseDeduction),
      personalAllowance: cfg.personalAllowance,
      annualSso: round2(annualSso),
      annualNetIncome: round2(annualNetIncome),
      annualTax,
      ssoApplied: applySso,
    },
  };
}
