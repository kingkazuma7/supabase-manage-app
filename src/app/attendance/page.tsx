'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import styles from './attendance.module.css'
import Link from 'next/link'
import { insertAndValidateTestData, deleteTestData, testPatterns } from './testData'
import { useAttendance } from './hooks/useAttendance'
import { Staff, AttendanceRecord, WorkTime, AttendanceStatus, MonthlyTotal } from './types'
import { 
  calculateWorkTime, 
  calculateActualWorkTime,
  getMinutesFromHHMM,
  formatMinutesToTime
} from './utils/calculations'
import { formatDateWithWeekday } from './utils/dateUtils'

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
    monthlyTotal: monthlyTotalFromHook,
    viewYear,
    viewMonth,
    setViewYear,
    setViewMonth,
    handleAttendance,
    handleBreak,
    fixData
  } = useAttendance(staffId);

  if (!staff) return <div className={styles.loading}>読み込み中...</div>

  // 表示月のレコードのみ抽出
  const filteredRecords = records.filter(record => {
    const date = new Date(record.originalClockIn);
    return date.getFullYear() === viewYear && date.getMonth() === viewMonth;
  });

  // 月次合計実労働時間を計算
  const actualMonthlyTotal = filteredRecords.reduce((total, record) => {
    if (record.clockOut && record.originalClockIn && record.originalClockOut) {
      const workTime = calculateActualWorkTime(
        record.originalClockIn,
        record.originalClockOut,
        record.breakStart,
        record.breakEnd
      );
      return total + getMinutesFromHHMM(workTime);
    }
    return total;
  }, 0);

  const formattedMonthlyTotal = formatMinutesToTime(actualMonthlyTotal);

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
        <div className={styles.monthlyTotal}>
          <h2>{viewMonth + 1}月合計勤務時間: {formattedMonthlyTotal}</h2>
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
                    {formatDateWithWeekday(new Date(record.originalClockIn))}
                  </td>
                  <td className={styles.recordTime}>{record.clockIn}</td>
                  <td className={styles.recordTime}>{record.clockOut || '退勤未記録'}</td>
                  <td className={styles.recordTime}>
                    {record.breakStart && record.breakEnd
                      ? calculateWorkTime(record.breakStart, record.breakEnd)
                      : '-'}
                  </td>
                  <td className={styles.recordWorkTime}>
                    {record.clockOut && record.originalClockIn && record.originalClockOut ? (
                      calculateActualWorkTime(
                        record.originalClockIn,
                        record.originalClockOut,
                        record.breakStart,
                        record.breakEnd
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
          <p className={styles.noRecords}>記録がありません</p>
        )}
      </div>

      <div className={styles.actionButtons}>
        <button
          onClick={() => handleAttendance('出勤')}
          disabled={status.isWorking || isTodayCompleted}
          className={styles.buttonPrimary}
        >
          出勤
        </button>
        <button
          onClick={() => handleAttendance('退勤')}
          disabled={!status.isWorking || status.isOnBreak}
          className={styles.buttonDanger}
        >
          退勤
        </button>
        <button
          onClick={() => handleBreak('休憩開始')}
          disabled={!status.isWorking || status.isOnBreak || status.isBreakCompleted}
          className={styles.buttonSecondary}
        >
          休憩開始
        </button>
        <button
          onClick={() => handleBreak('休憩終了')}
          disabled={!status.isOnBreak}
          className={styles.buttonSecondary}
        >
          休憩終了
        </button>
      </div>

      {process.env.NODE_ENV === 'development' && (
        <div className={styles.testActions}>
          <h3>テストデータ操作（開発環境のみ）</h3>
          <div className={styles.testButtons}>
            <button 
              onClick={() => insertAndValidateTestData(staffId || '', '休憩付き通常勤務')}
              className={styles.buttonTest}
            >
              通常パターン
            </button>
            <button 
              onClick={() => insertAndValidateTestData(staffId || '', '複数日')}
              className={styles.buttonTest}
            >
              3ヶ月分
            </button>
            <button 
              onClick={() => deleteTestData(staffId || '')}
              className={styles.buttonTest}
            >
              テストデータ削除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 勤怠管理ページのルートコンポーネント
 * @returns {JSX.Element} Suspenseでラップされた勤怠管理画面
 */
export default function AttendancePage() {
  return (
    <Suspense fallback={<div className={styles.loading}>読み込み中...</div>}>
      <AttendanceContent />
    </Suspense>
  );
}