/**
 * Calculate performance score based on industry standards
 * Score scale: 1-10
 * 
 * Factors:
 * - Scans per hour (target: 71 items/hour industry average)
 * - Time per scan consistency
 * - Accuracy rate
 */

export function calculateScore(
  totalScans: number,
  sessionDurationMs: number,
  errorCount: number = 0,
  undoCount: number = 0
): number {
  if (totalScans === 0 || sessionDurationMs === 0) return 0;

  const sessionHours = sessionDurationMs / (1000 * 60 * 60);
  const scansPerHour = totalScans / sessionHours;
  
  // Base score from scans per hour
  let score = 0;
  if (scansPerHour >= 360) {
    score = 10; // >3600 items/hour (faster than 1 second per item)
  } else if (scansPerHour >= 180) {
    score = 8 + (scansPerHour - 180) / 180 * 2; // 180-360 items/hour
  } else if (scansPerHour >= 71) {
    score = 6 + (scansPerHour - 71) / 109 * 2; // 71-180 items/hour
  } else if (scansPerHour >= 36) {
    score = 4 + (scansPerHour - 36) / 35 * 2; // 36-71 items/hour
  } else if (scansPerHour >= 18) {
    score = 2 + (scansPerHour - 18) / 18 * 2; // 18-36 items/hour
  } else {
    score = 1; // <18 items/hour
  }

  // Apply penalties
  const errorPenalty = errorCount * 0.1;
  const undoPenalty = undoCount * 0.05;
  
  score = Math.max(1, score - errorPenalty - undoPenalty);
  
  return Math.min(10, Math.round(score * 10) / 10);
}

export function getScoreCategory(score: number): {
  label: string;
  color: string;
  description: string;
} {
  if (score >= 9) {
    return {
      label: "Excellent",
      color: "success",
      description: "Outstanding performance"
    };
  } else if (score >= 7) {
    return {
      label: "Good",
      color: "success", 
      description: "Above average performance"
    };
  } else if (score >= 5) {
    return {
      label: "Average",
      color: "warning",
      description: "Meeting basic expectations"
    };
  } else if (score >= 3) {
    return {
      label: "Below Average",
      color: "warning",
      description: "Needs improvement"
    };
  } else {
    return {
      label: "Poor", 
      color: "error",
      description: "Significant improvement needed"
    };
  }
}

export function calculateAccuracy(
  successfulScans: number,
  totalScans: number,
  errorCount: number = 0
): number {
  if (totalScans === 0) return 100;
  return Math.round(((successfulScans) / (totalScans + errorCount)) * 100);
}

export function getIndustryBenchmark(scansPerHour: number): {
  benchmark: string;
  comparison: string;
} {
  if (scansPerHour >= 100) {
    return {
      benchmark: "Top 10%",
      comparison: "Significantly above industry average"
    };
  } else if (scansPerHour >= 85) {
    return {
      benchmark: "Top 25%", 
      comparison: "Well above industry average"
    };
  } else if (scansPerHour >= 71) {
    return {
      benchmark: "Industry Average",
      comparison: "Meeting industry standards"
    };
  } else if (scansPerHour >= 50) {
    return {
      benchmark: "Below Average",
      comparison: "Below industry standards"
    };
  } else {
    return {
      benchmark: "Bottom 25%",
      comparison: "Significantly below industry average"
    };
  }
}
