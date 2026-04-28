// API Base URL
const API_URL = 'http://localhost:5000/api';

// Chart instances
let sourcesChart, courseChart, paymentModeChart, counselorChart;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    // Set default dates (current month)
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    document.getElementById('startDate').value = formatDate(firstDay);
    document.getElementById('endDate').value = formatDate(today);
    
    loadReports();
});

// Format date for input
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// Get auth token from localStorage
function getAuthToken() {
    return localStorage.getItem('token') || '';
}

// Fetch with auth header
async function fetchWithAuth(url) {
    const token = getAuthToken();
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
}

// Load all reports
async function loadReports() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    console.log('Loading reports for:', startDate, 'to', endDate);
    
    try {
        // Fetch all reports in parallel
        const [admissionsData, feesData, courseData, counselorData] = await Promise.all([
            fetchWithAuth(`${API_URL}/reports/admissions?startDate=${startDate}&endDate=${endDate}`),
            fetchWithAuth(`${API_URL}/reports/fees?startDate=${startDate}&endDate=${endDate}`),
            fetchWithAuth(`${API_URL}/reports/course-performance?startDate=${startDate}&endDate=${endDate}`),
            fetchWithAuth(`${API_URL}/reports/counselor-performance?startDate=${startDate}&endDate=${endDate}`)
        ]);
        
        console.log('Admissions data:', admissionsData);
        console.log('Fees data:', feesData);
        console.log('Course data:', courseData);
        console.log('Counselor data:', counselorData);
        
        // Check if data exists before rendering
        if (admissionsData && admissionsData.data) {
            updateSummaryCards(admissionsData.data, feesData?.data || {});
            renderSourcesChart(admissionsData.data.sourceStats || []);
        }
        
        if (courseData && courseData.data && courseData.data.courseStats) {
            renderCourseChart(courseData.data.courseStats);
        }
        
        if (feesData && feesData.data) {
            renderPaymentModeChart(feesData.data.periodPayments || []);
            renderPaymentsTable(feesData.data.periodPayments || []);
        }
        
        if (counselorData && counselorData.data && counselorData.data.counselorStats) {
            renderCounselorChart(counselorData.data.counselorStats);
        }
        
    } catch (error) {
        console.error('Error loading reports:', error);
        alert('Error loading reports. Please check console (F12) for details. Make sure you are logged in.');
    }
}

// Update summary cards
function updateSummaryCards(admissions, fees) {
    document.getElementById('totalAdmissions').textContent = 
        admissions.summary?.totalAdmissions || 0;
    
    document.getElementById('totalRevenue').textContent = 
        '₹' + (fees.summary?.revenueInPeriod || 0).toLocaleString();
    
    document.getElementById('conversionRate').textContent = 
        (admissions.summary?.conversionRate || 0) + '%';
    
    document.getElementById('pendingFees').textContent = 
        '₹' + (fees.summary?.totalPending || 0).toLocaleString();
}

// Render Admission Sources Pie Chart
function renderSourcesChart(sourceStats) {
    const ctx = document.getElementById('sourcesChart').getContext('2d');
    
    if (sourcesChart) sourcesChart.destroy();
    
    // Filter out sources with 0 enquiries
    const filtered = sourceStats.filter(s => s.enquiries > 0);
    
    if (filtered.length === 0) {
        ctx.font = '16px Arial';
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        ctx.fillText('No data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    
    const labels = filtered.map(s => s.source || 'Not Specified');
    const data = filtered.map(s => s.enquiries);
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
    
    sourcesChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Render Course Distribution Pie Chart
function renderCourseChart(courseStats) {
    const ctx = document.getElementById('courseChart').getContext('2d');
    
    if (courseChart) courseChart.destroy();
    
    // Filter out courses with 0 enquiries and sort by total enquiries
    const filtered = courseStats.filter(c => c.totalEnquiries > 0);
    const sorted = filtered.sort((a, b) => b.totalEnquiries - a.totalEnquiries).slice(0, 5);
    
    if (sorted.length === 0) {
        // No data message
        ctx.font = '16px Arial';
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        ctx.fillText('No data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    
    const labels = sorted.map(c => c.course);
    const data = sorted.map(c => c.totalEnquiries);
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'];
    
    courseChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '50%',
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Render Payment Modes Pie Chart
function renderPaymentModeChart(payments) {
    const ctx = document.getElementById('paymentModeChart').getContext('2d');
    
    if (paymentModeChart) paymentModeChart.destroy();
    
    // Count payment modes
    const modeCounts = {};
    payments.forEach(p => {
        const mode = p.paymentMode || 'Unknown';
        modeCounts[mode] = (modeCounts[mode] || 0) + 1;
    });
    
    const labels = Object.keys(modeCounts);
    const data = Object.values(modeCounts);
    
    if (labels.length === 0) {
        ctx.font = '16px Arial';
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        ctx.fillText('No data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    
    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336'];
    
    paymentModeChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Render Counselor Performance Bar Chart
function renderCounselorChart(counselorStats) {
    const ctx = document.getElementById('counselorChart').getContext('2d');
    
    if (counselorChart) counselorChart.destroy();
    
    if (!counselorStats || counselorStats.length === 0) {
        ctx.font = '16px Arial';
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        ctx.fillText('No data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    
    const labels = counselorStats.map(c => c.counselorName);
    const admissions = counselorStats.map(c => c.period?.admissions || c.total?.admissions || 0);
    const revenue = counselorStats.map(c => c.period?.revenue || c.total?.revenue || 0);
    
    counselorChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Admissions',
                    data: admissions,
                    backgroundColor: '#36A2EB',
                    yAxisID: 'y'
                },
                {
                    label: 'Revenue (₹)',
                    data: revenue,
                    backgroundColor: '#4CAF50',
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Admissions'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Revenue (₹)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

// Render Payments Table
function renderPaymentsTable(payments) {
    const tbody = document.querySelector('#paymentsTable tbody');
    tbody.innerHTML = '';
    
    // Show only first 10 payments
    payments.slice(0, 10).forEach(payment => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${payment.studentName || 'N/A'}</td>
            <td>₹${payment.amount?.toLocaleString() || 0}</td>
            <td>${payment.paymentMode || 'N/A'}</td>
            <td>${new Date(payment.paymentDate).toLocaleDateString()}</td>
        `;
        tbody.appendChild(row);
    });
}
