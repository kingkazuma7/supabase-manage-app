/**
 * 時間関連の定数
 */
export const TIME = {
  /** 1時間あたりの分数 */
  MINUTES_IN_HOUR: 60,
  /** 1分あたりのミリ秒数 */
  MILLISECONDS_IN_MINUTE: 1000 * 60,
  /** 月間最大労働時間 */
  MAX_MONTHLY_HOURS: 160,
  /** 月間最大労働分数 */
  MAX_MONTHLY_MINUTES: 160 * 60,
} as const;

/**
 * 給与レート関連の定数
 */
export const WAGE_RATES = {
  /** 通常時給 */
  NORMAL: 1500,
  /** 夜間時給（22時以降） */
  NIGHT: 1875,
  /** 日付跨ぎ時給 */
  CROSS_DAY: 2000,
} as const;

/**
 * エラーメッセージ
 */
export const ATTENDANCE_ERRORS = {
  /** 既に勤務中の場合のエラー */
  ALREADY_WORKING: '既に勤務中の記録があります。',
  /** 本日の出退勤が完了している場合のエラー */
  ALREADY_COMPLETED: '本日は既に出勤・退勤済みです。',
  /** スタッフ情報が存在しない場合のエラー */
  NO_STAFF_INFO: 'スタッフ情報がありません',
  /** 不正な退勤時刻の場合のエラー */
  INVALID_CLOCK_OUT: '出勤時間より前の時刻に退勤することはできません。',
  /** データ不整合の場合のエラー */
  DATA_INCONSISTENCY: '記録に不整合があります。管理者に連絡してください。',
  /** データ取得失敗時のエラー */
  FETCH_ERROR: 'データの取得に失敗しました',
  /** 既に休憩中の場合のエラー */
  BREAK_ALREADY_STARTED: '既に休憩中の記録があります。',
  /** 休憩開始記録がない場合のエラー */
  NO_BREAK_RECORD: '休憩開始記録がありません、または既に休憩終了済みです。',
  /** 不正な休憩終了時刻の場合のエラー */
  INVALID_BREAK_END: '休憩開始時間より前の時刻に休憩終了することはできません。'
} as const;

/**
 * 勤務ステータス
 */
export const WORK_STATUS = {
  /** 勤務中 */
  WORKING: '勤務中',
  /** 退勤済み */
  COMPLETED: '退勤済み',
  /** 未退勤 */
  NOT_CLOCKED_OUT: '未退勤'
} as const; 