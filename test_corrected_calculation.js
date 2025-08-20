// Test the corrected calculation with actual BETA TEST data
const fs = require('fs');

// Simulated CSV data that would come from the actual BETA TEST
const testData = [
  { Qty: 1, BarCode: "68", CustomName: "1152689", "Product Name": "Ladies Tunic - Patterned - 26" },
  { Qty: 2, BarCode: "53", CustomName: "1153606", "Product Name": "Ladies Polo - Green - 8" },
  { Qty: 6, BarCode: "57", CustomName: "1153708", "Product Name": "Unisex Polo - Green - XL" },
  { Qty: 6, BarCode: "22", CustomName: "1153708", "Product Name": "Mens Comfort Waist Flat Front Pant - Black - 97R" },
  { Qty: 6, BarCode: "55", CustomName: "1154024", "Product Name": "Unisex Polo - Green - M" },
  { Qty: 1, BarCode: "19", CustomName: "1154024", "Product Name": "Mens Comfort Waist Flat Front Pant - Black - 77R" },
  { Qty: 2, BarCode: "33", CustomName: "1154088", "Product Name": "Easy Care Ladies Overblouse  - Green Print - 8" },
  { Qty: 2, BarCode: "53", CustomName: "1154088", "Product Name": "Ladies Polo - Green - 8" },
  { Qty: 2, BarCode: "7", CustomName: "1154088", "Product Name": "Ladies Comfort Waist Slim Leg Pant - Black - 10" },
  { Qty: 1, BarCode: "8", CustomName: "1154128", "Product Name": "Ladies Comfort Waist Slim Leg Pant - Black - 14" }
];

console.log('=== CALCULATION TESTING ===');

// OLD (INCORRECT) CALCULATION - totalProducts = csvData.length
const oldCalculation = testData.length;
console.log('Old calculation (csvData.length):', oldCalculation);

// NEW (CORRECT) CALCULATION - totalProducts = sum of all Qty
const newCalculation = testData.reduce((sum, row) => sum + row.Qty, 0);
console.log('New calculation (sum of Qty):', newCalculation);

// Customer count (this should remain the same)
const totalCustomers = Array.from(new Set(testData.map(row => row.CustomName))).length;
console.log('Total customers:', totalCustomers);

console.log('\n=== DIFFERENCE ===');
console.log('Difference in product count:', newCalculation - oldCalculation);
console.log('This explains why the BETA TEST showed 162 instead of the correct sum of quantities.');
