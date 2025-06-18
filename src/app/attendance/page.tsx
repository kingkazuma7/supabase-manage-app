'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import styles from './attendance.module.css'
import Link from 'next/link'
import { insertAndValidateTestData, deleteTestData, testPatterns } from './testData'
import { useAttendance } from './hooks/useAttendance'

/**
 * スタッフ情報の型定義
 * @typedef {Object} Staff
 * @property {string} id - スタッフID
 * @property {string} name - スタッフ名
 */
type Staff = {
  id: string
  name: string
}

/**
 * 勤怠記録の型定義
 * @typedef {Object} AttendanceRecord
 * @property {string} date - 記録日付（YYYY/MM/DD形式）
 * @property {string} clockIn - 出勤時間（HH:mm形式）
 * @property {string | null} clockOut - 退勤時間（HH:mm形式）
 * @property {boolean} isCrossDay - 日付跨ぎフラグ
 * @property {string} originalClockIn - 出勤時間（ISO形式、計算用）
 * @property {string | null} originalClockOut - 退勤時間（ISO形式、計算用）
 */
type AttendanceRecord = {
  date: string;
  clockIn: string;
  clockOut: string | null;
  isCrossDay: boolean;
  originalClockIn: string; // ISO形式の出勤時間（正確な計算用）
  originalClockOut: string | null; // ISO形式の退勤時間（正確な計算用）
}

/**
 * 勤務時間情報の型定義
 * @typedef {Object} WorkTime
 * @property {string} total - 総勤務時間（HH:mm形式）
 * @property {string} name - スタッフ名
 * @property {string} clockIn - 出勤時間
 * @property {string} clockOut - 退勤時間
 */
type WorkTime = {
  total: string
  name: string
  clockIn: string
  clockOut: string
}

/**
 * 勤怠ステータスの型定義
 * @typedef {Object} AttendanceStatus
 * @property {boolean} isWorking - 勤務中かどうか
 * @property {string | null} lastClockIn - 最終出勤時間（ISO形式）
 * @property {string | null} lastClockOut - 最終退勤時間（ISO形式）
 * @property {'勤務中' | '退勤済み' | null} status - 勤怠ステータス
 */
type AttendanceStatus = {
  isWorking: boolean
  lastClockIn: string | null
  lastClockOut: string | null
  status: '勤務中' | '退勤済み' | null
}

// 追加：月次合計の型定義
type MonthlyTotal = {
    hours: number;
    minutes: number;
};

/**
 * 勤務時間の合計を計算する（出勤から退勤までの純粋な総時間）
 * @param {string} clockIn - 出勤時間（ISO形式）
 * @param {string} clockOut - 退勤時間（ISO形式）
 * @returns {string} 勤務時間（HH:mm形式）
 */
const calculateWorkTime = (clockIn: string, clockOut: string): string => {
  const start = new Date(clockIn);
  const end = new Date(clockOut);
  
  const diffMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
  
  if (diffMinutes < 0) {
    // 退勤時間が出勤時間より前の場合など、不正な場合は0を返す
    return '00:00';
  }

  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * 指定された期間 (periodStart - periodEnd) 内の勤務時間を計算する
 * 月をまたぐ勤務でも、指定期間内の時間のみを正確に集計します。
 * @param {string} clockIn - 出勤時間（ISO形式）
 * @param {string} clockOut - 退勤時間（ISO形式）
 * @param {Date} periodStart - 期間開始日 (Dateオブジェクト)
 * @param {Date} periodEnd - 期間終了日 (Dateオブジェクト)
 * @returns {string} 勤務時間（HH:mm形式）
 */
const calculateWorkTimeForPeriod = (clockIn: string, clockOut: string, periodStart: Date, periodEnd: Date): string => {
  const start = new Date(clockIn);
  const end = new Date(clockOut);
  
  // 勤務開始と期間開始の遅い方
  const effectiveStart = new Date(Math.max(start.getTime(), periodStart.getTime()));
  // 勤務終了と期間終了の早い方
  const effectiveEnd = new Date(Math.min(end.getTime(), periodEnd.getTime()));
  
  // 期間内に勤務がない場合や、期間が逆転している場合は00:00を返す
  if (effectiveStart.getTime() >= effectiveEnd.getTime()) {
      return '00:00';
  }

  const diffMinutes = Math.floor((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60));
  
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * 勤務時間の合計分数を取得するヘルパー関数
 * @param {string} timeString - HH:mm形式の文字列
 * @returns {number} 合計分数
 */
const getMinutesFromHHMM = (timeString: string): number => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
};

/**
 * 勤怠記録の整合性をチェックする
 * 連続した出勤打刻、退勤打刻なしの状態で退勤打刻などを検出します。
 * @param {Array<{clock_in: string; clock_out: string | null}>} records - 勤怠記録の配列
 * @returns {boolean} 整合性が取れている場合はtrue
 */
const validateRecords = (records: { clock_in: string; clock_out: string | null }[]) => {
  if (records.length === 0) return true;
  
  let hasUnclockedOut = false; // 未退勤の記録があるか
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record.clock_out) {
      if (hasUnclockedOut) {
        // 既に未退勤の記録があるのに、また未退勤の記録があった場合（不正）
        return false;
      }
      hasUnclockedOut = true;
    }
  }
  return true;
};

/**
 * 休憩時間の計算関数
 * @param {string} breakStart - 休憩開始時間（ISO形式）
 * @param {string} breakEnd - 休憩終了時間（ISO形式）
 * @returns {string} 休憩時間（HH:mm形式）
 */
const calculateBreakTime = (breakStart: string | null, breakEnd: string | null): string => {
  if (!breakStart || !breakEnd) return '-';
  const start = new Date(breakStart);
  const end = new Date(breakEnd);
  let diffMinutes = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60));
  if (diffMinutes < 0) diffMinutes = 0;
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * 実際の作業時間を計算する関数
 * @param {string} clockIn - 出勤時間（ISO形式）
 * @param {string} clockOut - 退勤時間（ISO形式）
 * @param {string | null} breakStart - 休憩開始時間（ISO形式）
 * @param {string | null} breakEnd - 休憩終了時間（ISO形式）
 * @returns {string} 実際の作業時間（HH:mm形式）
 */
const calculateActualWorkTime = (
  clockIn: string,
  clockOut: string,
  breakStart: string | null,
  breakEnd: string | null
): string => {
  const start = new Date(clockIn);
  const end = new Date(clockOut);
  let totalMinutes = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60)); // 出勤から退勤までの純粋な総時間
  if (totalMinutes < 0) totalMinutes = 0; // 出勤時間が退勤時間より前の場合は0を返す 
  let breakMinutes = 0;
  if (breakStart && breakEnd) {
    const bStart = new Date(breakStart);
    const bEnd = new Date(breakEnd);
    breakMinutes = Math.ceil((bEnd.getTime() - bStart.getTime()) / (1000 * 60));
    if (breakMinutes < 0) breakMinutes = 0;
  }
  let actualMinutes = totalMinutes - breakMinutes;
  if (actualMinutes < 0) actualMinutes = 0;
  const hours = Math.floor(actualMinutes / 60);
  const mins = actualMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

function AttendanceContent() {
  const searchParams = useSearchParams()
  const staffId = searchParams.get('staffId')
  const {
    staff,
    records,
    workTime,
    status,
    error,
    isTodayCompleted,
    monthlyTotal,
    viewYear,
    viewMonth,
    setViewYear,
    setViewMonth,
    handleAttendance,
    fixData
  } = useAttendance(staffId);

  if (!staff) return <div className={styles.loading}>読み込み中...</div>

  // 表示月のレコードのみ抽出
  const filteredRecords = records.filter(record => {
    const date = new Date(record.originalClockIn);
    return date.getFullYear() === viewYear && date.getMonth() === viewMonth;
  });

  // 表示月の合計勤務時間（月跨ぎ対応・160h制限）
  const filteredMonthlyTotal = (() => {
    let totalMinutes = 0;
    const maxMinutes = 160 * 60;
    for (const record of filteredRecords) {
      if (record.clockOut && record.originalClockIn && record.originalClockOut) {
        const start = new Date(record.originalClockIn);
        const end = new Date(record.originalClockOut);
        const monthStart = new Date(viewYear, viewMonth, 1, 0, 0, 0, 0);
        // 期間終了時刻を24:00:00として扱う（次の日の00:00:00）
        const monthEnd = new Date(viewYear, viewMonth + 1, 1, 0, 0, 0, 0);

        // 月跨ぎ判定
        if (start.getMonth() !== end.getMonth() || start.getFullYear() !== end.getFullYear()) {
          // 前月分
          if (start.getFullYear() === viewYear && start.getMonth() === viewMonth) {
            const midnight = new Date(start);
            midnight.setHours(24, 0, 0, 0);
            // 分単位で切り上げ
            const diffMinutes = Math.ceil((midnight.getTime() - start.getTime()) / (1000 * 60));
            if (totalMinutes + diffMinutes > maxMinutes) {
              totalMinutes = maxMinutes;
              break;
            }
            totalMinutes += diffMinutes;
          }
          // 当月分
          if (end.getFullYear() === viewYear && end.getMonth() === viewMonth) {
            const monthStartMidnight = new Date(end);
            monthStartMidnight.setHours(0, 0, 0, 0);
            // 分単位で切り上げ
            const diffMinutes = Math.ceil((end.getTime() - monthStartMidnight.getTime()) / (1000 * 60));
            if (totalMinutes + diffMinutes > maxMinutes) {
              totalMinutes = maxMinutes;
              break;
            }
            totalMinutes += diffMinutes;
          }
        } else {
          // 通常勤務
          // 期間内に勤務がある場合のみ加算
          const effectiveStart = new Date(Math.max(start.getTime(), monthStart.getTime()));
          const effectiveEnd = new Date(Math.min(end.getTime(), monthEnd.getTime()));
          if (effectiveStart.getTime() < effectiveEnd.getTime()) {
            // 分単位で切り上げ
            const diffMinutes = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60));
            if (totalMinutes + diffMinutes > maxMinutes) {
              totalMinutes = maxMinutes;
              break;
            }
            totalMinutes += diffMinutes;
          }
        }
      }
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  })();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>{staff.name}さんの勤怠管理</h1>
        <Link href="/">トップへ戻る</Link>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
          {error.includes('不整合') && (
            <button onClick={fixData} className={styles.fixButton}>
              データ修復（重複出勤記録の解消）
            </button>
          )}
        </div>
      )}

      <div className={styles.status}>
        <h2>現在のステータス</h2>
        {status.status ? (
          <p className={styles[status.status === '勤務中' ? 'working' : 'notWorking']}>
            {status.status}
          </p>
        ) : (
          <p className={styles.noStatus}>-</p>
        )}
      </div>

      {workTime && (
        <div className={styles.workTime}>
          <h2>本日の勤務時間</h2>
          <p>{workTime.name}さん</p>
          <p>勤務時間: {workTime.total}</p>
          <p>出勤: {workTime.clockIn}</p>
          <p>退勤: {workTime.clockOut}</p>
        </div>
      )}

      <div className={styles.records}>
        <div className={styles.monthSwitchRow}>
          <button
            className={styles.monthArrow}
            onClick={() => {
              if (viewMonth === 0) {
                setViewYear(viewYear - 1);
                setViewMonth(11);
              } else {
                setViewMonth(viewMonth - 1);
              }
            }}
            aria-label="前の月"
          >
            &lt;
          </button>
          <h2>{viewYear}年{viewMonth + 1}月の記録</h2>
          <button
            className={styles.monthArrow}
            onClick={() => {
              if (viewMonth === 11) {
                setViewYear(viewYear + 1);
                setViewMonth(0);
              } else {
                setViewMonth(viewMonth + 1);
              }
            }}
            aria-label="次の月"
          >
            &gt;
          </button>
        </div>
        <div className={styles.monthlyTotalInline}>
          <strong>{viewMonth + 1}月合計勤務時間: {filteredMonthlyTotal}</strong>
        </div>
        {filteredRecords.length > 0 ? (
          <table className={styles.recordsTable}>
            <thead>
              <tr>
                <th>日付</th>
                <th>開始</th>
                <th>終了</th>
                <th>休憩</th>
                <th>作業時間</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record, i) => (
                <tr key={i} className={styles.recordRow}>
                  <td className={styles.recordDate}>
                    {(() => {
                      const date = new Date(record.originalClockIn);
                      const month = (date.getMonth() + 1).toString().padStart(2, '0');
                      const day = date.getDate().toString().padStart(2, '0');
                      const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
                      const weekday = weekdays[date.getDay()];
                      return `${month}/${day}（${weekday}）`;
                    })()}
                  </td>
                  <td className={styles.recordTime}>{record.clockIn}</td>
                  <td className={styles.recordTime}>{record.clockOut || '退勤未記録'}</td>
                  <td className={styles.recordBreak}>
                    {record.originalBreakStart && record.originalBreakEnd
                      ? calculateBreakTime(record.originalBreakStart, record.originalBreakEnd)
                      : '-'}
                  </td>
                  <td className={styles.recordWorkTime}>
                    {record.clockOut && record.originalClockIn && record.originalClockOut ? (
                      calculateActualWorkTime(
                        record.originalClockIn,
                        record.originalClockOut,
                        record.originalBreakStart,
                        record.originalBreakEnd
                      )
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>記録がありません</p>
        )}
      </div>

      <div className={styles.actionButtons}>
        <button
          className={styles.buttonPrimary}
          onClick={() => handleAttendance('出勤')}
          disabled={status.status === '勤務中' || isTodayCompleted}
        >
          出勤
        </button>
        <button
          className={styles.buttonDanger}
          onClick={() => handleAttendance('退勤')}
          disabled={status.status === '退勤済み' || !status.isWorking}
        >
          退勤
        </button>
        <button className={styles.buttonSecondary}>休憩開始</button>
        <button className={styles.buttonSecondary}>休憩終了</button>
      </div>

      {staff && (
        <div className={styles.testButtons}>
          <div className={styles.testPatterns}>
            <h3>テストパターン（本日分を上書き）</h3>
            {testPatterns.map(pattern => (
              <button 
                key={pattern.name}
                className={styles.buttonTest}
                onClick={() => insertAndValidateTestData(staff.id, pattern.name)}
              >
                {pattern.name}
                <span className={styles.patternDescription}>{pattern.description}</span>
              </button>
            ))}
          </div>
          <button 
            className={styles.buttonTest}
            onClick={() => deleteTestData(staff.id)}
          >
            テストデータ削除（本日分）
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * 勤怠管理ページのルートコンポーネント
 * @returns {JSX.Element} Suspenseでラップされた勤怠管理画面
 */
export default function AttendancePage() {
  return (
    <Suspense fallback={<div>読み込み中...</div>}>
      <AttendanceContent />
    </Suspense>
  )
}