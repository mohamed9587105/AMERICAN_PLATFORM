import type { AcademicSnapshot } from "./types";

export function evaluateStudent(a: AcademicSnapshot) {
  // Balanced score: academics matter most, but commitment still changes the result.
  const score = Math.round(
    a.examAverage * 0.40 +
    a.homeworkCompletion * 0.25 +
    a.attendanceRate * 0.15 +
    a.commitmentRate * 0.15 +
    Math.max(0, 100 - (a.absences * 8 + a.lateCount * 3)) * 0.05
  );

  let label = "يحتاج تدخل";
  if (score >= 90) label = "ممتاز";
  else if (score >= 82) label = "جيد جدًا";
  else if (score >= 72) label = "جيد";
  else if (score >= 60) label = "يحتاج متابعة";

  const strengths: string[] = [];
  const concerns: string[] = [];

  if (a.attendanceRate >= 90) strengths.push("الحضور ممتاز");
  if (a.homeworkCompletion >= 90) strengths.push("ملتزم جدًا بالواجبات");
  if (a.examAverage >= 85) strengths.push("نتائج الاختبارات قوية");
  if (a.commitmentRate >= 88) strengths.push("الالتزام العام مرتفع");

  if (a.examAverage < 75) concerns.push("درجات الاختبارات تحتاج دعم");
  if (a.homeworkCompletion < 80) concerns.push("تسليم الواجبات غير منتظم");
  if (a.absences >= 3) concerns.push("الغياب يؤثر على الاستمرارية");
  if (a.lateCount >= 4) concerns.push("التأخير متكرر");

  const trendText =
    a.trend === "up" ? "ومستواه يتحسن خلال الفترة الأخيرة" :
    a.trend === "down" ? "لكن يوجد تراجع ملحوظ مقارنة بالفترة السابقة" :
    "ومستواه مستقر حاليًا";

  const comment = `${label === "ممتاز" || label === "جيد جدًا" ? "مستوى الطالب قوي" : "مستوى الطالب يحتاج متابعة"} ${trendText}. ${
    strengths.length ? "أبرز نقاط القوة: " + strengths.slice(0,2).join("، ") + "." : ""
  } ${
    concerns.length ? "نوصي بالتركيز على: " + concerns.slice(0,2).join("، ") + "." : "نوصي بالاستمرار على نفس مستوى الالتزام."
  }`;

  return { score, label, comment, strengths, concerns };
}
