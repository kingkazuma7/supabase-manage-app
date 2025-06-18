// attendance.test.ts
import {
  calculateWorkTime,
  calculateWorkTimeForPeriod,
  getMinutesFromHHMM,
  validateRecords,
} from '../src/app/attendance/utils/calculations';

describe('勤怠管理システムのテスト', () => {
  describe('calculateWorkTime', () => {
    test('通常の勤務時間を計算', () => {
      const clockIn = '2023-01-01T09:00:00';
      const clockOut = '2023-01-01T18:00:00';
      expect(calculateWorkTime(clockIn, clockOut)).toBe('09:00');
    });

    test('1時間30分の勤務時間を計算', () => {
      const clockIn = '2023-01-01T09:00:00';
      const clockOut = '2023-01-01T10:30:00';
      expect(calculateWorkTime(clockIn, clockOut)).toBe('01:30');
    });

    test('日付を跨ぐ勤務時間を計算', () => {
      const clockIn = '2023-01-01T22:00:00';
      const clockOut = '2023-01-02T05:00:00';
      expect(calculateWorkTime(clockIn, clockOut)).toBe('07:00');
    });

    test('不正な時間（退勤が出勤より前）の場合', () => {
      const clockIn = '2023-01-01T18:00:00';
      const clockOut = '2023-01-01T09:00:00';
      expect(calculateWorkTime(clockIn, clockOut)).toBe('00:00');
    });

    test('1分の勤務時間を計算（切り上げ）', () => {
      const clockIn = '2023-01-01T09:00:00';
      const clockOut = '2023-01-01T09:00:30'; // 30秒の勤務
      expect(calculateWorkTime(clockIn, clockOut)).toBe('00:01'); // 1分として切り上げ
    });

    test('59分59秒の勤務時間を計算（切り上げ）', () => {
      const clockIn = '2023-01-01T09:00:00';
      const clockOut = '2023-01-01T09:59:59'; // 59分59秒の勤務
      expect(calculateWorkTime(clockIn, clockOut)).toBe('01:00'); // 1時間として切り上げ
    });
  });

  describe('calculateWorkTimeForPeriod', () => {
    const periodStart = new Date('2023-01-01T00:00:00');
    const periodEnd = new Date('2023-01-31T00:00:00'); // 24:00:00として扱う

    test('期間内の通常勤務', () => {
      const clockIn = '2023-01-15T09:00:00';
      const clockOut = '2023-01-15T18:00:00';
      expect(calculateWorkTimeForPeriod(clockIn, clockOut, periodStart, periodEnd)).toBe('09:00');
    });

    test('期間開始前の勤務', () => {
      const clockIn = '2022-12-31T22:00:00';
      const clockOut = '2023-01-01T06:00:00';
      expect(calculateWorkTimeForPeriod(clockIn, clockOut, periodStart, periodEnd)).toBe('06:00');
    });

    test('期間終了後の勤務', () => {
      const clockIn = '2023-01-31T22:00:00';
      const clockOut = '2023-02-01T06:00:00';
      expect(calculateWorkTimeForPeriod(clockIn, clockOut, periodStart, periodEnd)).toBe('02:00');
    });

    test('期間を完全に跨ぐ勤務', () => {
      const clockIn = '2022-12-31T22:00:00';
      const clockOut = '2023-02-01T06:00:00';
      expect(calculateWorkTimeForPeriod(clockIn, clockOut, periodStart, periodEnd)).toBe('744:00'); // 31日分
    });

    test('期間終了時刻の境界値テスト（24:00:00として扱う）', () => {
      const clockIn = '2023-01-31T23:30:00';
      const clockOut = '2023-01-31T23:45:00'; // 15分の勤務
      expect(calculateWorkTimeForPeriod(clockIn, clockOut, periodStart, periodEnd)).toBe('00:15');
    });
  });

  describe('getMinutesFromHHMM', () => {
    test('2時間30分を分数に変換', () => {
      expect(getMinutesFromHHMM('02:30')).toBe(150);
    });

    test('10時間00分を分数に変換', () => {
      expect(getMinutesFromHHMM('10:00')).toBe(600);
    });

    test('不正なフォーマット', () => {
      expect(getMinutesFromHHMM('abc')).toBe(NaN);
    });
  });

  describe('validateRecords', () => {
    test('正常な記録', () => {
      const records = [
        { clock_in: '2023-01-01T09:00:00', clock_out: '2023-01-01T18:00:00' },
        { clock_in: '2023-01-02T09:00:00', clock_out: '2023-01-02T18:00:00' },
      ];
      expect(validateRecords(records)).toBe(true);
    });

    test('未退勤の記録が1つ', () => {
      const records = [
        { clock_in: '2023-01-01T09:00:00', clock_out: '2023-01-01T18:00:00' },
        { clock_in: '2023-01-02T09:00:00', clock_out: null },
      ];
      expect(validateRecords(records)).toBe(true);
    });

    test('未退勤の記録が複数（不正）', () => {
      const records = [
        { clock_in: '2023-01-01T09:00:00', clock_out: null },
        { clock_in: '2023-01-02T09:00:00', clock_out: null },
      ];
      expect(validateRecords(records)).toBe(false);
    });

    test('連続した退勤記録（不正）', () => {
      const records = [
        { clock_in: '2023-01-01T09:00:00', clock_out: '2023-01-01T18:00:00' },
        { clock_in: '2023-01-01T18:00:00', clock_out: '2023-01-01T19:00:00' },
      ];
      expect(validateRecords(records)).toBe(false);
    });
  });

  // テストデータパターンの検証
  describe('テストデータパターンの検証', () => {
    const testCases = [
      {
        name: '通常勤務',
        records: [
          { clockIn: '2023-01-01T09:00:00', clockOut: '2023-01-01T18:00:00' }
        ],
        expected: '09:00'
      },
      {
        name: '日跨ぎ勤務',
        records: [
          { clockIn: '2023-01-01T22:00:00', clockOut: '2023-01-02T05:00:00' }
        ],
        expected: '07:00'
      },
      {
        name: '複数日勤務',
        records: [
          { clockIn: '2023-01-01T09:00:00', clockOut: '2023-01-01T18:00:00' },
          { clockIn: '2023-01-02T09:00:00', clockOut: '2023-01-02T18:00:00' }
        ],
        expected: '18:00'
      },
      {
        name: '未退勤あり',
        records: [
          { clockIn: '2023-01-01T09:00:00', clockOut: '2023-01-01T18:00:00' },
          { clockIn: '2023-01-02T09:00:00', clockOut: null }
        ],
        expectedValid: false
      }
    ];

    testCases.forEach(({ name, records, expected, expectedValid }) => {
      test(`${name}パターン`, () => {
        if (expected !== undefined) {
          const totalMinutes = records.reduce((sum, record) => {
            if (record.clockOut) {
              const minutes = getMinutesFromHHMM(
                calculateWorkTime(record.clockIn, record.clockOut)
              );
              return sum + minutes;
            }
            return sum;
          }, 0);
          
          const hours = Math.floor(totalMinutes / 60);
          const mins = totalMinutes % 60;
          const totalTime = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
          expect(totalTime).toBe(expected);
        }

        if (expectedValid !== undefined) {
          const formattedRecords = records.map(r => ({
            clock_in: r.clockIn,
            clock_out: r.clockOut
          }));
          expect(validateRecords(formattedRecords)).toBe(expectedValid);
        }
      });
    });
  });
});