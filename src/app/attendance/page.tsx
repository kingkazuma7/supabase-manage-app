'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useState, useEffect } from 'react'
import { createClient } from '../utils/supabase/client'
import styles from './attendance.module.css'
import Link from 'next/link'

/**
 * スタッフ情報の型定義
 * @typedef {Object} Staff
 * @property {string} id - スタッフの一意のID
 * @property {string} name - スタッフの名前
 */
type Staff = {
  id: string
  name: string
}

/**
 * 出退勤記録の型定義
 * @typedef {Object} AttendanceRecord
 * @property {string} time - 記録時間（HH:mm形式）
 * @property {('出勤'|'退勤'|'休憩開始'|'休憩終了')} type - 記録の種類
 */
type AttendanceRecord = {
  time: string
  type: '出勤' | '退勤' | '休憩開始' | '休憩終了'
}

/**
 * 勤務時間の型定義
 * @typedef {Object} WorkTime
 * @property {string} total - 勤務時間の合計（例：8時間30分）
 * @property {string} name - スタッフの名前
 */
type WorkTime = {
  total: string
  name: string
}

/**
 * 出退勤管理のメインコンポーネント
 * @returns {JSX.Element} 出退勤管理画面
 */
function AttendanceContent() {
  const searchParams = useSearchParams()
  const staffId = searchParams.get('staffId')
  const [staff, setStaff] = useState<Staff | null>(null)
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [workTime, setWorkTime] = useState<WorkTime | null>(null)

  /**
   * 勤務時間を計算する
   * @param {string} clockIn - 出勤時間（ISO形式）
   * @param {string} clockOut - 退勤時間（ISO形式）
   * @returns {string} 勤務時間（例：8時間30分）
   */
  const calculateWorkTime = (clockIn: string, clockOut: string): string => {
    const start = new Date(clockIn)
    const end = new Date(clockOut)
    const diff = end.getTime() - start.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}時間${minutes}分`
  }

  /**
   * 勤務時間の合計を計算する
   * @param {Array<{clock_in: string, clock_out: string | null}>} records - 出退勤記録の配列
   * @returns {string} 合計勤務時間（例：8時間30分）
   */
  const calculateTotalWorkTime = (records: Array<{clock_in: string, clock_out: string | null}>): string => {
    const totalMinutes = records.reduce((total, record) => {
      if (record.clock_out) {
        const start = new Date(record.clock_in)
        const end = new Date(record.clock_out)
        const diff = end.getTime() - start.getTime()
        return total + Math.floor(diff / (1000 * 60))
      }
      return total
    }, 0)

    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return `${hours}時間${minutes}分`
  }

  /**
   * 初期データを取得する
   * @returns {Promise<void>}
   */
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!staffId) return
      
      try {
        const supabase = createClient()
        const { data: staffData } = await supabase
          .from('staff')
          .select('*')
          .eq('id', staffId)
          .single()

        const today = new Date().toISOString().split('T')[0]
        const { data: recordsData } = await supabase
          .from('attendance')
          .select('*')
          .eq('staff_id', staffId)
          .gte('clock_in', today)
          .order('clock_in', { ascending: true })

        setStaff(staffData)
        if (recordsData) {
          const formattedRecords = recordsData.map(record => ({
            time: new Date(record.clock_in).toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            }),
            type: record.clock_out ? ('退勤' as const) : ('出勤' as const)
          }))
          setRecords(formattedRecords)

          // 勤務時間の計算
          const completedRecords = recordsData.filter(record => record.clock_out)
          if (completedRecords.length > 0) {
            const totalWorkTime = calculateTotalWorkTime(completedRecords)
            setWorkTime({
              total: totalWorkTime,
              name: staffData.name
            })
          }
        }
      } catch (err) {
        console.error('初期データの取得に失敗:', err)
        setError('データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    fetchInitialData()
  }, [staffId])

  /**
   * 出退勤記録を処理する
   * @param {AttendanceRecord['type']} type - 記録の種類（出勤/退勤/休憩開始/休憩終了）
   * @returns {Promise<void>}
   */
  const handleAttendance = async (type: AttendanceRecord['type']) => {
    try {
      const now = new Date()
      const time = now.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })

      if (!staff) {
        throw new Error('スタッフ情報が見つかりません')
      }
      
      const supabase = createClient()
      
      // 本日の最新の記録を取得
      const { data: latestRecords, error: fetchError } = await supabase
        .from('attendance')
        .select('*')
        .eq('staff_id', staff.id)
        .order('clock_in', { ascending: false })
        .limit(1)

      if (fetchError) {
        console.error('最新の記録取得に失敗:', fetchError)
        throw new Error('最新の記録取得に失敗しました')
      }
      
      const latestRecord = latestRecords?.[0]

      // 出勤・退勤の順序チェック
      if (type === '出勤' && latestRecord && !latestRecord.clock_out) {
        throw new Error('前回の出勤が退勤されていません')
      }

      if (type === '退勤' && (!latestRecord || latestRecord.clock_out)) {
        throw new Error('出勤記録が見つかりません')
      }

      if (type === '出勤') {
        const { error } = await supabase
          .from('attendance')
          .insert({
            staff_id: staff.id,
            clock_in: now.toISOString()
          })
          .select()
          
          if (error) {
            console.error('出勤記録の保存に失敗:', {
              error,
              staffId: staff.id,
              timestamp: now.toISOString(),
              type: '出勤'
            })
            throw new Error(`出勤記録の保存に失敗しました: ${error.message}`)
          }

          // 出勤成功時のアラート
          alert(`${time}に出勤しました`)
      } else if (type === '退勤') {
        const { error } = await supabase
          .from('attendance')
          .update({
            clock_out: now.toISOString()
          })
          .eq('staff_id', staff.id)
          .is('clock_out', null)
          .order('clock_in', { ascending: false })
          .limit(1)
          .select()
          
          if (error) {
            console.error('退勤記録の更新に失敗:', {
              error,
              staffId: staff.id,
              timestamp: now.toISOString(),
              type: '退勤',
              latestRecord
            })
            throw new Error(`退勤記録の更新に失敗しました: ${error.message}`)
          }

          // 退勤成功時のアラート
          alert(`${time}に退勤しました`)

          // 本日の全記録を取得して勤務時間を再計算
          const today = new Date().toISOString().split('T')[0]
          const { data: todayRecords } = await supabase
            .from('attendance')
            .select('*')
            .eq('staff_id', staff.id)
            .gte('clock_in', today)
            .order('clock_in', { ascending: true })

          if (todayRecords) {
            const completedRecords = todayRecords.filter(record => record.clock_out)
            const totalWorkTime = calculateTotalWorkTime(completedRecords)
            setWorkTime({
              total: totalWorkTime,
              name: staff.name
            })
            alert(`${staff.name}さんの本日の合計勤務時間は${totalWorkTime}です`)
          }
      }

      setRecords(prev => [...prev, { time, type }])
    } catch (error) {
      setError(error instanceof Error ? error.message : '予期せぬエラーが発生しました')
      console.error('勤怠管理レコードの保存に失敗しました', error)
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>読み込み中...</div>
      </div>
    )
  }

  if (!staff) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>スタッフ情報が見つかりません</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{staff.name}さんの出退勤</h1>
        <Link href="/" className={styles.backButton}>
          トップへ戻る
        </Link>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {workTime && (
        <div className={styles.workTime}>
          <h2 className={styles.subtitle}>本日の勤務時間</h2>
          <p>{workTime.name}さん: {workTime.total}</p>
        </div>
      )}

      <div className={styles.actionButtons}>
        <button 
          className={styles.buttonPrimary}
          onClick={() => handleAttendance('出勤')}
        >
          出勤
        </button>
        <button 
          className={styles.buttonDanger}
          onClick={() => handleAttendance('退勤')}
        >
          退勤
        </button>
        <button 
          className={styles.buttonSecondary}
          onClick={() => handleAttendance('休憩開始')}
        >
          休憩開始
        </button>
        <button 
          className={styles.buttonSecondary}
          onClick={() => handleAttendance('休憩終了')}
        >
          休憩終了
        </button>
      </div>

      <div className={styles.recordList}>
        <h2 className={styles.subtitle}>本日の記録</h2>
        {records.length > 0 ? (
          records.map((record, index) => (
            <div key={index} className={styles.recordItem}>
              <span className={styles.recordTime}>{record.time}</span>
              <span className={styles.recordType}>{record.type}</span>
            </div>
          ))
        ) : (
          <div className={styles.recordItem}>
            <span className={styles.recordTime}>--:--</span>
            <span className={styles.recordType}>記録なし</span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 出退勤ページのルートコンポーネント
 * @returns {JSX.Element} Suspenseでラップされた出退勤管理画面
 */
export default function AttendancePage() {
  return (
    <Suspense fallback={<div className={styles.container}>読み込み中...</div>}>
      <AttendanceContent />
    </Suspense>
  )
} 