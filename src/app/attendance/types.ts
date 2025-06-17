/**
 * スタッフ情報の型定義
 */
export type Staff = {
  /** スタッフID */
  id: string;
  /** スタッフ名 */
  name: string;
};

/**
 * 勤怠記録の型定義
 */
export type AttendanceRecord = {
  /** 記録日付（YYYY/MM/DD形式） */
  date: string;
  /** 出勤時間（HH:mm形式） */
  clockIn: string;
  /** 退勤時間（HH:mm形式） */
  clockOut: string | null;
  /** 日付跨ぎフラグ */
  isCrossDay: boolean;
  /** 出勤時間（ISO形式、計算用） */
  originalClockIn: string;
  /** 退勤時間（ISO形式、計算用） */
  originalClockOut: string | null;
};

/**
 * 勤務時間情報の型定義
 */
export type WorkTime = {
  /** 総勤務時間（HH:mm形式） */
  total: string;
  /** スタッフ名 */
  name: string;
  /** 出勤時間 */
  clockIn: string;
  /** 退勤時間 */
  clockOut: string;
};

/**
 * 勤怠ステータスの型定義
 */
export type AttendanceStatus = {
  /** 勤務中かどうか */
  isWorking: boolean;
  /** 最終出勤時間（ISO形式） */
  lastClockIn: string | null;
  /** 最終退勤時間（ISO形式） */
  lastClockOut: string | null;
  /** 勤怠ステータス */
  status: '勤務中' | '退勤済み' | null;
};

/**
 * 月次合計の型定義
 */
export type MonthlyTotal = {
  /** 時間 */
  hours: number;
  /** 分 */
  minutes: number;
}; 