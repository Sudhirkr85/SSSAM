const mongoose = require('mongoose');
const { User, Attendance } = require('../models');

const MONGODB_URI = 'mongodb://localhost:27017/institute_crm';

async function seedTestData() {
    try {
        console.log("Connecting to Database...");
        await mongoose.connect(MONGODB_URI);
        console.log("Connected successfully!");

        // Fetch all employees and counselors
        const users = await User.find({ role: { $in: ['employee', 'counselor'] } });
        if (users.length === 0) {
            console.log("No employees/counselors found in DB! Please register some first.");
            process.exit(0);
        }

        console.log(`Found ${users.length} users to generate data for.`);

        const today = new Date();
        const logs = [];

        // We will generate data for the last 3 months: May, June, and July 2026
        const months = [4, 5, 6]; // May (4), June (5), July (6)
        const year = 2026;

        for (const user of users) {
            console.log(`Generating logs for ${user.name} (${user.role})...`);
            
            // Delete existing test logs in those months to avoid duplicate clutter
            const startRange = new Date(year, 4, 1);
            const endRange = new Date(year, 7, 0, 23, 59, 59, 999);
            await Attendance.deleteMany({
                userId: user._id,
                timestamp: { $gte: startRange, $lte: endRange }
            });

            for (const month of months) {
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                
                for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const targetDate = new Date(year, month, day);
                    const dayOfWeek = targetDate.getDay(); // 0: Sunday, 6: Saturday

                    // 1. Mark Sundays as WEEKOFF
                    if (dayOfWeek === 0) {
                        logs.push({
                            userId: user._id,
                            type: 'WEEKOFF',
                            timestamp: new Date(dateStr + 'T12:00:00'),
                            latitude: 28.4595,
                            longitude: 77.0266,
                            distanceFromOffice: 0
                        });
                        continue;
                    }

                    // 2. Add some random LEAVEs (e.g. 5% chance, except Saturdays)
                    if (Math.random() < 0.07 && dayOfWeek !== 6) {
                        logs.push({
                            userId: user._id,
                            type: 'LEAVE',
                            timestamp: new Date(dateStr + 'T12:00:00'),
                            latitude: 28.4595,
                            longitude: 77.0266,
                            distanceFromOffice: 0
                        });
                        continue;
                    }

                    // 3. Mark 15% random days as ABSENT (i.e. no logs)
                    if (Math.random() < 0.15) {
                        // Keep empty (Absent)
                        continue;
                    }

                    // 4. Mark remaining days as PRESENT (Punch IN/OUT)
                    // Random Punch In time between 09:00 AM and 09:45 AM
                    const inHr = 9;
                    const inMin = Math.floor(Math.random() * 45);
                    const punchInTime = new Date(targetDate);
                    punchInTime.setHours(inHr, inMin, 0, 0);

                    // Random Punch Out time between 05:45 PM and 06:30 PM (17/18)
                    const outHr = 17 + Math.floor(Math.random() * 2); // 17 or 18
                    const outMin = Math.floor(Math.random() * 45);
                    const punchOutTime = new Date(targetDate);
                    punchOutTime.setHours(outHr, outMin, 0, 0);

                    logs.push({
                        userId: user._id,
                        type: 'IN',
                        timestamp: punchInTime,
                        latitude: 28.4595,
                        longitude: 77.0266,
                        distanceFromOffice: 0.12
                    });

                    logs.push({
                        userId: user._id,
                        type: 'OUT',
                        timestamp: punchOutTime,
                        latitude: 28.4595,
                        longitude: 77.0266,
                        distanceFromOffice: 0.25
                    });
                }
            }
        }

        if (logs.length > 0) {
            await Attendance.insertMany(logs);
            console.log(`Successfully seeded ${logs.length} attendance, leave, and weekoff records!`);
        }

        mongoose.connection.close();
        console.log("Seeding complete. Connection closed.");
    } catch (e) {
        console.error("Seeding failed:", e);
        process.exit(1);
    }
}

seedTestData();
