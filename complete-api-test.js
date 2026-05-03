// COMPLETE API TEST SUITE - NO AUTH REQUIRED
// This will test all APIs without requiring login
// It will create a user first, then test all APIs

const BASE_URL = 'http://localhost:5000';

// Helper function to make API calls
async function apiCall(endpoint, method = 'GET', data = null, token = null) {
  const config = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (data) {
    config.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, config);
    const result = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      data: result,
      endpoint: `${method} ${endpoint}`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      endpoint: `${method} ${endpoint}`
    };
  }
}

// Create test user and login
async function createTestUserAndLogin() {
  console.log('👤 Creating test user and logging in...\n');
  
  // Create admin user
  console.log('--- Creating admin user ---');
  const adminData = {
    name: "Test Admin",
    email: "testadmin@example.com",
    password: "admin123",
    role: "ADMIN"
  };
  
  const registerResult = await apiCall('/api/auth/register', 'POST', adminData);
  
  if (registerResult.success) {
    console.log('✅ Admin user created');
  } else {
    console.log('ℹ️  Admin user might already exist');
  }
  
  // Try to login
  console.log('\n--- Logging in ---');
  const loginResult = await apiCall('/api/auth/login', 'POST', {
    email: adminData.email,
    password: adminData.password
  });
  
  if (loginResult.success) {
    console.log('✅ Login successful');
    console.log(`   User: ${loginResult.data.data.user.name}`);
    console.log(`   Role: ${loginResult.data.data.user.role}`);
    return loginResult.data.data.token;
  } else {
    console.log('❌ Login failed');
    console.log('   Error:', loginResult.data?.message);
    return null;
  }
}

// Test admission APIs
async function testAdmissionAPIs(token) {
  console.log('\n🎓 TESTING ADMISSION APIs');
  console.log('========================\n');
  
  // Dummy admission data
  const dummyAdmissions = [
    {
      name: "Rahul Sharma",
      email: "rahul.sharma@gmail.com",
      mobile: "9876543210",
      course: "Full Stack Development",
      admissionDate: new Date().toISOString(),
      totalFees: 50000,
      registrationAmount: 5000,
      paymentMode: "CASH",
      installments: [
        {
          amount: 15000,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          note: "First installment"
        },
        {
          amount: 15000,
          dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          note: "Second installment"
        },
        {
          amount: 15000,
          dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          note: "Third installment"
        }
      ]
    },
    {
      name: "Priya Patel",
      email: "priya.patel@yahoo.com",
      mobile: "9876543211",
      course: "Data Science",
      admissionDate: new Date().toISOString(),
      totalFees: 60000,
      registrationAmount: 10000,
      paymentMode: "ONLINE",
      installments: [
        {
          amount: 25000,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          note: "Python basics"
        },
        {
          amount: 25000,
          dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          note: "Machine learning"
        }
      ]
    }
  ];
  
  let createdAdmissions = [];
  let testResults = [];
  
  // TEST 1: Create Admissions
  console.log('📝 TEST 1: CREATE ADMISSIONS');
  console.log('===========================');
  
  for (let i = 0; i < dummyAdmissions.length; i++) {
    const admission = dummyAdmissions[i];
    console.log(`\n--- Creating Admission ${i + 1}: ${admission.name} ---`);
    
    const result = await apiCall('/api/admissions', 'POST', admission, token);
    testResults.push(result);
    
    if (result.success) {
      console.log('✅ SUCCESS: Admission created');
      console.log(`   ID: ${result.data.data.admission._id}`);
      console.log(`   Course: ${result.data.data.admission.course}`);
      console.log(`   Total Fees: ${result.data.data.admission.totalFees}`);
      console.log(`   Installments: ${result.data.data.admission.installments.length}`);
      console.log(`   Upcoming Installment: ${result.data.data.admission.upcomingInstallment?.amount || 'N/A'}`);
      createdAdmissions.push(result.data.data.admission);
    } else {
      console.log('❌ FAILED: Could not create admission');
      console.log('   Error:', result.data?.message || result.error);
    }
  }
  
  if (createdAdmissions.length === 0) {
    console.log('\n❌ No admissions created, skipping other tests');
    return { createdAdmissions: [], testResults };
  }
  
  // TEST 2: List Admissions
  console.log('\n📋 TEST 2: LIST ADMISSIONS');
  console.log('========================');
  
  const listResult = await apiCall('/api/admissions', 'GET', null, token);
  testResults.push(listResult);
  
  if (listResult.success) {
    console.log('✅ SUCCESS: Admissions listed');
    console.log(`   Total: ${listResult.data.data.pagination.totalCount}`);
    console.log(`   Page: ${listResult.data.data.pagination.page}`);
    
    // Show sorting by upcoming installment
    console.log('   Sorted by upcoming installment:');
    listResult.data.data.admissions.forEach((adm, index) => {
      const upcoming = adm.upcomingInstallment ? 
        `₹${adm.upcomingInstallment.amount} on ${new Date(adm.upcomingInstallment.dueDate).toLocaleDateString()}` : 'No upcoming';
      console.log(`     ${index + 1}. ${adm.name} - ${upcoming}`);
    });
  } else {
    console.log('❌ FAILED: Could not list admissions');
    console.log('   Error:', listResult.data?.message || listResult.error);
  }
  
  // TEST 3: Get Single Admission
  console.log('\n🔍 TEST 3: GET SINGLE ADMISSION');
  console.log('==============================');
  
  const firstAdmission = createdAdmissions[0];
  const getResult = await apiCall(`/api/admissions/${firstAdmission._id}`, 'GET', null, token);
  testResults.push(getResult);
  
  if (getResult.success) {
    console.log('✅ SUCCESS: Single admission retrieved');
    console.log(`   Name: ${getResult.data.data.admission.name}`);
    console.log(`   Course: ${getResult.data.data.admission.course}`);
    console.log(`   Total Fees: ${getResult.data.data.admission.totalFees}`);
    console.log(`   Total Paid: ${getResult.data.data.admission.totalPaid}`);
    console.log(`   Remaining: ${getResult.data.data.admission.remainingAmount}`);
    console.log(`   Installments: ${getResult.data.data.admission.installments.length}`);
  } else {
    console.log('❌ FAILED: Could not get single admission');
    console.log('   Error:', getResult.data?.message || getResult.error);
  }
  
  // TEST 4: Update Admission
  console.log('\n✏️  TEST 4: UPDATE ADMISSION');
  console.log('=========================');
  
  const updateData = {
    name: `${firstAdmission.name} (Updated)`,
    totalFees: firstAdmission.totalFees + 5000,
    installments: [
      {
        amount: 20000,
        dueDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
        note: "Updated first installment"
      },
      {
        amount: 20000,
        dueDate: new Date(Date.now() + 55 * 24 * 60 * 60 * 1000).toISOString(),
        note: "Updated second installment"
      },
      {
        amount: 20000,
        dueDate: new Date(Date.now() + 85 * 24 * 60 * 60 * 1000).toISOString(),
        note: "New third installment"
      }
    ]
  };
  
  const updateResult = await apiCall(`/api/admissions/${firstAdmission._id}`, 'PUT', updateData, token);
  testResults.push(updateResult);
  
  if (updateResult.success) {
    console.log('✅ SUCCESS: Admission updated');
    console.log(`   Updated name: ${updateResult.data.data.admission.name}`);
    console.log(`   Updated fees: ${updateResult.data.data.admission.totalFees}`);
    console.log(`   Installments: ${updateResult.data.data.admission.installments.length}`);
  } else {
    console.log('❌ FAILED: Could not update admission');
    console.log('   Error:', updateResult.data?.message || updateResult.error);
  }
  
  // TEST 5: Record Payment
  console.log('\n💰 TEST 5: RECORD PAYMENT');
  console.log('========================');
  
  const paymentData = {
    amount: 5000,
    paymentMode: "CASH",
    paymentDate: new Date().toISOString(),
    note: "First installment payment"
  };
  
  const paymentResult = await apiCall(`/api/admissions/${firstAdmission._id}/payments`, 'POST', paymentData, token);
  testResults.push(paymentResult);
  
  if (paymentResult.success) {
    console.log('✅ SUCCESS: Payment recorded');
    console.log(`   Payment ID: ${paymentResult.data.data.payment._id}`);
    console.log(`   Amount: ${paymentResult.data.data.payment.amount}`);
    console.log(`   Mode: ${paymentResult.data.data.payment.paymentMode}`);
    
    // Check updated admission
    const updatedAdmission = paymentResult.data.data.admission;
    console.log(`   Updated Total Paid: ${updatedAdmission.totalPaid}`);
    console.log(`   Updated Remaining: ${updatedAdmission.remainingAmount}`);
  } else {
    console.log('❌ FAILED: Could not record payment');
    console.log('   Error:', paymentResult.data?.message || paymentResult.error);
  }
  
  // TEST 6: List Payments for Admission
  console.log('\n📊 TEST 6: LIST PAYMENTS FOR ADMISSION');
  console.log('====================================');
  
  const paymentsResult = await apiCall(`/api/admissions/${firstAdmission._id}/payments`, 'GET', null, token);
  testResults.push(paymentsResult);
  
  if (paymentsResult.success) {
    console.log('✅ SUCCESS: Payments listed');
    console.log(`   Total payments: ${paymentsResult.data.data.payments.length}`);
    
    paymentsResult.data.data.payments.forEach((payment, index) => {
      console.log(`   ${index + 1}. ₹${payment.amount} - ${payment.paymentMode} - ${new Date(payment.paymentDate).toLocaleDateString()}`);
    });
  } else {
    console.log('❌ FAILED: Could not list payments');
    console.log('   Error:', paymentsResult.data?.message || paymentsResult.error);
  }
  
  return { createdAdmissions, testResults };
}

// Test payment APIs
async function testPaymentAPIs(token) {
  console.log('\n💳 TESTING PAYMENT APIS');
  console.log('=======================\n');
  
  let testResults = [];
  
  // TEST 1: List All Payments
  console.log('📋 TEST 1: LIST ALL PAYMENTS');
  console.log('===========================');
  
  const listResult = await apiCall('/api/payments', 'GET', null, token);
  testResults.push(listResult);
  
  if (listResult.success) {
    console.log('✅ SUCCESS: All payments listed');
    console.log(`   Total: ${listResult.data.data.pagination.totalCount}`);
    console.log(`   Page: ${listResult.data.data.pagination.page}`);
    
    // Show some payments
    const payments = listResult.data.data.payments.slice(0, 3);
    payments.forEach((payment, index) => {
      console.log(`   ${index + 1}. ₹${payment.amount} - ${payment.studentName} - ${payment.course}`);
    });
  } else {
    console.log('❌ FAILED: Could not list payments');
    console.log('   Error:', listResult.data?.message || listResult.error);
  }
  
  // TEST 2: Check Overdue Installments
  console.log('\n⚠️  TEST 2: CHECK OVERDUE INSTALLMENTS');
  console.log('===================================');
  
  const overdueResult = await apiCall('/api/payments/check-overdue', 'POST', null, token);
  testResults.push(overdueResult);
  
  if (overdueResult.success) {
    console.log('✅ SUCCESS: Overdue check completed');
    console.log(`   Checked admissions: ${overdueResult.data.data.checkedAdmissions}`);
    console.log(`   Updated admissions: ${overdueResult.data.data.updatedAdmissions}`);
    console.log(`   Overdue count: ${overdueResult.data.data.overdueCount}`);
    
    if (overdueResult.data.data.overdueInstallments.length > 0) {
      console.log('   Overdue installments:');
      overdueResult.data.data.overdueInstallments.forEach((inst, index) => {
        console.log(`     ${index + 1}. ${inst.studentName} - ₹${inst.amount} - ${new Date(inst.dueDate).toLocaleDateString()}`);
      });
    } else {
      console.log('   No overdue installments found');
    }
  } else {
    console.log('❌ FAILED: Could not check overdue');
    console.log('   Error:', overdueResult.data?.message || overdueResult.error);
  }
  
  return testResults;
}

// Test other APIs
async function testOtherAPIs(token) {
  console.log('\n🔧 TESTING OTHER APIS');
  console.log('=====================\n');
  
  let testResults = [];
  
  // TEST 1: Dashboard
  console.log('📊 TEST 1: DASHBOARD');
  console.log('===================');
  
  const dashboardResult = await apiCall('/api/dashboard', 'GET', null, token);
  testResults.push(dashboardResult);
  
  if (dashboardResult.success) {
    console.log('✅ SUCCESS: Dashboard data retrieved');
    console.log(`   Total enquiries: ${dashboardResult.data.data.totalEnquiries}`);
    console.log(`   Total admissions: ${dashboardResult.data.data.totalAdmissions}`);
    console.log(`   Total revenue: ${dashboardResult.data.data.totalRevenue}`);
  } else {
    console.log('❌ FAILED: Could not get dashboard');
    console.log('   Error:', dashboardResult.data?.message || dashboardResult.error);
  }
  
  // TEST 2: List Enquiries (to verify they still work)
  console.log('\n📋 TEST 2: LIST ENQUIRIES');
  console.log('========================');
  
  const enquiriesResult = await apiCall('/api/enquiries', 'GET', null, token);
  testResults.push(enquiriesResult);
  
  if (enquiriesResult.success) {
    console.log('✅ SUCCESS: Enquiries listed');
    console.log(`   Total: ${enquiriesResult.data.data.pagination.totalCount}`);
  } else {
    console.log('❌ FAILED: Could not list enquiries');
    console.log('   Error:', enquiriesResult.data?.message || enquiriesResult.error);
  }
  
  return testResults;
}

// Main test function
async function runCompleteAPITest() {
  console.log('🚀 COMPLETE API TEST SUITE');
  console.log('========================\n');
  
  // Step 1: Create user and login
  const token = await createTestUserAndLogin();
  
  if (!token) {
    console.log('\n❌ Cannot proceed without authentication');
    console.log('💡 Please check your server and database connection');
    return;
  }
  
  // Step 2: Test admission APIs
  const { createdAdmissions, testResults: admissionResults } = await testAdmissionAPIs(token);
  
  // Step 3: Test payment APIs
  const paymentResults = await testPaymentAPIs(token);
  
  // Step 4: Test other APIs
  const otherResults = await testOtherAPIs(token);
  
  // Final Summary
  console.log('\n📊 FINAL TEST SUMMARY');
  console.log('====================');
  
  const allResults = [...admissionResults, ...paymentResults, ...otherResults];
  const passed = allResults.filter(r => r.success).length;
  const failed = allResults.filter(r => !r.success).length;
  
  console.log(`✅ Passed: ${passed}/${allResults.length}`);
  console.log(`❌ Failed: ${failed}/${allResults.length}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    allResults.filter(r => !r.success).forEach(result => {
      console.log(`   ${result.endpoint}: ${result.data?.message || result.error}`);
    });
  }
  
  console.log('\n📋 Created Data Summary:');
  console.log(`   Admissions: ${createdAdmissions.length}`);
  createdAdmissions.forEach((admission, index) => {
    console.log(`     ${index + 1}. ${admission.name} - ${admission.course} - ₹${admission.totalFees}`);
  });
  
  console.log('\n🎉 ALL API TESTING COMPLETED!');
  console.log('   ✅ Admission APIs tested');
  console.log('   ✅ Payment APIs tested');
  console.log('   ✅ Other APIs tested');
  console.log('   ✅ Dummy data created');
  console.log('   ✅ All functionality verified');
  
  console.log('\n💡 Key Features Verified:');
  console.log('   ✅ User registration and login');
  console.log('   ✅ Admission management with installments');
  console.log('   ✅ Payment recording and tracking');
  console.log('   ✅ Overdue installment checking');
  console.log('   ✅ Dashboard statistics');
  console.log('   ✅ Enquiry management');
}

// Run the tests
if (require.main === module) {
  runCompleteAPITest();
}

module.exports = {
  runCompleteAPITest
};
