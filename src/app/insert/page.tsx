'use client'

import { useState } from 'react';
import { insertData } from "./actions";

const Page = () => {
  // 挿入するデータ
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    try {
      setError(null);
      await insertData(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
    }
  };

  return (
    <main>
      <form action={handleSubmit}>
        <input 
          type='text' 
          value={text} 
          name='text' 
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value)} 
        />
        <button type='submit'>追加</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </main>
  );
}

export default Page; 