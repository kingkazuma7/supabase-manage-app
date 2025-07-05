"use client";

import { useState, useEffect } from "react";
import { createClient } from "../utils/supabase/client";
import { useRouter } from "next/navigation";
import styles from "./master.module.css";
import Button from "../components/Button";

/**
 * スタッフ情報の型定義（マスター権限を含む）
 */
type Staff = {
  id: string;
  name: string;
  email: string;
  is_master?: boolean;
};

/**
 * マスター管理ページコンポーネント
 * スタッフのマスター権限を管理するためのページ
 */
export default function MasterManagementPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [processingStaffId, setProcessingStaffId] = useState<string | null>(null);
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [selectedStaffForEdit, setSelectedStaffForEdit] = useState<Staff | null>(null);
  const [editingStaffName, setEditingStaffName] = useState("");
  const [editingStaffEmail, setEditingStaffEmail] = useState("");
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffPassword, setNewStaffPassword] = useState("");
  
  const router = useRouter();

  /**
   * スタッフ一覧を取得する
   */
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("staff")
          .select("id, name, email, is_master")
          .order("name");

        if (error) {
          throw error;
        }

        setStaff(data || []);
      } catch (err) {
        console.error("Error fetching staff:", err);
        setError("スタッフ情報の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    fetchStaff();
  }, []);

  /**
   * マスター権限を切り替える
   */
  const toggleMasterPermission = async (staffId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const staffMember = staff.find(s => s.id === staffId);
    
    if (!staffMember) return;

    // 確認ダイアログ
    const confirmMessage = newStatus
      ? `${staffMember.name}さんにマスター権限を付与しますか？`
      : `${staffMember.name}さんのマスター権限を取り消しますか？`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setProcessingStaffId(staffId);
    setError(null);
    setSuccessMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("staff")
        .update({ is_master: newStatus })
        .eq("id", staffId);

      if (error) {
        throw error;
      }

      // 成功時にローカル状態を更新
      setStaff(prevStaff =>
        prevStaff.map(s =>
          s.id === staffId ? { ...s, is_master: newStatus } : s
        )
      );

      const action = newStatus ? "付与" : "取り消し";
      setSuccessMessage(`${staffMember.name}さんのマスター権限を${action}しました`);
      
      // 3秒後にメッセージを消去
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);

    } catch (err) {
      console.error("Error updating master permission:", err);
      setError("マスター権限の更新に失敗しました");
    } finally {
      setProcessingStaffId(null);
    }
  };

  const handleEditAccountClick = (staff: Staff) => {
    setSelectedStaffForEdit(staff);
    setEditingStaffName(staff.name);
    setEditingStaffEmail(staff.email);
    setIsEditingAccount(true);
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "アカウントの更新に失敗しました");
      }

      setSuccessMessage("アカウントの更新に成功しました");

      const supabase = createClient();
      const { data } = await supabase.from("staff").select("*");
      setStaff(data || []);

      setTimeout(() => {
        setIsEditingAccount(false);
        setSelectedStaffForEdit(null);
        setSuccessMessage(null);
      }, 2000);
    } catch (error) {
      setError((error as Error).message || "アカウントの更新に失敗しました");
    }
  };

  const handleDeleteAccount = async (staffId: string) => {
    setError(null);
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

      const supabase = createClient();
      const { data } = await supabase.from("staff").select("*");
      setStaff(data || []);
      setSuccessMessage("アカウントの削除に成功しました");

      setTimeout(() => {
        setSuccessMessage(null);
      }, 2000);
    } catch (error) {
      setError("アカウントの削除に失敗しました");
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
   * ホームページに戻る
   */
  const handleGoBack = () => {
    router.push("/");
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>読み込み中...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Button onClick={handleGoBack} variant="tertiary" aria-label="戻る">
          ← 戻る
        </Button>
        <h1 className={styles.title}>マスター管理</h1>
        <Button
          onClick={() => setIsCreatingAccount(true)}
          variant="primary"
          aria-label="アカウント作成"
          className={styles.alignRight}
        >
          ＋ アカウント作成
        </Button>
      </div>

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

      <div className={styles.staffList}>
        {staff.map((s) => (
          <div key={s.id} className={styles.staffItem}>
            <div className={styles.staffInfo}>
              <span className={styles.staffName}>👤 {s.name}</span>
              <span className={styles.staffEmail}>{s.email}</span>
              {s.is_master && (
                <span className={styles.masterBadge}>🔑 マスター</span>
              )}
            </div>
            <div className={styles.staffActions}>
              {s.is_master && (
                <span className={styles.masterBadge}>マスター</span>
              )}
              <Button
                variant="secondary"
                size="small"
                onClick={() => handleEditAccountClick(s)}
              >
                編集
              </Button>
              <Button
                variant="danger"
                size="small"
                onClick={() => handleDeleteAccount(s.id)}
              >
                削除
              </Button>
              <Button
                variant={s.is_master ? "danger" : "primary"}
                size="small"
                onClick={() => toggleMasterPermission(s.id, !!s.is_master)}
                disabled={processingStaffId === s.id}
              >
                {processingStaffId === s.id ? (
                  "処理中..."
                ) : (
                  s.is_master ? "権限解除" : "権限付与"
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>

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
                  required
                />
              </div>
              <div className={styles.buttonGroup}>
                <Button
                  type="button"
                  onClick={() => setIsEditingAccount(false)}
                  variant="tertiary"
                  aria-label="キャンセル"
                >
                  キャンセル
                </Button>
                <Button type="submit" variant="primary" aria-label="更新">
                  更新
                </Button>
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
                <Button
                  type="button"
                  onClick={() => setIsCreatingAccount(false)}
                  variant="tertiary"
                  aria-label="キャンセル"
                >
                  ✕ キャンセル
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  aria-label="アカウント作成"
                >
                  ✓ 作成
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
