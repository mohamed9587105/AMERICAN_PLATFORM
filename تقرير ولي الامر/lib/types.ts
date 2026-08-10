export type Student = {
  id: string;
  name: string;
  level: string;
  course: string;
};

export type AcademicSnapshot = {
  examAverage: number;
  homeworkCompletion: number;
  attendanceRate: number;
  commitmentRate: number;
  absences: number;
  lateCount: number;
  trend: "up" | "stable" | "down";
  subjectScores: { name: string; score: number }[];
};

export type FinanceSnapshot = {
  totalCourseFee: number;
  paid: number;
  remaining: number;
  nextInstallment: number;
  nextInstallmentDate: string;
};

export type HomeworkItem = {
  id: string;
  title: string;
  status: "completed" | "missing" | "late";
  dueDate: string;
  score?: number | null;
};

export type ExamItem = {
  id: string;
  title: string;
  score: number;
  maxScore?: number;
  date: string;
  sections?: { name:string; score:number; maxScore?:number }[];
};

export type AttendanceItem = {
  date: string;
  status: "present" | "absent" | "late";
};

export type NotificationItem = {
  id: string;
  type: "academic" | "attendance" | "finance" | "homework";
  title: string;
  body: string;
  createdAt: string;
};


export type PaymentItem = {
  id:string;
  amount:number;
  date:string;
  method:string;
  receiptNo?:string;
};

export type WeeklyReport = {
  weekLabel:string;
  attendanceRate:number;
  homeworkCompletion:number;
  examAverage:number;
  commitmentRate:number;
  trend:"up"|"stable"|"down";
  summary:string;
};

export type ParentProfile = {
  id:string;
  fullName:string;
  phone:string;
};
