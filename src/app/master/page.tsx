"use client";

import { useState, useEffect } from "react";
import { createClient } from "../utils/supabase/client";
import { useRouter } from "next/navigation";
import styles from "../page.module.css";

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
    <main className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>マスター権限管理</h1>
        <button
          onClick={handleGoBack}
          className={styles.button}
          aria-label="ホームに戻る"
        >
          ← ホームに戻る
        </button>
      </div>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {successMessage && (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#d4edda', 
          color: '#155724', 
          border: '1px solid #c3e6cb', 
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          {successMessage}
        </div>
      )}

      <div className={styles.staffList}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>
          スタッフ一覧 ({staff.length}名)
        </h2>
        
        {staff.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            スタッフが登録されていません
          </div>
        ) : (
          staff.map((person) => (
            <div key={person.id} className={styles.staffItem}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                  👤 {person.name}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.2rem' }}>
                  {person.email}
                </div>
                <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                  状態: {person.is_master ? (
                    <span style={{ color: '#d63384', fontWeight: 'bold' }}>
                      🔥 マスター権限あり
                    </span>
                  ) : (
                    <span style={{ color: '#6c757d' }}>
                      一般スタッフ
                    </span>
                  )}
                </div>
              </div>
              
              <button
                onClick={() => toggleMasterPermission(person.id, person.is_master || false)}
                className={person.is_master ? styles.buttonDanger : styles.buttonSuccess}
                disabled={processingStaffId === person.id}
                aria-label={`${person.name}のマスター権限を${person.is_master ? '取り消し' : '付与'}する`}
              >
                {processingStaffId === person.id ? (
                  "処理中..."
                ) : person.is_master ? (
                  "🔥 権限取り消し"
                ) : (
                  "⭐ 権限付与"
                )}
              </button>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>📋 マスター権限について</h3>
        <ul style={{ marginBottom: '0', paddingLeft: '1.5rem' }}>
          <li>マスター権限を持つスタッフは、他のスタッフのアカウント編集・削除が可能です</li>
          <li>権限の付与・取り消しは慎重に行ってください</li>
          <li>現在、{staff.filter(s => s.is_master).length}名がマスター権限を持っています</li>
        </ul>
      </div>
    </main>
  );
}
