/** Simple spaced repetition: compute new mastery + next review date */
export type SrsGrade = "fail" | "hard" | "good" | "easy";

const INTERVALS_DAYS: Record<number, Record<SrsGrade, { delta: number; days: number }>> = {};

export function computeSrs(currentLevel: number, grade: SrsGrade) {
  let newLevel = currentLevel;
  let daysUntilReview = 1;

  switch (grade) {
    case "fail":
      newLevel = Math.max(0, currentLevel - 1);
      daysUntilReview = 0.25; // 6 hours
      break;
    case "hard":
      newLevel = currentLevel; // stay
      daysUntilReview = 1;
      break;
    case "good":
      newLevel = Math.min(5, currentLevel + 1);
      daysUntilReview = Math.pow(2, newLevel); // 1,2,4,8,16,32
      break;
    case "easy":
      newLevel = Math.min(5, currentLevel + 2);
      daysUntilReview = Math.pow(2, newLevel + 1);
      break;
  }

  const nextReview = new Date();
  nextReview.setTime(nextReview.getTime() + daysUntilReview * 24 * 60 * 60 * 1000);

  return { mastery_level: newLevel, next_review_date: nextReview.toISOString() };
}
