"use client";

import { createClient } from "../utils/supabase/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../page.module.css";

export default function PasswordReset() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const supabase = createClient();
      
      // より詳細なログ出力
      console.log('Attempting to send password reset email to:', email);
      console.log('Redirect URL:', `${window.location.origin}/set-password`);
      
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/set-password`,
      });
      
      // レスポンスをログに出力
      console.log('Reset password response:', { data, error });
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      // 成功時もログに出力
      console.log('Password reset email request successful');
      setSuccess(true);
    } catch (error) {
      console.error('Password reset error:', error);
      
      // より詳細なエラーメッセージ
      const errorMessage = error instanceof Error ? error.message : 'パスワードリセットメールの送信に失敗しました';
      setError(`エラー: ${errorMessage}`);
      
      // エラーの詳細をログに出力
      console.error('Error details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.push("/");
  };

  if (success) {
    return (
      <div className={styles.container}>
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>メール送信完了</h2>
            <p style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              パスワードリセット用のメールを送信しました。
              <br />
              メール内のリンクをクリックしてパスワードを変更してください。
            </p>
            <div className={styles.buttonGroup}>
              <button
                type="button"
                onClick={handleBackToLogin}
                className={styles.buttonPrimary}
              >
                トップ画面に戻る
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.modal}>
        <div className={styles.modalContent}>
          <h2 className={styles.modalTitle}>パスワードリセット</h2>
          <p style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            登録されているメールアドレスを入力してください。
            <br />
            パスワードリセット用のメールをお送りします。
          </p>
          <form onSubmit={onSubmit} className={styles.form}>
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
                placeholder="メールアドレス"
                required
                disabled={loading}
                autoComplete="email"
                aria-label="メールアドレス"
              />
            </div>
            {error && (
              <div className={styles.error} role="alert">
                {error}
              </div>
            )}
            <div className={styles.buttonGroup}>
              <button
                type="button"
                onClick={handleBackToLogin}
                className={styles.buttonTertiary}
                disabled={loading}
              >
                キャンセル
              </button>
              <button
                type="submit"
                className={styles.buttonPrimary}
                disabled={loading}
              >
                {loading ? "送信中..." : "リセットメール送信"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}