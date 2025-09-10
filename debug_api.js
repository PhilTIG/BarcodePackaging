// Quick test to debug the non-scanned API response
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/jobs/9043bf69-c43d-42f2-a17d-c91ebad6504a/non-scanned-report',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('API Response Summary:', response.summary);
      console.log('Total Required:', response.summary?.totalRequired);
      console.log('Individual items count:', response.items?.length);
      if (response.items && response.items.length > 0) {
        console.log('First few items:', response.items.slice(0, 3).map(item => ({
          quantityRequired: item.quantityRequired,
          boxNumber: item.boxNumber,
          productName: item.productName
        })));
      }
    } catch (error) {
      console.error('Error parsing response:', error);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.end();