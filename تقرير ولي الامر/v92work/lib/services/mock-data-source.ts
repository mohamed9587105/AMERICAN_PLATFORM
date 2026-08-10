import type { ParentDataSource } from "./data-source";

export const mockDataSource: ParentDataSource = {
  async getStudents() {
    return [
      { id: "std_001", name: "محمود أحمد", level: "American Diploma", course: "EST Advanced" },
      { id: "std_002", name: "سارة أحمد", level: "Foundation", course: "Beginners EST" }
    ];
  },

  async getAcademic(studentId) {
    if (studentId === "std_002") {
      return {
        examAverage: 74,
        homeworkCompletion: 80,
        attendanceRate: 88,
        commitmentRate: 82,
        absences: 2,
        lateCount: 3,
        trend: "stable",
        subjectScores: [
          { name: "Reading", score: 72 },
          { name: "Writing", score: 77 },
          { name: "Vocabulary", score: 75 },
        ]
      };
    }
    return {
      examAverage: 86,
      homeworkCompletion: 92,
      attendanceRate: 95,
      commitmentRate: 90,
      absences: 1,
      lateCount: 2,
      trend: "up",
      subjectScores: [
        { name: "Reading", score: 81 },
        { name: "Writing", score: 90 },
        { name: "Vocabulary", score: 87 },
      ]
    };
  },

  async getAttendance() {
    return [
      { date: "2026-08-02", status: "present" },
      { date: "2026-08-04", status: "present" },
      { date: "2026-08-06", status: "late" },
      { date: "2026-08-08", status: "present" },
    ];
  },

  async getHomework() {
    return [
      { id: "hw1", title: "Reading Practice 04", status: "completed", dueDate: "2026-08-05", score: 92 },
      { id: "hw2", title: "Writing Homework 03", status: "completed", dueDate: "2026-08-07", score: 88 },
      { id: "hw3", title: "Vocabulary Set 06", status: "late", dueDate: "2026-08-09", score: null },
    ];
  },

  async getExams() {
    return [
      { id: "ex1", title: "Weekly Exam 01", score: 42, maxScore: 50, date: "2026-08-01", sections:[
        {name:"Reading",score:16,maxScore:20},{name:"Writing",score:17,maxScore:20},{name:"Vocabulary",score:9,maxScore:10}
      ] },
      { id: "ex2", title: "Weekly Exam 02", score: 44, maxScore: 50, date: "2026-08-08", sections:[
        {name:"Reading",score:17,maxScore:20},{name:"Writing",score:18,maxScore:20},{name:"Vocabulary",score:9,maxScore:10}
      ] },
    ];
  },

  async getFinance() {
    return {
      totalCourseFee: 5000,
      paid: 3750,
      remaining: 1250,
      nextInstallment: 1250,
      nextInstallmentDate: "2026-08-15"
    };
  },

  async getNotifications() {
    return [
      { id:"n1", type:"academic", title:"تحسن في المستوى", body:"متوسط نتائج محمود ارتفع خلال آخر اختبارين.", createdAt:"اليوم 10:30" },
      { id:"n2", type:"homework", title:"واجب متأخر", body:"يوجد واجب Vocabulary لم يتم تسليمه في موعده.", createdAt:"اليوم 09:15" },
      { id:"n3", type:"finance", title:"موعد قسط قريب", body:"القسط القادم يوم 15 أغسطس.", createdAt:"أمس 18:00" }
    ];
  },

  async getPayments() {
    return [
      {id:"pay1",amount:2000,date:"2026-07-01",method:"نقدي",receiptNo:"R-1001"},
      {id:"pay2",amount:1750,date:"2026-08-01",method:"InstaPay",receiptNo:"R-1044"}
    ];
  },

  async getWeeklyReport() {
    return {
      weekLabel:"الأسبوع 3–9 أغسطس",
      attendanceRate:95,
      homeworkCompletion:92,
      examAverage:86,
      commitmentRate:90,
      trend:"up",
      summary:"الأسبوع جيد جدًا. الحضور والواجبات ممتازان، ونتائج الاختبارات تتحسن. يحتاج الطالب فقط لمتابعة واجب Vocabulary المتأخر."
    };
  },

  async getParentProfile() {
    return {id:"parent_001",fullName:"ولي أمر محمود",phone:"01000000000"};
  }
};
