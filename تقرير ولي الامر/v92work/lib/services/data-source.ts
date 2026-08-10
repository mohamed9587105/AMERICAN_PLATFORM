import type {
  AcademicSnapshot,
  AttendanceItem,
  ExamItem,
  FinanceSnapshot,
  HomeworkItem,
  NotificationItem,
  Student,
  PaymentItem,
  WeeklyReport,
  ParentProfile,
} from "@/lib/types";

export interface ParentDataSource {
  getStudents(parentId: string): Promise<Student[]>;
  getAcademic(studentId: string): Promise<AcademicSnapshot>;
  getAttendance(studentId: string): Promise<AttendanceItem[]>;
  getHomework(studentId: string): Promise<HomeworkItem[]>;
  getExams(studentId: string): Promise<ExamItem[]>;
  getFinance(studentId: string): Promise<FinanceSnapshot>;
  getNotifications(studentId: string): Promise<NotificationItem[]>;
  getPayments(studentId:string): Promise<PaymentItem[]>;
  getWeeklyReport(studentId:string): Promise<WeeklyReport>;
  getParentProfile(parentId:string): Promise<ParentProfile>;
}

/**
 * IMPORTANT FOR AMERICAN PLATFORM:
 * The UI depends only on ParentDataSource.
 * Later we can replace mockDataSource with americanPlatformDataSource
 * without rebuilding the screens.
 */
