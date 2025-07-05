import { AttendanceRecord, Staff } from "../types";
import { calculateActualWorkTime } from "./calculations";
import { calculateWageForTimeRange } from "./wageCalculator";
import { formatDateWithWeekday, formatTimeString } from "./dateUtils";

type ExportData = {
  staff: Staff;
  records: AttendanceRecord[];
  year: number;
  month: number;
};

const formatWorkTime = (record: AttendanceRecord): string => {
  if (!record.clockOut || !record.originalClockIn || !record.originalClockOut) {
    return "-";
  }
  return calculateActualWorkTime(
    record.originalClockIn,
    record.originalClockOut,
    record.breakStart,
    record.breakEnd
  );
};

const formatWage = (record: AttendanceRecord): string => {
  if (!record.clockOut || !record.originalClockIn || !record.originalClockOut) {
    return "-";
  }
  const wage = calculateWageForTimeRange(
    new Date(record.originalClockIn),
    new Date(record.originalClockOut),
    record.breakStart ? new Date(record.breakStart) : null,
    record.breakEnd ? new Date(record.breakEnd) : null
  );
  return `¥${wage.toLocaleString()}`;
};

const formatBreakTime = (record: AttendanceRecord): string => {
  if (!record.breakStart || !record.breakEnd) {
    return "-";
  }
  return `${formatTimeString(new Date(record.breakStart))} - ${formatTimeString(new Date(record.breakEnd))}`;
};

export const generateTextContent = ({ staff, records, year, month }: ExportData): string => {
  const header = `勤怠記録\n`;
  const staffInfo = `スタッフ名: ${staff.name}\n期間: ${year}年${month}月\n\n`;
  
  const tableHeader = "日付\t\t開始時刻\t終了時刻\t休憩時間\t\t実労働時間\t給与\n";
  const separator = "=".repeat(80) + "\n";
  
  const recordRows = records
    .filter(record => {
      const date = new Date(record.originalClockIn);
      return date.getFullYear() === year && date.getMonth() === month - 1;
    })
    .map(record => {
      const date = formatDateWithWeekday(new Date(record.originalClockIn));
      const startTime = formatTimeString(new Date(record.originalClockIn));
      const endTime = record.clockOut ? formatTimeString(new Date(record.originalClockOut!)) : "-";
      const breakTime = formatBreakTime(record);
      const workTime = formatWorkTime(record);
      const wage = formatWage(record);
      
      return `${date}\t${startTime}\t${endTime}\t${breakTime}\t${workTime}\t${wage}\n`;
    })
    .join("");

  // 合計の計算
  const totalWorkMinutes = records.reduce((total, record) => {
    if (!record.clockOut || !record.originalClockIn || !record.originalClockOut) {
      return total;
    }
    const workTime = calculateActualWorkTime(
      record.originalClockIn,
      record.originalClockOut,
      record.breakStart,
      record.breakEnd
    );
    const [hours, minutes] = workTime.split(":").map(Number);
    return total + hours * 60 + minutes;
  }, 0);

  const totalWage = records.reduce((total, record) => {
    if (!record.clockOut || !record.originalClockIn || !record.originalClockOut) {
      return total;
    }
    return total + calculateWageForTimeRange(
      new Date(record.originalClockIn),
      new Date(record.originalClockOut),
      record.breakStart ? new Date(record.breakStart) : null,
      record.breakEnd ? new Date(record.breakEnd) : null
    );
  }, 0);

  const totalHours = Math.floor(totalWorkMinutes / 60);
  const totalMinutes = totalWorkMinutes % 60;
  const summary = `\n合計労働時間: ${totalHours}時間${totalMinutes}分\n合計給与: ¥${totalWage.toLocaleString()}\n`;

  return header + staffInfo + separator + tableHeader + separator + recordRows + separator + summary;
}; 