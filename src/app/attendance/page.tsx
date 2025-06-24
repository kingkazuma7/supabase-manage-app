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
import { calculateWageForTimeRange } from './utils/wageCalculator'
import { formatDateWithWeekday, formatTimeString } from './utils/dateUtils'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/hooks/useAuth'
import { supabase } from '@/app/utils/supabaseClient'

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

  // 月次合計給与を計算
  const monthlyWageTotal = filteredRecords.reduce((total, record) => {
    if (record.clockOut && record.originalClockIn && record.originalClockOut) {
      return total + calculateWageForTimeRange(
        new Date(record.originalClockIn),
        new Date(record.originalClockOut),
        record.breakStart ? new Date(record.breakStart) : null,
        record.breakEnd ? new Date(record.breakEnd) : null
      );
    }
    return total;
  }, 0);

  return (
    <div className={styles.container}>
      {error && <div className={styles.error}>{error}</div>}
      
      <div className={styles.header}>
        <h1>{staff.name}さんの勤怠記録</h1>
        <div className={styles.status}>
          {status.isWorking && <span className={styles.working}>{status.message}</span>}
        </div>
      </div>

      <div className={styles.monthSelector}>
        <button
          onClick={() => {
            if (viewMonth === 0) {
              setViewYear(viewYear - 1);
              setViewMonth(11);
            } else {
              setViewMonth(viewMonth - 1);
            }
          }}
          className={styles.monthButton}
        >
          ←
        </button>
        <span className={styles.currentMonth}>
          {viewYear}年{viewMonth + 1}月
        </span>
        <button
          onClick={() => {
            if (viewMonth === 11) {
              setViewYear(viewYear + 1);
              setViewMonth(0);
            } else {
              setViewMonth(viewMonth + 1);
            }
          }}
          className={styles.monthButton}
        >
          →
        </button>
      </div>

      <div className={styles.monthlyTotal}>
        <div>
          <span>月間合計時間：</span>
          <span className={styles.totalTime}>{formattedMonthlyTotal}</span>
        </div>
        <div>
          <span>月間合計給与：</span>
          <span className={styles.totalWage}>¥{monthlyWageTotal.toLocaleString()}</span>
        </div>
      </div>

      <div className={styles.records}>
        {filteredRecords.length > 0 ? (
          <table className={styles.recordsTable}>
            <thead>
              <tr>
                <th>日付</th>
                <th>開始</th>
                <th>終了</th>
                <th>休憩</th>
                <th>作業時間</th>
                <th>給与</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record, i) => (
                <tr key={record.id} className={styles.recordRow}>
                  <td className={styles.recordDate}>
                    {formatDateWithWeekday(new Date(record.originalClockIn))}
                  </td>
                  <td className={styles.recordTime}>
                    {formatTimeString(new Date(record.originalClockIn))}
                  </td>
                  <td className={styles.recordTime}>
                    {record.clockOut ? (
                      formatTimeString(new Date(record.originalClockOut!))
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className={styles.recordBreak}>
                    {record.breakStart && record.breakEnd ? (
                      `${formatTimeString(new Date(record.breakStart))} - ${formatTimeString(new Date(record.breakEnd))}`
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className={styles.recordWorkTime}>
                    {record.clockOut ? (
                      calculateActualWorkTime(
                        record.originalClockIn,
                        record.originalClockOut!,
                        record.breakStart,
                        record.breakEnd
                      )
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className={styles.recordWage}>
                    {record.clockOut && record.originalClockIn && record.originalClockOut ? (
                      `¥${calculateWageForTimeRange(
                        new Date(record.originalClockIn),
                        new Date(record.originalClockOut),
                        record.breakStart ? new Date(record.breakStart) : null,
                        record.breakEnd ? new Date(record.breakEnd) : null
                      ).toLocaleString()}`
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
        <div className={styles.testSection}>
          <details>
            <summary>テストデータ操作（開発環境のみ）</summary>
            <div className={styles.testActions}>
              <div className={styles.testButtons}>
                <button 
                  onClick={() => insertAndValidateTestData(staffId || '', '休憩付き通常勤務')}
                  className={styles.buttonTest}
                >
                  通常勤務パターン
                </button>
                <button 
                  onClick={() => insertAndValidateTestData(staffId || '', '夜勤休憩付き')}
                  className={styles.buttonTest}
                >
                  夜勤パターン
                </button>
                <button 
                  onClick={() => insertAndValidateTestData(staffId || '', '日付跨ぎ休憩付き')}
                  className={styles.buttonTest}
                >
                  日付跨ぎパターン
                </button>
                <button 
                  onClick={() => insertAndValidateTestData(staffId || '', '複数日')}
                  className={styles.buttonTest}
                >
                  複数日パターン
                </button>
                <button 
                  onClick={() => insertAndValidateTestData(staffId || '', '3ヶ月分')}
                  className={styles.buttonTest}
                >
                  3ヶ月分データ
                </button>
                <button 
                  onClick={() => deleteTestData(staffId || '')}
                  className={styles.buttonDanger}
                >
                  テストデータ削除
                </button>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AttendanceContent />
    </Suspense>
  );
}