'use client'

import { useState, useEffect } from 'react'
import { createClient } from './utils/supabase/client'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'

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
 * スタッフ管理アプリケーションのメインページコンポーネント
 * @returns {JSX.Element} スタッフ一覧と各種操作モーダルを含むページ
 */
export default function Home() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null) // 選択されたスタッフを状態に保存
  const [password, setPassword] = useState('') // パスワードを状態に保存
  const [error, setError] = useState<string | null>(null) // エラーメッセージを状態に保存
  const [loading, setLoading] = useState(true) // 読み込み中のフラグ
  const [isCreatingAccount, setIsCreatingAccount] = useState(false)
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffPassword, setNewStaffPassword] = useState('')
  const router = useRouter() // ルーターを使用

  /**
   * スタッフ一覧を取得する
   * @async
   * @function fetchStaff
   * @returns {Promise<void>}
   */
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const supabase = createClient() // Supabaseクライアントを作成
        const { data } = await supabase
          .from('staff')
          .select('*')

        setStaff(data || []) // スタッフデータを状態に保存
      } catch (err) {
        console.error('Error fetching staff:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStaff()
  }, [])

  /**
   * スタッフが選択された時の処理
   * @param {Staff} staff - 選択されたスタッフ情報
   */
  const handleStaffClick = (staff: Staff) => {
    setSelectedStaff(staff) // 選択されたスタッフを状態に保存
    setPassword('') // パスワードをクリア
    setError(null) // エラーメッセージをクリア
  }

  /**
   * パスワード認証の処理
   * @async
   * @param {React.FormEvent} e - フォームイベント
   * @returns {Promise<void>}
   */
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStaff) return

    try {
      const response = await fetch('/api/auth/verify-password', { // パスワード認証APIを呼び出し
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          staffId: selectedStaff.id,
          password,
        }),
      })

      if (!response.ok) {
        throw new Error('パスワードが正しくありません')
      }

      // 認証成功時に出退勤ページへ遷移
      router.push(`/attendance?staffId=${selectedStaff.id}`)
    } catch (error) {
      setError('パスワードが正しくありません')
    }
  }

  /**
   * 新規アカウント作成の処理
   * @async
   * @param {React.FormEvent} e - フォームイベント
   * @returns {Promise<void>}
   */
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/auth/create-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newStaffName,
          password: newStaffPassword,
        }),
      })

      if (!response.ok) {
        throw new Error('アカウントの作成に失敗しました')
      }

      // アカウント作成成功後、スタッフ一覧を更新
      const supabase = createClient()
      const { data } = await supabase.from('staff').select('*')
      setStaff(data || [])
      setIsCreatingAccount(false)
      setNewStaffName('')
      setNewStaffPassword('')
    } catch (error) {
      setError('アカウントの作成に失敗しました')
    }
  }

  /**
   * アカウント削除の処理
   * @async
   * @param {string} staffId - 削除対象のスタッフID
   * @returns {Promise<void>}
   */
  const handleDeleteAccount = async (staffId: string) => {
    if (!confirm('本当にこのアカウントを削除しますか？')) {
      return;
    }

    try {
      const response = await fetch(`/api/auth/delete-account?staffId=${staffId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('アカウントの削除に失敗しました');
      }

      // 削除成功後、スタッフ一覧を更新
      const supabase = createClient();
      const { data } = await supabase.from('staff').select('*');
      setStaff(data || []);
    } catch (error) {
      setError('アカウントの削除に失敗しました');
    }
  };

  if (loading) {
    return <div className={styles.container}>読み込み中...</div>
  }

  return (
    <main className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>スタッフ一覧</h1>
        <button
          onClick={() => setIsCreatingAccount(true)}
          className={styles.buttonSuccess}
        >
          アカウント作成
        </button>
      </div>
      <div className={styles.staffList}>
        {staff.map((person) => (
          <div key={person.id} className={styles.staffItem}>
            <button
              onClick={() => handleStaffClick(person)}
              className={styles.buttonPrimary}
            >
              {person.name}
            </button>
            <button
              onClick={() => handleDeleteAccount(person.id)}
              className={styles.buttonDanger}
            >
              削除
            </button>
          </div>
        ))}
      </div>

      {/* パスワード入力モーダル */}
      {selectedStaff && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>
              {selectedStaff.name}さんのパスワードを入力
            </h2>
            <form onSubmit={handlePasswordSubmit} className={styles.form}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                placeholder="パスワード"
                required
              />
              {error && (
                <div className={styles.error}>{error}</div>
              )}
              <div className={styles.buttonGroup}>
                <button
                  type="button"
                  onClick={() => setSelectedStaff(null)}
                  className={styles.button}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className={styles.buttonPrimary}
                >
                  認証
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* アカウント作成モーダル */}
      {isCreatingAccount && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>アカウント作成</h2>
            <form onSubmit={handleCreateAccount} className={styles.form}>
              <input
                type="text"
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                className={styles.input}
                placeholder="名前"
                required
              />
              <input
                type="password"
                value={newStaffPassword}
                onChange={(e) => setNewStaffPassword(e.target.value)}
                className={styles.input}
                placeholder="パスワード"
                required
              />
              {error && (
                <div className={styles.error}>{error}</div>
              )}
              <div className={styles.buttonGroup}>
                <button
                  type="button"
                  onClick={() => setIsCreatingAccount(false)}
                  className={styles.button}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className={styles.buttonSuccess}
                >
                  作成
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
