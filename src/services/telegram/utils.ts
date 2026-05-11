export interface ExchangeRate {
  buy: number;
  sell: number;
  fee_rate_buy?: number;
  fee_rate_sell?: number;
  created_at: string;
}

export async function fetchExchangeRates(): Promise<ExchangeRate | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(
      process.env.EXCHANGE_RATES_URL ||
        'https://iakzvzwriyxyshfggbwu.supabase.co/functions/v1/get_exchange_rates',
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data as ExchangeRate;
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    return null;
  }
}

export function validateVietnamesePhoneNumber(phoneNumber: string): boolean {
  const cleaned = phoneNumber.replace(/[\s-]/g, '');
  const pattern1 = /^0\d{9}$/;
  const pattern2 = /^\+84\d{9,10}$/;
  const pattern3 = /^84\d{9,10}$/;
  return pattern1.test(cleaned) || pattern2.test(cleaned) || pattern3.test(cleaned);
}

export function parseSexForDatabase(sex: string | undefined): string {
  if (!sex) return 'N/A';
  if (sex.includes('/')) {
    const parts = sex.split('/');
    if (parts.length > 1) {
      return parts[1] || sex;
    }
  }
  const sexUpper = sex.toUpperCase().trim();
  if (sexUpper === 'NAM') {
    return 'M';
  } else if (sexUpper === 'NỮ' || sexUpper === 'NU') {
    return 'F';
  }
  return sex;
}

export function isDuplicateKeyError(error: any): boolean {
  if (!error) return false;
  if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
    return true;
  }
  const errorMessage = error.message?.toLowerCase() || '';
  if (
    errorMessage.includes('duplicate') ||
    errorMessage.includes('unique constraint') ||
    errorMessage.includes('duplicate entry')
  ) {
    return true;
  }
  return false;
}

export async function generateQRCode(qrString: string): Promise<Buffer> {
  const qrApiUrl = `https://quickchart.io/qr?text=${encodeURIComponent(qrString)}&size=300&margin=2`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const response = await fetch(qrApiUrl, { signal: controller.signal });
  clearTimeout(timeout);
  if (!response.ok) {
    throw new Error(`QR API returned status ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
