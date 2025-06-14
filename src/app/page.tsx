'use client'

import { useState, useEffect } from 'react'
import { createClient } from './utils/supabase/client'
import { useRouter } from 'next/navigation'

type Staff = {
  id: string
  name: string
}

export default function Home() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null) // 選択されたスタッフを状態に保存
  const [password, setPassword] = useState('') // パスワードを状態に保存
  const [error, setError] = useState<string | null>(null) // エラーメッセージを状態に保存
  const [loading, setLoading] = useState(true) // 読み込み中のフラグ
  const router = useRouter() // ルーターを使用

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

  const handleStaffClick = (staff: Staff) => {
    setSelectedStaff(staff) // 選択されたスタッフを状態に保存
    setPassword('') // パスワードをクリア
    setError(null) // エラーメッセージをクリア
  }

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

  if (loading) {
    return <div className="p-4">読み込み中...</div>
  }

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">スタッフ一覧</h1>
      <div className="grid grid-cols-2 gap-4">
        {staff.map((person) => (
          <button
            key={person.id}
            onClick={() => handleStaffClick(person)}
            className="p-4 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            {person.name}
          </button>
        ))}
      </div>

      {/* パスワード入力モーダル */}
      {selectedStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">
              {selectedStaff.name}さんのパスワードを入力
            </h2>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="パスワード"
                required
              />
              {error && (
                <div className="text-red-500">{error}</div>
              )}
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedStaff(null)}
                  className="px-4 py-2 bg-gray-500 text-white rounded"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded"
                >
                  認証
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
