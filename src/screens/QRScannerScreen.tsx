import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { BarcodeScanningResult } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { FirestoreService } from '../services/firestore';
import type { Bill } from '../types';

interface ParsedQRCode {
  raw: string;
  bill: Partial<Bill> | null;
}

export const QRScannerScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [parsed, setParsed] = useState<ParsedQRCode | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (permission?.status === null) {
      requestPermission();
    }
  }, [permission?.status, requestPermission]);

  const resetScanner = useCallback(() => {
    setScanned(false);
    setParsed(null);
  }, []);

  const handleBarcodeScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      if (scanned) {
        return;
      }

      const payload = Array.isArray((result as unknown as { barcodes?: BarcodeScanningResult[] }).barcodes)
        ? (result as unknown as { barcodes: BarcodeScanningResult[] }).barcodes[0]
        : result;
      const data = payload?.data;
      if (!data) {
        return;
      }

      setScanned(true);
      const parsedResult = parseQRCodeData(data);
      setParsed(parsedResult);

      if (!parsedResult.bill) {
        Alert.alert('QR detected', 'QR code scanned but no structured data was found.');
      }
    },
    [scanned],
  );

  const saveBill = useCallback(async () => {
    if (!user || !parsed?.bill) {
      Alert.alert('Unable to save', 'No bill data available from the scanned QR code.');
      return;
    }

    setProcessing(true);
    try {
      await FirestoreService.saveBill({
        userId: user.id,
        billNumber: parsed.bill.billNumber || '',
        amount: parsed.bill.amount || 0,
        date: parsed.bill.date || new Date(),
        from: parsed.bill.from || '',
        to: parsed.bill.to || '',
        extractedText: parsed.raw,
      });

      Alert.alert('Success', 'QR bill saved successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Home'),
        },
      ]);
      resetScanner();
    } catch (error) {
      console.error('QR save error', error);
      Alert.alert('Error', 'Failed to save bill from QR code.');
    } finally {
      setProcessing(false);
    }
  }, [navigation, parsed, resetScanner, user]);

  if (!permission) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.permissionText}>Checking camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContent}>
        <Text style={styles.permissionText}>Camera access denied. Enable permissions to scan QR codes.</Text>
        <TouchableOpacity style={styles.actionButton} onPress={requestPermission}>
          <Text style={styles.actionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.cameraWrapper}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          onCameraReady={() => setCameraReady(true)}
        />
        <View style={styles.overlay}>
          <Text style={styles.instructions}>
            {cameraReady ? 'Align the QR code within the frame' : 'Starting camera…'}
          </Text>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: 20 + insets.bottom }]}>
        {parsed ? (
          <View style={styles.dataCard}>
            <Text style={styles.dataTitle}>Scanned Details</Text>
            {parsed.bill ? (
              <>
                <Text style={styles.dataLine}>Bill #: {parsed.bill.billNumber ?? '—'}</Text>
                <Text style={styles.dataLine}>Amount: ₹{parsed.bill.amount ?? '—'}</Text>
                <Text style={styles.dataLine}>From: {parsed.bill.from ?? '—'}</Text>
                <Text style={styles.dataLine}>To: {parsed.bill.to ?? '—'}</Text>
                <Text style={styles.dataLine}>
                  Date: {parsed.bill.date ? parsed.bill.date.toLocaleDateString() : '—'}
                </Text>
              </>
            ) : (
              <Text style={styles.helperText}>Structured bill details not found. Try rescanning.</Text>
            )}
          </View>
        ) : (
          <Text style={styles.helperText}>Scan a QR code to preview the bill data.</Text>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]} onPress={resetScanner}>
            <Text style={styles.actionButtonText}>Rescan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton, (!parsed?.bill || processing) && styles.disabledButton]}
            onPress={saveBill}
            disabled={!parsed?.bill || processing}
          >
            <Text style={styles.actionButtonText}>{processing ? 'Saving…' : 'Continue'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const parseQRCodeData = (data: string): ParsedQRCode => {
  const trimmed = data.trim();

  try {
    const parsedJson = JSON.parse(trimmed);
    if (parsedJson && typeof parsedJson === 'object') {
      const normalized = normalizeBillFields(parsedJson as Record<string, unknown>);
      const hasStructured = hasBillValues(normalized);
      return {
        raw: trimmed,
        bill: hasStructured ? normalized : null,
      };
    }
  } catch (error) {
    // Ignore JSON parse errors and continue with regex parsing
  }

    const kvPairs = extractKeyValuePairs(trimmed);
    const normalized = kvPairs ? normalizeBillFields(kvPairs) : null;
    let bill: Partial<Bill> | null = normalized && hasBillValues(normalized) ? normalized : null;

    if (!bill) {
      const customBill = parseCustomMetroPayload(trimmed);
      bill = customBill && hasBillValues(customBill) ? customBill : null;
    }

    if (!bill) {
      const textBill = extractBillFromFreeText(trimmed);
      bill = textBill && hasBillValues(textBill) ? textBill : null;
    }

  console.log('📦 QR raw payload:', trimmed);
  return {
    raw: trimmed,
    bill,
  };
};

const extractKeyValuePairs = (text: string): Record<string, string> | null => {
  const matches = Array.from(text.matchAll(/([A-Za-z ]{2,})[:=]\s*([^;\n]+)/g));
  if (!matches.length) {
    return null;
  }

  return matches.reduce<Record<string, string>>((acc, match) => {
    const key = match[1].trim().toLowerCase();
    acc[key] = match[2].trim();
    return acc;
  }, {});
};

const normalizeBillFields = (data: Record<string, unknown>): Partial<Bill> => {
  const getValue = (keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = data[key] ?? data[key.toLowerCase()];
      if (typeof value === 'string' && value.trim().length) {
        return value.trim();
      }
      if (typeof value === 'number') {
        return value.toString();
      }
    }
    return undefined;
  };

  const amountRaw = getValue(['amount', 'fare', 'total']);
  const amount = amountRaw ? parseFloat(amountRaw.replace(/[^0-9.]/g, '')) : undefined;
  const dateRaw = getValue(['date', 'billDate']);
  const date = dateRaw ? new Date(dateRaw) : undefined;

  return {
    billNumber: getValue(['billNumber', 'bill', 'ticket', 'invoice', 'bill_no']) || undefined,
    amount,
    from: getValue(['from', 'source']),
    to: getValue(['to', 'destination']),
    date: date && !Number.isNaN(date.getTime()) ? date : undefined,
  };
};

const hasBillValues = (bill: Partial<Bill>): boolean => {
  return Boolean(
    (bill.billNumber && bill.billNumber.length > 0) ||
      typeof bill.amount === 'number' ||
      (bill.from && bill.from.length > 0) ||
      (bill.to && bill.to.length > 0) ||
      bill.date,
  );
};

const extractBillFromFreeText = (text: string): Partial<Bill> | null => {
  if (!text) {
    return null;
  }

  const amountMatch = text.match(/(?:fare|total|amount|rs\.?|₹|inr)\s*[:=]?\s*(\d+(?:\.\d{1,2})?)/i);
  const billMatch = text.match(/(?:ticket|bill|invoice|receipt)\s*(?:no\.?|#|number|id)?\s*[:=]?\s*([A-Z0-9T-]+)/i);
  const dateMatch = text.match(/(?:date|dated|valid)\s*[:=]?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i);
  const fromMatch = text.match(/from\s*[:=]?\s*([A-Z0-9\s]+)/i);
  const toMatch = text.match(/to\s*[:=]?\s*([A-Z0-9\s]+)/i);

  let parsedDate: Date | undefined;
  if (dateMatch) {
    const replaced = dateMatch[1].replace(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/, '$2/$1/$3');
    const d = new Date(replaced);
    if (!Number.isNaN(d.getTime())) {
      parsedDate = d;
    }
  }

  return {
    billNumber: billMatch ? billMatch[1] : undefined,
    amount: amountMatch ? parseFloat(amountMatch[1]) : undefined,
    date: parsedDate,
    from: fromMatch ? fromMatch[1].trim() : undefined,
    to: toMatch ? toMatch[1].trim() : undefined,
  };
};

const parseCustomMetroPayload = (text: string): Partial<Bill> | null => {
  if (!text.includes('|')) {
    return null;
  }

  const braceSections = Array.from(text.matchAll(/\{([^{}]*)\}/g), (match) => match[1].trim()).filter(Boolean);

  const dataBlock = braceSections.find((block) => block.includes('|') && block.split('|').length >= 4);
  const routeBlock = braceSections.find((block) => block.includes('<') && block.includes('>'));

  let billNumber: string | undefined;
  let amount: number | undefined;
  let date: Date | undefined;
  let from: string | undefined;
  let to: string | undefined;

  const dataSegments = dataBlock ? dataBlock.split('|').map((segment) => segment.trim()).filter(Boolean) : [];

  if (dataSegments.length) {
    const segments = dataSegments;

    const sequentialCandidate = segments[4];
    if (sequentialCandidate) {
      const metroDate = parseMetroDateTime(sequentialCandidate);
      if (metroDate) {
        date = metroDate;
      } else {
        billNumber = sequentialCandidate;
      }
    }

    if (!billNumber) {
      const ticketCandidate = segments.find((segment) => /[A-Z].*\d/.test(segment) && segment.length >= 10);
      if (ticketCandidate) {
        billNumber = ticketCandidate;
      }
    }

    const hexFloat = segments.find((segment) => /^0x[0-9a-f]+(?:\.[0-9a-f]+)?p[+-]?\d+$/i.test(segment));
    if (hexFloat) {
      amount = parseHexFloat(hexFloat);
    }

    if (amount === undefined) {
      const numericAmount = segments.find((segment) => /^\d+(?:\.\d+)?$/.test(segment));
      if (numericAmount) {
        amount = parseFloat(numericAmount);
      }
    }

    if (!date) {
      const timestampCandidate = segments.find((segment) => /^\d{10,}$/.test(segment));
      if (timestampCandidate) {
        const rawValue = parseInt(timestampCandidate, 10);
        const millis = rawValue > 1e12 ? rawValue : rawValue * 1000;
        const candidate = new Date(millis);
        if (
          !Number.isNaN(candidate.getTime()) &&
          candidate.getFullYear() >= 2000 &&
          candidate.getFullYear() <= 2100
        ) {
          date = candidate;
        }
      }
    }

    if (!date) {
      const dateToken = segments.find((segment) => /T\d{3,}/.test(segment));
      if (dateToken) {
        date = parseMetroDateTime(dateToken) ?? date;
      }
    }

    if (!billNumber) {
      const fallbackTicket = segments.find((segment) => /\d{6,}/.test(segment));
      if (fallbackTicket) {
        billNumber = fallbackTicket;
      }
    }

    const fromCode = segments[7];
    const toCode = segments[8];

    if (!routeBlock) {
      const decodedFrom = decodeMetroStationCode(fromCode);
      const decodedTo = decodeMetroStationCode(toCode);
      if (decodedFrom) {
        from = decodedFrom;
      }
      if (decodedTo) {
        to = decodedTo;
      }
    }
  }

  if (routeBlock) {
    const segments = Array.from(routeBlock.matchAll(/<([^>]+)>/g), (match) => match[1]);
    if (segments.length >= 1) {
      from = formatRouteSegment(segments[0]);
    }
    if (segments.length >= 2) {
      to = formatRouteSegment(segments[1]);
    }
    if (!date && segments.length >= 3) {
      const dateParts = segments[2].split('|');
      if (dateParts.length >= 3) {
        const [dayStr, monthStr, yearStr] = dateParts;
        const day = parseInt(dayStr, 10);
        const month = parseInt(monthStr, 10);
        const yearTwoDigit = parseInt(yearStr, 10);
        if (!Number.isNaN(day) && !Number.isNaN(month) && !Number.isNaN(yearTwoDigit)) {
          const year = yearTwoDigit + (yearTwoDigit >= 70 ? 1900 : 2000);
          const constructed = new Date(year, Math.max(0, month - 1), day);
          if (!Number.isNaN(constructed.getTime())) {
            date = constructed;
          }
        }
      }
    }
  }

  if (dataSegments.length) {
    const fromCode = dataSegments[7];
    const toCode = dataSegments[8];

    if (!from || /metro/i.test(from)) {
      from = decodeMetroStationCode(fromCode) ?? from;
    } else if (fromCode) {
      const decoded = decodeMetroStationCode(fromCode);
      if (decoded) {
        from = `${from} (${decoded})`;
      }
    }

    if (!to || (from && to === from) || /metro/i.test(to)) {
      const decodedTo = decodeMetroStationCode(toCode);
      to = decodedTo ?? (fromCode === toCode ? undefined : to);
    } else if (toCode) {
      const decoded = decodeMetroStationCode(toCode);
      if (decoded) {
        to = `${to} (${decoded})`;
      }
    }
  }

  const bill: Partial<Bill> = {
    billNumber,
    amount,
    date,
    from,
    to,
  };

  if (billNumber || amount !== undefined || from || to || date) {
    console.log('🧾 Parsed metro payload', {
      billNumber,
      amount,
      date,
      from,
      to,
    });
  }

  return bill;
};

const parseMetroDateTime = (token: string): Date | undefined => {
  const normalized = token.replace(/[^0-9T]/g, '');
  const [dateSection, timeSection] = normalized.split('T');
  if (!dateSection || !timeSection) {
    return undefined;
  }

  if (dateSection.length !== 8) {
    return undefined;
  }

  const dateParts = dateSection.match(/\d{2}/g);
  if (!dateParts || dateParts.length < 4) {
    return undefined;
  }

  const [, yearPart, monthPart, dayPart] = dateParts;
  const year = 2000 + parseInt(yearPart, 10);
  const month = parseInt(monthPart, 10);
  const day = parseInt(dayPart, 10);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return undefined;
  }

  const paddedTime = timeSection.padEnd(6, '0');
  const hour = parseInt(paddedTime.slice(0, 2), 10);
  const minute = parseInt(paddedTime.slice(2, 4), 10);
  const second = parseInt(paddedTime.slice(4, 6), 10);
  const millisecondPart = timeSection.length > 6 ? timeSection.slice(6, 9) : '0';
  const millisecond = parseInt(millisecondPart.padEnd(3, '0'), 10);

  if ([hour, minute, second, millisecond].some((value) => Number.isNaN(value))) {
    return undefined;
  }

  const constructed = new Date(year, Math.max(0, month - 1), day, hour, minute, second, millisecond);
  if (Number.isNaN(constructed.getTime()) || constructed.getFullYear() !== year) {
    return undefined;
  }

  return constructed;
};

const parseHexFloat = (value: string): number | undefined => {
  const match = value.match(/^0x([0-9a-f]+)(?:\.([0-9a-f]+))?p([+-]?\d+)$/i);
  if (!match) {
    return undefined;
  }

  const [, integerPart, fractionPart = '0', exponentPart] = match;
  const integer = parseInt(integerPart, 16);
  let fraction = 0;
  for (let index = 0; index < fractionPart.length; index += 1) {
    const digit = parseInt(fractionPart[index], 16);
    if (Number.isNaN(digit)) {
      return undefined;
    }
    fraction += digit / 16 ** (index + 1);
  }

  const exponent = parseInt(exponentPart, 10);
  return (integer + fraction) * 2 ** exponent;
};

const formatRouteSegment = (segment: string): string | undefined => {
  if (!segment) {
    return undefined;
  }

  const cleaned = segment.replace(/^[^A-Za-z0-9]+/, '').split('|')[0]?.trim();
  return cleaned || undefined;
};

const decodeMetroStationCode = (code: string | undefined): string | undefined => {
  if (!code) {
    return undefined;
  }

  const normalized = code.trim();
  if (!normalized) {
    return undefined;
  }

  const knownStations: Record<string, string> = {
    // Replace with actual station mappings when available
  };

  const mapped = knownStations[normalized.toLowerCase()];
  if (mapped) {
    return mapped;
  }

  console.log('ℹ️ Unknown metro station code detected', normalized);
  return normalized.toUpperCase();
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraWrapper: {
    flex: 2,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  instructions: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
  },
  footer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 16,
  },
  dataCard: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  dataTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  dataLine: {
    fontSize: 14,
    color: '#333',
  },
  helperText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#666',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 24,
    gap: 16,
  },
  permissionText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#333',
  },
});
