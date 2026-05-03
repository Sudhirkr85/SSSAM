
// Simple test to verify course field works
const test = async () => {
  const response = await fetch('http://localhost:5000/api/enquiries', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Test User',
      mobile: '9876543210',
      course: 'Test Course'
    })
  });
  
  const result = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', result);
  
  if (result.errors && result.errors.find(e => e.field === 'courseInterested')) {
    console.log('❌ ISSUE: Still getting courseInterested error');
  } else {
    console.log('✅ SUCCESS: Course field works correctly');
  }
};

test();
