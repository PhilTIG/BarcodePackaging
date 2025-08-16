/**
 * Verification tests for Box-to-Customer mapping integrity
 * Ensures the POC logic is maintained: customers are assigned to boxes 
 * in the order they first appear in the CSV data
 */

const API_BASE = 'http://localhost:5000';
const AUTH_TOKEN = '60fe776a-e5cb-44df-a5d6-2fd2e6b6647d';
const TEST_JOB_ID = 'a764c040-912f-4b5f-8cd6-d5b5a7781a3c';

async function apiRequest(endpoint) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`
    }
  });
  return response.json();
}

async function runVerificationTests() {
  console.log('🔍 Running Box-to-Customer Mapping Verification Tests...\n');

  try {
    // Test 1: Verify specific known mappings from original CSV order
    console.log('Test 1: Verifying known customer-to-box mappings...');
    
    const boxRequirements = await apiRequest(`/api/jobs/${TEST_JOB_ID}/box-requirements`);
    const requirements = boxRequirements.boxRequirements;
    
    // Create a mapping of customer to box based on box requirements
    const customerToBoxMap = new Map();
    requirements.forEach(req => {
      if (!customerToBoxMap.has(req.customerName)) {
        customerToBoxMap.set(req.customerName, req.boxNumber);
      }
    });
    
    // Known mappings from original CSV order (based on first appearance)
    const expectedMappings = [
      { customer: '1152689', expectedBox: 1 },
      { customer: '1153606', expectedBox: 2 },
      { customer: '1154539', expectedBox: 22 }, // This was the failing case
      { customer: '1154503', expectedBox: 18 },
      { customer: '1155737', expectedBox: 75 }  // Last customer
    ];
    
    let test1Passed = true;
    expectedMappings.forEach(({ customer, expectedBox }) => {
      const actualBox = customerToBoxMap.get(customer);
      if (actualBox === expectedBox) {
        console.log(`✅ Customer ${customer} → Box ${actualBox} (correct)`);
      } else {
        console.log(`❌ Customer ${customer} → Box ${actualBox}, expected Box ${expectedBox}`);
        test1Passed = false;
      }
    });
    
    console.log(`Test 1 Result: ${test1Passed ? 'PASSED' : 'FAILED'}\n`);

    // Test 2: Verify no customer is assigned to multiple boxes
    console.log('Test 2: Verifying each customer has only one box...');
    
    const customerBoxCounts = new Map();
    requirements.forEach(req => {
      const boxes = customerBoxCounts.get(req.customerName) || new Set();
      boxes.add(req.boxNumber);
      customerBoxCounts.set(req.customerName, boxes);
    });
    
    let test2Passed = true;
    customerBoxCounts.forEach((boxes, customer) => {
      if (boxes.size > 1) {
        console.log(`❌ Customer ${customer} assigned to multiple boxes: ${Array.from(boxes).join(', ')}`);
        test2Passed = false;
      }
    });
    
    if (test2Passed) {
      console.log(`✅ All ${customerBoxCounts.size} customers have exactly one box assignment`);
    }
    console.log(`Test 2 Result: ${test2Passed ? 'PASSED' : 'FAILED'}\n`);

    // Test 3: Verify no box has multiple customers
    console.log('Test 3: Verifying each box has only one customer...');
    
    const boxCustomerCounts = new Map();
    requirements.forEach(req => {
      const customers = boxCustomerCounts.get(req.boxNumber) || new Set();
      customers.add(req.customerName);
      boxCustomerCounts.set(req.boxNumber, customers);
    });
    
    let test3Passed = true;
    boxCustomerCounts.forEach((customers, box) => {
      if (customers.size > 1) {
        console.log(`❌ Box ${box} assigned to multiple customers: ${Array.from(customers).join(', ')}`);
        test3Passed = false;
      }
    });
    
    if (test3Passed) {
      console.log(`✅ All ${boxCustomerCounts.size} boxes have exactly one customer assignment`);
    }
    console.log(`Test 3 Result: ${test3Passed ? 'PASSED' : 'FAILED'}\n`);

    // Test 4: Verify box requirements match products table
    console.log('Test 4: Verifying box requirements data matches source products...');
    
    const job = await apiRequest(`/api/jobs/${TEST_JOB_ID}`);
    const products = job.products;
    
    // Create mapping from products table
    const productCustomerToBox = new Map();
    products.forEach(product => {
      if (!productCustomerToBox.has(product.customerName)) {
        productCustomerToBox.set(product.customerName, product.boxNumber);
      }
    });
    
    let test4Passed = true;
    productCustomerToBox.forEach((expectedBox, customer) => {
      const actualBox = customerToBoxMap.get(customer);
      if (actualBox !== expectedBox) {
        console.log(`❌ Data mismatch for customer ${customer}: products table says box ${expectedBox}, box_requirements says box ${actualBox}`);
        test4Passed = false;
      }
    });
    
    if (test4Passed) {
      console.log(`✅ All customer-to-box mappings match between products and box_requirements tables`);
    }
    console.log(`Test 4 Result: ${test4Passed ? 'PASSED' : 'FAILED'}\n`);

    // Summary
    const allTestsPassed = test1Passed && test2Passed && test3Passed && test4Passed;
    console.log('='.repeat(60));
    console.log(`VERIFICATION SUMMARY: ${allTestsPassed ? '🎉 ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    console.log('='.repeat(60));
    
    if (allTestsPassed) {
      console.log('✅ Box-to-Customer mapping integrity verified');
      console.log('✅ POC logic maintained: customers assigned by CSV first appearance order');
      console.log('✅ Data consistency between products and box_requirements tables confirmed');
    }
    
    return allTestsPassed;
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    return false;
  }
}

// Run the tests
runVerificationTests().then(success => {
  process.exit(success ? 0 : 1);
});