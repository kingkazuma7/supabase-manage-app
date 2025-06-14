'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function AttendanceContent() {
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

export default function AttendancePage() {
  return (
    <Suspense fallback={<div className="p-4">読み込み中...</div>}>
      <AttendanceContent />
    </Suspense>
  )
} 