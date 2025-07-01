import { createClient } from "@/app/utils/supabase/client";
import { AttendanceRecord } from "@/app/attendance/types";
import {
  addHours,
  subDays,
  subMonths,
  format,
  setHours,
  setMinutes,
  startOfMonth,
  addDays,
} from "date-fns";
import { Database } from "@/types/database.types";

type AttendanceRecordInsert =
  Database["public"]["Tables"]["attendance_records"]["Insert"];

export const insertAndValidateTestData = async (
  staffId: string,
  pattern: string,
) => {
  if (!staffId) return;

  const testData: AttendanceRecordInsert[] = [];
  const now = new Date();

  const shuffleArray = (array: Date[]): Date[] => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  switch (pattern) {
    case "休憩付き通常勤務":
      // 10:00-19:00の通常勤務（1時間休憩）
      testData.push({
        staff_id: staffId,
        date: format(now, "yyyy-MM-dd"),
        start_time: format(setHours(setMinutes(now, 0), 10), "HH:mm"),
        end_time: format(setHours(setMinutes(now, 0), 19), "HH:mm"),
        break_start: format(setHours(setMinutes(now, 0), 13), "HH:mm"),
        break_end: format(setHours(setMinutes(now, 0), 14), "HH:mm"),
        original_clock_in: format(
          setHours(setMinutes(now, 0), 10),
          "yyyy-MM-dd HH:mm:ss",
        ),
        original_clock_out: format(
          setHours(setMinutes(now, 0), 19),
          "yyyy-MM-dd HH:mm:ss",
        ),
      });
      break;

    case "夜勤休憩付き":
      // 20:00-翌5:00の夜勤（1時間休憩）
      testData.push({
        staff_id: staffId,
        date: format(now, "yyyy-MM-dd"),
        start_time: format(setHours(setMinutes(now, 0), 20), "HH:mm"),
        end_time: format(
          setHours(setMinutes(addHours(now, 24), 0), 5),
          "HH:mm",
        ),
        break_start: format(setHours(setMinutes(now, 0), 0), "HH:mm"),
        break_end: format(setHours(setMinutes(now, 0), 1), "HH:mm"),
        original_clock_in: format(
          setHours(setMinutes(now, 0), 20),
          "yyyy-MM-dd HH:mm:ss",
        ),
        original_clock_out: format(
          setHours(setMinutes(addHours(now, 24), 0), 5),
          "yyyy-MM-dd HH:mm:ss",
        ),
      });
      break;

    case "日付跨ぎ休憩付き":
      // 22:00-翌3:00の深夜勤務（30分休憩）
      testData.push({
        staff_id: staffId,
        date: format(now, "yyyy-MM-dd"),
        start_time: format(setHours(setMinutes(now, 0), 22), "HH:mm"),
        end_time: format(
          setHours(setMinutes(addHours(now, 24), 0), 3),
          "HH:mm",
        ),
        break_start: format(setHours(setMinutes(now, 30), 0), "HH:mm"),
        break_end: format(setHours(setMinutes(now, 0), 1), "HH:mm"),
        original_clock_in: format(
          setHours(setMinutes(now, 0), 22),
          "yyyy-MM-dd HH:mm:ss",
        ),
        original_clock_out: format(
          setHours(setMinutes(addHours(now, 24), 0), 3),
          "yyyy-MM-dd HH:mm:ss",
        ),
      });
      break;

    case "複数日":
      // 過去3日分のデータ
      for (let i = 0; i < 3; i++) {
        const date = subDays(now, i);
        testData.push({
          staff_id: staffId,
          date: format(date, "yyyy-MM-dd"),
          start_time: format(setHours(setMinutes(date, 0), 9), "HH:mm"),
          end_time: format(setHours(setMinutes(date, 0), 18), "HH:mm"),
          break_start: format(setHours(setMinutes(date, 0), 12), "HH:mm"),
          break_end: format(setHours(setMinutes(date, 0), 13), "HH:mm"),
          original_clock_in: format(
            setHours(setMinutes(date, 0), 9),
            "yyyy-MM-dd HH:mm:ss",
          ),
          original_clock_out: format(
            setHours(setMinutes(date, 0), 18),
            "yyyy-MM-dd HH:mm:ss",
          ),
        });
      }
      break;

    case "3ヶ月分":
      // 過去3ヶ月分のデータ（月10日程度の勤務）
      for (let i = 0; i < 3; i++) {
        const monthStart = startOfMonth(subMonths(now, i));
        const daysInMonth = Array.from({ length: 30 }, (_, k) =>
          addDays(monthStart, k),
        );
        const workingDays = shuffleArray(daysInMonth).slice(0, 10); // 月10日程度に調整

        for (const date of workingDays) {
          if ([0, 6].includes(date.getDay())) continue; // 土日はスキップ

          testData.push({
            staff_id: staffId,
            date: format(date, "yyyy-MM-dd"),
            start_time: format(setHours(setMinutes(date, 0), 9), "HH:mm"),
            end_time: format(setHours(setMinutes(date, 0), 18), "HH:mm"),
            break_start: format(setHours(setMinutes(date, 0), 12), "HH:mm"),
            break_end: format(setHours(setMinutes(date, 0), 13), "HH:mm"),
            original_clock_in: format(
              setHours(setMinutes(date, 0), 9),
              "yyyy-MM-dd HH:mm:ss",
            ),
            original_clock_out: format(
              setHours(setMinutes(date, 0), 18),
              "yyyy-MM-dd HH:mm:ss",
            ),
          });
        }
      }
      break;

    case "過去6ヶ月（均等分散）": // ユーザーの要望に合わせてパターン名を変更
      // 過去6ヶ月分のデータ（月10日程度で均等に分散）
      for (let i = 0; i < 6; i++) {
        const monthStart = startOfMonth(subMonths(now, i));
        const daysInMonth = Array.from({ length: 30 }, (_, k) =>
          addDays(monthStart, k),
        );
        const workingDays = shuffleArray(daysInMonth).slice(0, 10); // 月10日程度に調整

        for (const date of workingDays) {
          if ([0, 6].includes(date.getDay())) continue; // 土日はスキップ

          testData.push({
            staff_id: staffId,
            date: format(date, "yyyy-MM-dd"),
            start_time: format(setHours(setMinutes(date, 0), 9), "HH:mm"),
            end_time: format(setHours(setMinutes(date, 0), 18), "HH:mm"),
            break_start: format(setHours(setMinutes(date, 0), 12), "HH:mm"),
            break_end: format(setHours(setMinutes(date, 0), 13), "HH:mm"),
            original_clock_in: format(
              setHours(setMinutes(date, 0), 9),
              "yyyy-MM-dd HH:mm:ss",
            ),
            original_clock_out: format(
              setHours(setMinutes(date, 0), 18),
              "yyyy-MM-dd HH:mm:ss",
            ),
          });
        }
      }
      break;
  }

  // データの挿入
  const supabase = createClient(); // Supabaseクライアントのインスタンスを生成
  for (const record of testData) {
    const { error } = await supabase.from("attendance_records").insert(record);

    if (error) {
      console.error("Error inserting test data:", error);
      return;
    }
  }
};

export const deleteTestData = async (staffId: string) => {
  if (!staffId) return;

  const supabase = createClient(); // Supabaseクライアントのインスタンスを生成
  const { error } = await supabase
    .from("attendance_records")
    .delete()
    .eq("staff_id", staffId);

  if (error) {
    console.error("Error deleting test data:", error);
    return;
  }
};
