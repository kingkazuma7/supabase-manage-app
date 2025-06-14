'use client'

import { useSearchParams } from 'next/navigation'

export default function AttendancePage() {
  const searchParams = useSearchParams()
  const staffId = searchParams.get('staffId')

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">出退勤ページ</h1>
      <p>スタッフID: {staffId}</p>
      {/* ここに出退勤機能を実装 */}
    </div>
  )
} 