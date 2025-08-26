/**
 * Format box number for display
 * - Removes .0 from whole numbers: "2.0" -> "2" 
 * - Preserves decimals: "2.1" -> "2.1"
 * @param boxNumber - The box number as string or number
 * @returns Formatted box number string
 */
export function formatBoxNumber(boxNumber: string | number): string {
  if (boxNumber === null || boxNumber === undefined) {
    return '-';
  }
  
  const numStr = boxNumber.toString();
  
  // If it ends with .0, remove the .0
  if (numStr.endsWith('.0')) {
    return numStr.slice(0, -2);
  }
  
  return numStr;
}