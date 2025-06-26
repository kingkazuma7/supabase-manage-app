import { calculateWageForTimeRange } from '../src/app/attendance/utils/wageCalculator'

describe('calculateWageForTimeRange', () => {
  // ヘルパー関数：日付オブジェクトを作成
  const createDate = (hours: number, minutes: number = 0) => {
    const date = new Date('2024-01-15');  // 固定の日付を使用
    if (hours === 24) {
      // 24:00は翌日の0:00として扱う
      date.setDate(date.getDate() + 1);
      date.setHours(0, minutes, 0, 0);
    } else {
      date.setHours(hours, minutes, 0, 0);
    }
    return date;
  };

  describe('通常時給のケース（10:00-22:00, ¥1,500/時）', () => {
    test('通常時間帯の勤務（10:00-18:00）', () => {
      const start = createDate(10);
      const end = createDate(18);
      const wage = calculateWageForTimeRange(start, end);
      expect(wage).toBe(8 * 1500); // 8時間 × ¥1,500
    });

    test('通常時間帯の端数あり（10:30-18:45）', () => {
      const start = createDate(10, 30);
      const end = createDate(18, 45);
      const wage = calculateWageForTimeRange(start, end);
      expect(wage).toBe(Math.round(8.25 * 1500)); // 8時間15分 × ¥1,500
    });
  });

  describe('夜間時給のケース（22:00-24:00, ¥1,875/時）', () => {
    test('夜間時間帯のみ（22:00-24:00）', () => {
      const start = createDate(22);
      const end = createDate(24);  // 24:00は翌日の0:00として扱われる
      const wage = calculateWageForTimeRange(start, end);
      const expectedWage = 2 * 1875; // 期待値: 2時間 × ¥1,875 = ¥3,750

      // デバッグ出力
      // console.log(`  夜間時間帯のみ (22:00-24:00):`);
      // console.log(`    開始時刻: ${start.toLocaleString()}`);
      // console.log(`    終了時刻: ${end.toLocaleString()}`);
      // console.log(`    期待される給与: ¥${expectedWage}`);
      // console.log(`    実際の計算結果: ¥${wage}`);

      expect(wage).toBe(expectedWage);
    });

    test('夜間時間帯の境界値（21:45-22:15）', () => {
      const start = createDate(21, 45);
      const end = createDate(22, 15);
      const expectedWage = Math.round(
        (0.25 * 1500) + // 21:45-22:00 (15分) × ¥1,500
        (0.25 * 1875)   // 22:00-22:15 (15分) × ¥1,875
      );
      const wage = calculateWageForTimeRange(start, end);
      expect(wage).toBe(expectedWage);
    });
  });

  describe('深夜時給のケース（24:00-27:00, ¥2,000/時）', () => {
    test('深夜時間帯のみ（0:00-3:00）', () => {
      const start = createDate(0);
      const end = createDate(3);
      const wage = calculateWageForTimeRange(start, end);
      const expectedWage = 3 * 2000; // 3時間 × ¥2,000
      expect(wage).toBe(expectedWage);
    });

    test('深夜時間帯の境界値（23:45-0:15）', () => {
      const start = createDate(23, 45);
      const end = createDate(0, 15);
      const expectedWage = Math.round(
        (0.25 * 1875) + // 23:45-24:00 (15分) × ¥1,875
        (0.25 * 2000)   // 00:00-00:15 (15分) × ¥2,000
      );
      const wage = calculateWageForTimeRange(start, end);

      // デバッグ出力
      // console.log(`  深夜時間帯の境界値 (23:45-0:15):`);
      // console.log(`    期待される給与: ¥${expectedWage}`);
      // console.log(`    実際の計算結果: ¥${wage}`);

      expect(wage).toBe(expectedWage);
    });
  });

  describe('休憩時間を含むケース', () => {
    test('通常時間帯の休憩（12:00-13:00）', () => {
      const start = createDate(10);
      const end = createDate(18);
      const breakStart = createDate(12);
      const breakEnd = createDate(13);
      const expectedWage = 7 * 1500; // 7時間 × ¥1,500（休憩1時間を除く）
      const wage = calculateWageForTimeRange(start, end, breakStart, breakEnd);

      // デバッグ出力
      // console.log(`  通常時間帯の休憩 (12:00-13:00):`);
      // console.log(`    期待される給与: ¥${expectedWage}`);
      // console.log(`    実際の計算結果: ¥${wage}`);

      expect(wage).toBe(expectedWage);
    });

    test('時給変更時間帯をまたぐ休憩（21:30-22:30）', () => {
      const start = createDate(21);
      const end = createDate(23);
      const breakStart = createDate(21, 30);
      const breakEnd = createDate(22, 30);
      const expectedWage = Math.round(
        (0.5 * 1500) +  // 21:00-21:30 (30分) × ¥1,500
        (0.5 * 1875)    // 22:30-23:00 (30分) × ¥1,875
      );
      const wage = calculateWageForTimeRange(start, end, breakStart, breakEnd);

      // デバッグ出力
      // console.log(`  時給変更時間帯をまたぐ休憩 (21:30-22:30):`);
      // console.log(`    期待される給与: ¥${expectedWage}`);
      // console.log(`    実際の計算結果: ¥${wage}`);

      expect(wage).toBe(expectedWage);
    });

    test('深夜時間帯の休憩（0:30-1:00）', () => {
      const start = createDate(0);
      const end = createDate(3);
      const breakStart = createDate(0, 30);
      const breakEnd = createDate(1);
      const expectedWage = 2.5 * 2000; // 2.5時間 × ¥2,000（休憩30分を除く）
      const wage = calculateWageForTimeRange(start, end, breakStart, breakEnd);

      // デバッグ出力
      // console.log(`  深夜時間帯の休憩 (0:30-1:00):`);
      // console.log(`    期待される給与: ¥${expectedWage}`);
      // console.log(`    実際の計算結果: ¥${wage}`);

      expect(wage).toBe(expectedWage);
    });
  });

  describe('複合的なケース', () => {
    test('全時間帯を含む勤務（21:00-2:00）', () => {
      const start = createDate(21);
      const end = createDate(2);
      const expectedWage = Math.round(
        (1 * 1500) +   // 21:00-22:00 (1時間) × ¥1,500
        (2 * 1875) +   // 22:00-24:00 (2時間) × ¥1,875
        (2 * 2000)     // 00:00-02:00 (2時間) × ¥2,000
      );
      const wage = calculateWageForTimeRange(start, end);

      // デバッグ出力
      // console.log(`  全時間帯を含む勤務 (21:00-2:00):`);
      // console.log(`    期待される給与: ¥${expectedWage}`);
      // console.log(`    実際の計算結果: ¥${wage}`);

      expect(wage).toBe(expectedWage);
    });

    test('全時間帯を含む勤務（休憩あり）', () => {
      const start = createDate(21);
      const end = createDate(2);
      const breakStart = createDate(23);
      const breakEnd = createDate(0);
      const expectedWage = Math.round(
        (1 * 1500) +   // 21:00-22:00 (1時間) × ¥1,500
        (1 * 1875) +   // 22:00-23:00 (1時間) × ¥1,875
        (2 * 2000)     // 00:00-02:00 (2時間) × ¥2,000
      );
      const wage = calculateWageForTimeRange(start, end, breakStart, breakEnd);

      // デバッグ出力
      console.log(`  全時間帯を含む勤務（休憩あり 23:00-0:00）:`);
      console.log(`    期待される給与: ¥${expectedWage}`);
      console.log(`    実際の計算結果: ¥${wage}`);

      expect(wage).toBe(expectedWage);
    });
  });
}); 