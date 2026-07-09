const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./middleware');
const { authRoutes, enquiryRoutes, admissionRoutes, paymentRoutes, reportRoutes, bulkUploadRoutes, dashboardRoutes, notificationRoutes, userRoutes, attendanceRoutes, chatRoutes } = require('./routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public folder
app.use(express.static('public'));

// Serve reports page at /reports route
app.get('/reports', (req, res) => {
  res.sendFile('reports.html', { root: './public' });
});

app.use('/api/auth', authRoutes);
app.use('/api/enquiries', enquiryRoutes);
app.use('/api/admissions', admissionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/bulk-upload', bulkUploadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/chat', chatRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

app.use(errorHandler);

module.exports = app;
