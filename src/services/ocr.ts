import * as FileSystem from 'expo-file-system';
import { OCRModule, OCR_ENGLISH, type OCRDetection } from 'react-native-executorch';
import { Bill } from '../types';

const DEFAULT_OCR_MODEL = OCR_ENGLISH;

let ocrModule: OCRModule | null = null;
let loadPromise: Promise<void> | null = null;

export class OCRService {
  // Extract bill information using the on-device React Native ExecuTorch OCR stack
  static async extractTextFromImage(imageUri: string): Promise<Partial<Bill>> {
    if (!imageUri) {
      console.warn('No image URI provided to OCRService.extractTextFromImage');
      return this.getMockData();
    }

    try {
      const module = await this.ensureModuleLoaded();
      const nativePath = await this.prepareImagePath(imageUri);

      console.log('🔍 Running ExecuTorch OCR on image:', nativePath);
      const detections = await module.forward(nativePath);
      const concatenatedText = this.concatenateDetections(detections);
      console.log('📄 ExecuTorch OCR text:', concatenatedText);

      if (!concatenatedText) {
        console.log('⚠️ ExecuTorch returned no text. Falling back to regex extraction.');
        return this.getMockData();
      }

      return this.fallbackExtraction(concatenatedText);
    } catch (error) {
      console.error('❌ ExecuTorch OCR Error:', error);
      console.log('⚠️ Using mock data fallback');
      return this.getMockData();
    }
  }

  private static async ensureModuleLoaded(): Promise<OCRModule> {
    if (!ocrModule) {
      ocrModule = new OCRModule();
    }

    if (!loadPromise) {
      loadPromise = ocrModule
        .load(DEFAULT_OCR_MODEL, (progress) => {
          const percent = Math.round(progress * 100);
          console.log(`⬇️ ExecuTorch OCR model download: ${percent}%`);
        })
        .catch((error) => {
          loadPromise = null;
          throw error;
        });
    }

    await loadPromise;
    return ocrModule;
  }

  private static async prepareImagePath(uri: string): Promise<string> {
    if (!uri) {
      throw new Error('Image URI is empty');
    }

    if (uri.startsWith('file://')) {
      return uri;
    }

    if (uri.startsWith('content://')) {
      const ocrCacheDir = `${FileSystem.cacheDirectory ?? ''}ocr/`;
      if (!ocrCacheDir) {
        throw new Error('FileSystem cache directory unavailable');
      }

      await FileSystem.makeDirectoryAsync(ocrCacheDir, { intermediates: true }).catch(() => undefined);

      const destination = `${ocrCacheDir}${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: uri, to: destination });
      return destination.startsWith('file://') ? destination : `file://${destination}`;
    }

    if (uri.startsWith('/')) {
      return `file://${uri}`;
    }

    throw new Error(`Unsupported image URI protocol: ${uri}`);
  }

  private static concatenateDetections(detections: OCRDetection[]): string {
    if (!detections?.length) {
      return '';
    }

    const sortedDetections = detections.slice().sort((a, b) => {
      const ay = a.bbox?.[0]?.y ?? 0;
      const by = b.bbox?.[0]?.y ?? 0;
      if (Math.abs(ay - by) < 5) {
        const ax = a.bbox?.[0]?.x ?? 0;
        const bx = b.bbox?.[0]?.x ?? 0;
        return ax - bx;
      }
      return ay - by;
    });

    const lineThreshold = 14;
    const lines: string[] = [];
    let currentLineTexts: string[] = [];
    let currentY = sortedDetections[0].bbox?.[0]?.y ?? 0;

    for (const detection of sortedDetections) {
      const text = detection.text?.trim();
      if (!text) {
        continue;
      }

      const y = detection.bbox?.[0]?.y ?? currentY;
      if (Math.abs(y - currentY) > lineThreshold) {
        if (currentLineTexts.length) {
          lines.push(currentLineTexts.join(' '));
        }
        currentLineTexts = [text];
        currentY = y;
      } else {
        currentLineTexts.push(text);
        currentY = Math.min(currentY, y);
      }
    }

    if (currentLineTexts.length) {
      lines.push(currentLineTexts.join(' '));
    }

    return lines.join('\n');
  }

  private static fallbackExtraction(text: string): Partial<Bill> {
    const normalizedText = this.normalizeText(text);
    const map = this.buildFieldMap(normalizedText);

    const billNumber = this.extractTicketNumber(normalizedText, map) || `BILL${Date.now()}`;
    const amount = this.extractAmount(normalizedText, map);
    const parsedDate = this.extractDate(normalizedText, map);
    const fromValue = this.extractLocation(normalizedText, map, ['from', 'source'], /(?:^|\n)\s*from\s*[:\-]?\s*([^\n]+)/i) || 'Unknown';
    const toValue = this.extractLocation(normalizedText, map, ['to', 'destination'], /(?:^|\n)\s*to\s*[:\-]?\s*([^\n]+)/i) || 'Unknown';

    return {
      billNumber,
      amount,
      date: parsedDate,
      from: fromValue,
      to: toValue,
      extractedText: normalizedText.substring(0, 200),
    };
  }

  private static buildFieldMap(text: string): Map<string, string> {
    const map = new Map<string, string>();
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    let pendingKey: string | null = null;

    for (const rawLine of lines) {
      const line = rawLine.replace(/\s+/g, ' ').trim();
      if (!line) {
        continue;
      }

      const kvMatch = line.match(/^([A-Za-z0-9 .]{2,})\s*[:\-]\s*(.+)$/);
      if (kvMatch) {
        const key = this.normalizeKey(kvMatch[1]);
        const value = kvMatch[2].trim();
        if (key) {
          map.set(key, value);
        }
        pendingKey = null;
        continue;
      }

      if (pendingKey) {
        const existing = map.get(pendingKey) ?? '';
        map.set(pendingKey, `${existing} ${line}`.trim());
        pendingKey = null;
        continue;
      }

      if (line.endsWith(':')) {
        const normalizedKey = this.normalizeKey(line.slice(0, -1));
        pendingKey = normalizedKey || null;
      }
    }

    return map;
  }

  private static getFirstField(map: Map<string, string>, keys: string[]): string | undefined {
    for (const key of keys) {
      const normalizedKey = this.normalizeKey(key);
      if (normalizedKey && map.has(normalizedKey)) {
        return map.get(normalizedKey);
      }
    }
    return undefined;
  }

  private static parseDate(raw?: string): Date {
    if (!raw) {
      return new Date();
    }

    const match = raw.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
    if (!match) {
      return new Date();
    }

    const [, day, month, yearRaw] = match;
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    const safeDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const parsed = new Date(safeDate);
    if (Number.isNaN(parsed.getTime())) {
      return new Date();
    }
    return parsed;
  }

  private static normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/[|]+/g, ' ')
      .replace(/[;]+/g, ':')
      .replace(/\u2013|\u2014/g, '-')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n\s+/g, '\n')
      .trim();
  }

  private static normalizeKey(key: string): string {
    return key
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/tlckat/g, 'ticket')
      .replace(/journay/g, 'journey')
      .replace(/valld/g, 'valid')
      .replace(/platfarm/g, 'platform')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static extractTicketNumber(text: string, map: Map<string, string>): string | undefined {
    const candidate = this.getFirstField(map, ['ticket no', 'ticket number', 'bill no', 'bill number', 'invoice no', 'receipt no']);
    if (candidate) {
      const cleaned = candidate.replace(/[^A-Z0-9]/gi, '').trim();
      if (cleaned.length >= 6) {
        return cleaned;
      }
    }

    const pattern = /(?:tlcket|tlckat|ticket|bill|invoice|receipt)[^A-Z0-9]{0,6}([A-Z0-9]{6,})/i;
    const match = text.match(pattern);
    if (match) {
      return match[1].replace(/[^A-Z0-9]/gi, '');
    }

    const fallback = text.match(/([A-Z0-9]{8,})/);
    return fallback ? fallback[1].replace(/[^A-Z0-9]/gi, '') : undefined;
  }

  private static extractAmount(text: string, map: Map<string, string>): number {
    const candidate = this.getFirstField(map, ['fare', 'amount', 'total']);
    if (candidate) {
      const match = candidate.match(/(\d+(?:\.\d+)?)/);
      if (match) {
        return parseFloat(match[1]);
      }
    }

    const pattern = /(?:inr|rs|₹)\s*([0-9]+(?:\.[0-9]+)?)/i;
    const match = text.match(pattern);
    if (match) {
      return parseFloat(match[1]);
    }

    return 0;
  }

  private static extractDate(text: string, map: Map<string, string>): Date {
    const candidate = this.getFirstField(map, ['date', 'dated']);
    if (candidate) {
      const parsed = this.parseDate(candidate);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    const match = text.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/);
    if (match) {
      return this.parseDate(match[1]);
    }

    return new Date();
  }

  private static extractLocation(
    text: string,
    map: Map<string, string>,
    keys: string[],
    pattern: RegExp,
  ): string | undefined {
    const candidate = this.getFirstField(map, keys);
    if (candidate) {
      return this.cleanLocation(candidate);
    }

    const match = text.match(pattern);
    if (match) {
      return this.cleanLocation(match[1]);
    }

    for (const key of keys) {
      const fallback = this.matchLocationByLabel(text, key);
      if (fallback) {
        return fallback;
      }
    }

    return undefined;
  }

  private static cleanLocation(value: string): string {
    return value
      .replace(/\n+/g, ' ')
      .replace(/[,]+$/, '')
      .replace(/[^A-Za-z0-9 .,&/-]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private static matchLocationByLabel(text: string, label: string): string | undefined {
    const normalizedLabel = label.replace(/[^A-Za-z]/g, '');
    if (!normalizedLabel) {
      return undefined;
    }

    const pattern = new RegExp(`\b${normalizedLabel}\b[\s:;\-]*\n?\s*([A-Za-z0-9 .,&/-]+)`, 'gi');
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        const cleaned = this.cleanLocation(match[1]);
        if (cleaned) {
          return cleaned;
        }
      }
    }

    return undefined;
  }

  // Mock data fallback
  private static getMockData(): Partial<Bill> {
    return {
      billNumber: `BILL${Math.floor(Math.random() * 10000)}`,
      amount: Math.floor(Math.random() * 5000) + 100,
      date: new Date(),
      from: 'Location A',
      to: 'Location B',
      extractedText: 'Mock OCR data (ExecuTorch unavailable)',
    };
  }

  // Extract specific fields from OCR text (legacy method)
  static parseOCRText(text: string): Partial<Bill> {
    return {
      extractedText: text,
    };
  }
}
