"use client";

import { createClient } from "../utils/supabase/client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import styles from "../page.module.css";

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [passwordConf, setPasswordConf] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConf, setShowPasswordConf] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // パスワード確認チェック
    if (password !== passwordConf) {
      setError("パスワードが一致しません");
      setLoading(false);
      return;
    }

    // パスワード強度チェック
    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください");
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error: passwordResetError } = await supabase.auth.updateUser({
        password: password
      });

      if (passwordResetError) {
        throw passwordResetError;
      }

      // パスワード変更成功
      alert('パスワード変更が完了しました');
      await router.push("/");
    } catch (error) {
      setError('パスワード変更に失敗しました');
      console.error('Password update error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.push("/");
  };

  return (
    <div className={styles.container}>
      <div className={styles.modal}>
        <div className={styles.modalContent}>
          <h2 className={styles.modalTitle}>パスワード再設定</h2>
          <p style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            新しいパスワードを入力してください。
          </p>
          <form onSubmit={onSubmit} className={styles.form}>
            <div>
              <label htmlFor="password" style={{ display: 'block', marginBottom: '0.5rem' }}>
                新しいパスワード
              </label>
              <div className={styles.passwordInputContainer}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.passwordInputField}
                  placeholder="新しいパスワード"
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  aria-label="新しいパスワード"
                />
                <span
                  className={styles.togglePassword}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "パスワードを非表示にする" : "パスワードを表示する"}
                  role="button"
                  tabIndex={0}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>
            </div>
            <div>
              <label htmlFor="passwordConf" style={{ display: 'block', marginBottom: '0.5rem' }}>
                パスワード（確認）
              </label>
              <div className={styles.passwordInputContainer}>
                <input
                  id="passwordConf"
                  type={showPasswordConf ? "text" : "password"}
                  value={passwordConf}
                  onChange={(e) => setPasswordConf(e.target.value)}
                  className={styles.passwordInputField}
                  placeholder="パスワード（確認）"
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  aria-label="パスワード（確認）"
                />
                <span
                  className={styles.togglePassword}
                  onClick={() => setShowPasswordConf(!showPasswordConf)}
                  aria-label={showPasswordConf ? "パスワードを非表示にする" : "パスワードを表示する"}
                  role="button"
                  tabIndex={0}
                >
                  {showPasswordConf ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>
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
                {loading ? "変更中..." : "パスワード変更"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function SetPassword() {
  return (
    <Suspense fallback={
      <div className={styles.container}>
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>読み込み中...</h2>
          </div>
        </div>
      </div>
    }>
      <SetPasswordForm />
    </Suspense>
  );
} 