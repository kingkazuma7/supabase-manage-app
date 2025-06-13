'use client'

import { useState, useEffect } from 'react'
import { createClient } from './utils/supabase/client'

type Staff = {
  id: string
  name: string
}

export default function Home() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true);
  

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('staff')
          .select('*')

        if (error) throw error
        setStaff(data || [])
      } catch (error) {
        console.error('Error fetching staff:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStaff()
  }, [])

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
            className="p-4 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            {person.name}
          </button>
        ))}
      </div>
    </main>
  )
}
