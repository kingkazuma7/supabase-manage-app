'use client'

import { useState } from 'react';
import { insertData } from "./actions";

const Page = () => {
  // 挿入するデータ
  const [text, setText] = useState('');

  return (
    <main>
      <form action={insertData}>
        <input 
          type='text' 
          value={text} 
          name='text' 
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value)} 
        />
        <button type='submit'>追加</button>
      </form>
    </main>
  );
}

export default Page; 