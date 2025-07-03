"use client";

import { useState, useEffect } from "react";
import { createClient } from "./utils/supabase/client";
import { useRouter } from "next/navigation";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import styles from "./page.module.css";

/**
 * スタッフ情報の型定義
 * @typedef {Object} Staff
 * @property {string} id - スタッフの一意のID
 * @property {string} name - スタッフの名前
 * @property {string} email - スタッフのメールアドレス
 */
type Staff = {
  id: string;
  name: string;
  email: string;
  is_master: boolean;
};

/**
 * スタッフ管理アプリケーションのメインページコンポーネント
 * @returns {JSX.Element} スタッフ一覧と各種操作モーダルを含むページ
 */
export default function Home() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null); // 選択されたスタッフを状態に保存
  const [password, setPassword] = useState(""); // パスワードを状態に保存
  const [error, setError] = useState<string | null>(null); // エラーメッセージを状態に保存
  const [loading, setLoading] = useState(true); // 読み込み中のフラグ
  const [isCreatingAccount, setIsCreatingAccount] = useState(false); // アカウント作成モーダルの表示/非表示
  const [newStaffName, setNewStaffName] = useState(""); // 新規アカウントの名前
  const [newStaffEmail, setNewStaffEmail] = useState(""); // 新規アカウントのメールアドレス
  const [newStaffPassword, setNewStaffPassword] = useState(""); // 新規アカウントのパスワード
  const [showPassword, setShowPassword] = useState(false); // パスワード表示/非表示の状態
  const [successMessage, setSuccessMessage] = useState<string | null>(null); // 成功メッセージを状態に保存
  const [isEditingAccount, setIsEditingAccount] = useState(false); // 編集モーダルの表示/非表示
  const [selectedStaffForEdit, setSelectedStaffForEdit] =
    useState<Staff | null>(null); // 編集対象のスタッフ
  const [editingStaffName, setEditingStaffName] = useState(""); // 編集フォームの名前入力値
  const [editingStaffEmail, setEditingStaffEmail] = useState(""); // 編集フォームのメールアドレス入力値

  const router = useRouter(); // ルーターを使用

  /**
   * スタッフ一覧を取得する
   * @async
   * @function fetchStaff
   * @returns {Promise<void>}
   */
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const supabase = createClient(); // Supabaseクライアントを作成
        const { data } = await supabase.from("staff").select("*");

        setStaff(data || []); // スタッフデータを状態に保存
      } catch (err) {
        console.error("Error fetching staff:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStaff();
  }, []);

  /**
   * スタッフが選択された時の処理
   * @param {Staff} staff - 選択されたスタッフ情報
   */
  const handleStaffClick = (staff: Staff) => {
    setSelectedStaff(staff); // 選択されたスタッフを状態に保存
    setPassword(""); // パスワードをクリア
    setError(null); // エラーメッセージをクリア
  };

  /**
   * スタッフの編集モーダルを開く処理
   * @param {Staff} staff - 編集対象のスタッフ情報
   * @returns {void}
   */
  const handleEditAccountClick = (staff: Staff) => {
    setSelectedStaffForEdit(staff); // 編集対象のスタッフをセット
    setEditingStaffName(staff.name); // 編集フォームの名前をセット
    setEditingStaffEmail(staff.email); // 編集フォームのメールアドレスをセット
    setIsEditingAccount(true); // 編集モーダルを表示
  };

  /**
   * パスワード認証の処理
   * @async
   * @param {React.FormEvent} e - フォームイベント
   * @returns {Promise<void>}
   */
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // エラーメッセージをクリア
    setError(null);
    // 成功メッセージをクリア
    setSuccessMessage(null);

    if (!selectedStaff) return;

    try {
      const response = await fetch("/api/auth/verify-password", {
        // パスワード認証APIを呼び出し
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          staffId: selectedStaff.id,
          password,
        }),
      });

      if (!response.ok) {
        throw new Error("パスワードが正しくありません");
      }

      // 認証成功時に出退勤ページへ遷移
      router.push(`/attendance?staffId=${selectedStaff.id}`);
    } catch (error) {
      setError("パスワードが正しくありません");
    }
  };

  /**
   * アカウントの更新処理
   * @async
   * @param {React.FormEvent} e - フォームイベント
   * @returns {Promise<void>}
   */
  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    // エラーメッセージをクリア
    setError(null);
    // 成功メッセージをクリア
    setSuccessMessage(null);

    if (!selectedStaffForEdit) {
      setError("編集対象のスタッフが選択されていません");
      return;
    }

    if (!editingStaffName || !editingStaffEmail) {
      setError("名前とメールアドレスが必要です");
      return;
    }

    try {
      const response = await fetch("/api/auth/update-account", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selectedStaffForEdit.id,
          name: editingStaffName,
          email: editingStaffEmail,
        }),
      });

      // エラー処理
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "アカウントの更新に失敗しました");
      }

      // 成功メッセージ
      setSuccessMessage("アカウントの更新に成功しました");

      // スタッフ一覧を更新
      const supabase = createClient();
      const { data } = await supabase.from("staff").select("*");
      setStaff(data || []); // スタッフデータを状態に保存

      setTimeout(() => {
        setIsEditingAccount(false); // 編集モーダルを閉じる
        setSelectedStaffForEdit(null); // 編集対象のスタッフをクリア
        setSuccessMessage(null); // 成功メッセージをクリア
      }, 2000);
    } catch (error) {
      setError((error as Error).message || "アカウントの更新に失敗しました");
    }
  };

  /**
   * 新規アカウント作成の処理
   * @async
   * @param {React.FormEvent} e - フォームイベント
   * @returns {Promise<void>}
   */
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    // エラーメッセージをクリア
    setError(null);
    // 成功メッセージをクリア
    setSuccessMessage(null);

    if (!newStaffName || !newStaffEmail || !newStaffPassword) {
      setError("名前、メールアドレス、パスワードが必要です");
      return;
    }

    if (!newStaffEmail.includes("@") || !newStaffEmail.includes(".")) {
      setError("有効なメールアドレスを入力してください。");
      return;
    }

    try {
      const response = await fetch("/api/auth/create-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newStaffName,
          email: newStaffEmail,
          password: newStaffPassword,
        }),
      });

      // エラー処理
      if (!response.ok) {
        const errorData = await response.json();
        console.error("API Error:", errorData);
        throw new Error(errorData.message || "アカウントの作成に失敗しました"); // エラーメッセージをAPIから取得
      }

      // 成功メッセージ
      setSuccessMessage("アカウントの作成に成功しました");

      // アカウント作成成功後、スタッフ一覧を更新
      const supabase = createClient();
      const { data } = await supabase.from("staff").select("*");
      setStaff(data || []);
      setNewStaffName("");
      setNewStaffEmail("");
      setNewStaffPassword("");

      setTimeout(() => {
        setIsCreatingAccount(false); // 3秒後モーダル閉じる
        setSuccessMessage(null); // 3秒後成功メッセージをクリア
      }, 2000);
    } catch (error: unknown) {
      setError((error as Error).message || "アカウントの作成に失敗しました");
    }
  };

  /**
   * アカウント削除の処理
   * @async
   * @param {string} staffId - 削除対象のスタッフID
   * @returns {Promise<void>}
   */
  const handleDeleteAccount = async (staffId: string) => {
    // エラーメッセージをクリア
    setError(null);
    // 成功メッセージをクリア
    setSuccessMessage(null);

    if (!confirm("本当にこのアカウントを削除しますか？")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/auth/delete-account?staffId=${staffId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error("アカウントの削除に失敗しました");
      }

      // 削除成功後、スタッフ一覧を更新
      const supabase = createClient();
      const { data } = await supabase.from("staff").select("*");
      setStaff(data || []);
    } catch (error) {
      setError("アカウントの削除に失敗しました");
    }
  };

  if (loading) {
    return <div className={styles.container}>読み込み中...</div>;
  }

  return (
    <main className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>スタッフ一覧</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            onClick={() => setIsCreatingAccount(true)}
            className={styles.buttonSuccess}
            aria-label="アカウント作成"
          >
            ＋ アカウント作成
          </button>
        </div>
      </div>
      <div className={styles.staffList}>
        {staff.map((person) => (
          <div key={person.id} className={styles.staffItem}>
            <button
              onClick={() => handleStaffClick(person)}
              className={styles.buttonPrimary}
              aria-label={`${person.name}を選択`}
            >
              👤 {person.name}
            </button>
          </div>
        ))}
      </div>

      {/* パスワード入力モーダル */}
      {selectedStaff && (
        <div className={styles.modal} role="dialog" aria-modal="true">
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>
              {selectedStaff.name}さんのパスワードを入力
            </h2>
            <form onSubmit={handlePasswordSubmit} className={styles.form}>
              <div className={styles.passwordInputContainer}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.passwordInputField}
                  placeholder="パスワード"
                  required
                  autoComplete="current-password"
                  aria-label="パスワード"
                />
                <span
                  className={styles.togglePassword}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword
                      ? "パスワードを非表示にする"
                      : "パスワードを表示する"
                  }
                  role="button"
                  tabIndex={0}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>
              {error && (
                <div className={styles.error} role="alert">
                  {error}
                </div>
              )}
              <div className={styles.buttonGroup}>
                <button
                  type="button"
                  onClick={() => setSelectedStaff(null)}
                  className={styles.button}
                  aria-label="キャンセル"
                >
                  ✕ キャンセル
                </button>
                <button
                  type="submit"
                  className={styles.buttonPrimary}
                  aria-label="ログイン"
                >
                  ログイン
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* アカウント作成モーダル */}
      {isCreatingAccount && (
        <div className={styles.modal} role="dialog" aria-modal="true">
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
                autoComplete="name"
                aria-label="名前"
              />
              <input
                id="newStaffEmail"
                type="email"
                value={newStaffEmail}
                onChange={(e) => setNewStaffEmail(e.target.value)}
                className={styles.input}
                placeholder="メールアドレス"
                required
                aria-label="メールアドレス"
              />
              <input
                type="password"
                value={newStaffPassword}
                onChange={(e) => setNewStaffPassword(e.target.value)}
                className={styles.input}
                placeholder="パスワード"
                required
                autoComplete="new-password"
                aria-label="パスワード"
              />
              {successMessage && (
                <div className={styles.success} role="alert">
                  {successMessage}
                </div>
              )}
              {error && (
                <div className={styles.error} role="alert">
                  {error}
                </div>
              )}
              <div className={styles.buttonGroup}>
                <button
                  type="button"
                  onClick={() => setIsCreatingAccount(false)}
                  className={styles.button}
                  aria-label="キャンセル"
                >
                  ✕ キャンセル
                </button>
                <button
                  type="submit"
                  className={styles.buttonSuccess}
                  aria-label="アカウント作成"
                >
                  ✓ 作成
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* アカウント編集モーダル */}
      {isEditingAccount && selectedStaffForEdit && (
        <div className={styles.modal} role="dialog" aria-modal="true">
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>アカウント編集</h2>
            <form onSubmit={handleUpdateAccount} className={styles.form}>
              <div className={styles.inputGroup}>
                <label htmlFor="editStaffName">名前:</label>
                <input
                  id="editStaffName"
                  type="text"
                  value={editingStaffName}
                  onChange={(e) => setEditingStaffName(e.target.value)}
                  className={styles.input}
                  placeholder="スタッフ名"
                  required
                  aria-label="スタッフ名"
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="editStaffEmail">メールアドレス:</label>
                <input
                  id="editStaffEmail"
                  type="email"
                  value={editingStaffEmail}
                  onChange={(e) => setEditingStaffEmail(e.target.value)}
                  className={styles.input}
                  placeholder="メールアドレス"
                  aria-label="メールアドレス"
                />
              </div>
              {successMessage && (
                <div className={styles.success} role="alert">
                  {successMessage}
                </div>
              )}
              {error /* エラー表示も既存のロジックを参考に含める */ && (
                <div className={styles.error} role="alert">
                  {error}
                </div>
              )}
              <div className={styles.buttonGroup}>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingAccount(false); // モーダルを閉じる
                    setSelectedStaffForEdit(null); // 選択をクリア
                    setError(null); // エラーメッセージをクリア
                  }}
                  className={styles.button}
                  aria-label="キャンセル"
                >
                  ✕ キャンセル
                </button>
                <button
                  type="submit"
                  className={styles.buttonPrimary}
                  aria-label="更新"
                >
                  更新
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
