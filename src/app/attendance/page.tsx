'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useState, useEffect } from 'react'
import { createClient } from '../utils/supabase/client'
import styles from './attendance.module.css'

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
 * 出退勤管理のメインコンポーネント
 * @returns {JSX.Element} 出退勤管理画面
 */
function AttendanceContent() {
  // 1. URLパラメータの取得
  const searchParams = useSearchParams()
  const staffId = searchParams.get('staffId')
  console.log(staffId);
  

  // 2. 状態管理の設定
  const [staff, setStaff] = useState<Staff | null>(null)
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<AttendanceRecord[]>([])

  /**
   * スタッフ情報を取得する
   * @returns {Promise<void>}
   */
  useEffect(() => {
    const fetchStaff = async () => {
      if (!staffId) return
      
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('staff')
          .select('*')
          .eq('id', staffId)
          .single()

        setStaff(data)
      } catch (err) {
        console.error('Error fetching staff:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStaff()
  }, [staffId])

  /**
   * 出退勤記録を処理する
   * @param {AttendanceRecord['type']} type - 記録の種類（出勤/退勤/休憩開始/休憩終了）
   * @returns {void}
   */
  const handleAttendance = (type: AttendanceRecord['type']) => {
    const now = new Date()
    const time = now.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    
    setRecords(prev => [...prev, { time, type }])
  }

  if (loading) {
    return <div className={styles.container}>読み込み中...</div>
  }

  if (!staff) {
    return <div className={styles.container}>スタッフ情報が見つかりません</div>
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{staff.name}さんの出退勤</h1>
      </div>

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
        {records.length === 0 ? (
          <div className={styles.recordItem}>
            <span className={styles.recordTime}>--:--</span>
            <span className={styles.recordType}>記録なし</span>
          </div>
        ) : (
          records.map((record, index) => (
            <div key={index} className={styles.recordItem}>
              <span className={styles.recordTime}>{record.time}</span>
              <span className={styles.recordType}>{record.type}</span>
            </div>
          ))
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