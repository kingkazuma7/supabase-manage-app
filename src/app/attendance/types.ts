/**
 * スタッフ情報の型定義
 */
export type Staff = {
  /** スタッフID */
  id: string;
  /** スタッフ名 */
  name: string;
  /** マスター */
  is_master: boolean;
};

/**
 * 勤怠記録の型定義
 */
export type AttendanceRecord = {
  /** 記録ID */
  id: string;
  /** スタッフID */
  staffId: string;
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
  /** 休憩開始時間（ISO形式） */
  breakStart: string | null;
  /** 休憩終了時間（ISO形式） */
  breakEnd: string | null;
  /** 実労働時間（HH:mm形式） */
  actualWorkTime?: string;
  /** 賃金（円） */
  wage?: number;
};

/**
 * 勤務時間情報の型定義
 */
export type WorkTime = {
  /** 総勤務時間（HH:mm形式） */
  total: string;
  /** 実労働時間（HH:mm形式） */
  actual: string;
  /** 休憩時間（HH:mm形式） */
  break: string;
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
  /** 最後の出勤時間（ISO形式） */
  lastClockIn: string | null;
  /** 最後の退勤時間（ISO形式） */
  lastClockOut: string | null;
  /** 勤怠ステータス */
  status: "勤務中" | "退勤済み" | null;
  /** ステータスメッセージ */
  message: string | null;
  /** 休憩中かどうか */
  isOnBreak: boolean;
  /** 休憩開始時間（ISO形式） */
  breakStart: string | null;
  /** 本日の休憩が完了しているかどうか */
  isBreakCompleted: boolean;
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
