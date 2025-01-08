const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { parse } = require('csv-parse');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Trust proxy for Cloudflare
app.set('trust proxy', true);

// HTTPS redirection middleware
app.use((req, res, next) => {
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    next();
  } else {
    res.redirect(`https://${req.headers.host}${req.url}`);
  }
});

app.use(cors());
app.use(express.json());

// Serve static files from React build
app.use(express.static(path.join(__dirname, 'dist')));

function parseTime(timeStr) {
    // Ensure the time string is in HH:mm format
    const [hours, minutes] = timeStr.split(':').map(Number);
    return {
        hours: hours || 0,
        minutes: minutes || 0
    };
}

function calculateTimeDifference(time1, time2) {
    const t1 = parseTime(time1);
    const t2 = parseTime(time2);
    return (t2.hours * 60 + t2.minutes) - (t1.hours * 60 + t1.minutes);
}

function formatTimeString(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function calculateAverageTime(times) {
    if (times.length === 0) return null;
    const totalMinutes = times.reduce((sum, time) => {
        const { hours, minutes } = parseTime(time);
        return sum + (hours * 60 + minutes);
    }, 0);
    return formatTimeString(totalMinutes / times.length);
}

function isOutlier(value, mean, stdDev) {
    const zScore = Math.abs((value - mean) / stdDev);
    return zScore > 2;
}

app.post('/api/analyze', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const results = [];
    fs.createReadStream(req.file.path)
        .pipe(parse({ 
            delimiter: ',', 
            columns: true, 
            skip_empty_lines: true,
            trim: true
        }))
        .on('data', (data) => results.push(data))
        .on('end', () => {
            // Group by employee
            const employeeData = {};
            const allDates = new Set();

            results.forEach(record => {
                if (!employeeData[record['Sicil No']]) {
                    employeeData[record['Sicil No']] = {
                        name: record['Personel Adı Soyadı'],
                        records: []
                    };
                }
                employeeData[record['Sicil No']].records.push({
                    date: record['Tarih'],
                    time: record['Saat'],
                    type: record['Durum'] // G for entry, C for exit
                });
                allDates.add(record['Tarih']);
            });

            // Calculate statistics for each employee
            const statistics = {};
            let companyTotalWorkMinutes = 0;
            let companyTotalBreakMinutes = 0;
            let employeeCount = 0;
            const totalDays = allDates.size;
            const companyFirstEntryTimes = [];
            const companyLastExitTimes = [];

            for (const [sicilNo, data] of Object.entries(employeeData)) {
                const dailyStats = {};
                const firstEntryTimes = [];
                const lastExitTimes = [];
                
                // Group records by date
                data.records.forEach(record => {
                    if (!dailyStats[record.date]) {
                        dailyStats[record.date] = [];
                    }
                    dailyStats[record.date].push({
                        time: record.time,
                        type: record.type
                    });
                });

                let totalWorkMinutes = 0;
                let totalBreakMinutes = 0;
                let daysCount = 0;
                const workTimes = [];
                const breakTimes = [];

                // Calculate daily statistics
                for (const [date, records] of Object.entries(dailyStats)) {
                    records.sort((a, b) => {
                        const timeA = parseTime(a.time);
                        const timeB = parseTime(b.time);
                        return (timeA.hours * 60 + timeA.minutes) - (timeB.hours * 60 + timeB.minutes);
                    });

                    // Get first entry and last exit
                    const firstEntry = records.find(r => r.type === 'G');
                    const lastExit = [...records].reverse().find(r => r.type === 'C');
                    
                    if (firstEntry) {
                        firstEntryTimes.push(firstEntry.time);
                        companyFirstEntryTimes.push(firstEntry.time);
                    }
                    if (lastExit) {
                        lastExitTimes.push(lastExit.time);
                        companyLastExitTimes.push(lastExit.time);
                    }

                    let dailyWorkMinutes = 0;
                    let dailyBreakMinutes = 0;

                    for (let i = 0; i < records.length - 1; i++) {
                        if (records[i].type === 'G' && records[i + 1].type === 'C') {
                            const workTime = calculateTimeDifference(records[i].time, records[i + 1].time);
                            if (workTime > 0) dailyWorkMinutes += workTime;
                        } else if (records[i].type === 'C' && records[i + 1].type === 'G') {
                            const breakTime = calculateTimeDifference(records[i].time, records[i + 1].time);
                            if (breakTime > 0) dailyBreakMinutes += breakTime;
                        }
                    }

                    if (dailyWorkMinutes > 0) {
                        workTimes.push(dailyWorkMinutes);
                        breakTimes.push(dailyBreakMinutes);
                        totalWorkMinutes += dailyWorkMinutes;
                        totalBreakMinutes += dailyBreakMinutes;
                        daysCount++;
                    }
                }

                // Calculate averages and outliers
                const avgWorkMinutes = totalWorkMinutes / daysCount;
                const avgBreakMinutes = totalBreakMinutes / daysCount;
                const avgFirstEntry = calculateAverageTime(firstEntryTimes);
                const avgLastExit = calculateAverageTime(lastExitTimes);

                // Calculate standard deviations
                const workStdDev = Math.sqrt(
                    workTimes.reduce((acc, val) => acc + Math.pow(val - avgWorkMinutes, 2), 0) / daysCount
                );
                const breakStdDev = Math.sqrt(
                    breakTimes.reduce((acc, val) => acc + Math.pow(val - avgBreakMinutes, 2), 0) / daysCount
                );

                // Find outliers
                const outliers = [];
                Object.entries(dailyStats).forEach(([date, records]) => {
                    let dailyWorkMinutes = 0;
                    let dailyBreakMinutes = 0;

                    for (let i = 0; i < records.length - 1; i++) {
                        if (records[i].type === 'G' && records[i + 1].type === 'C') {
                            const workTime = calculateTimeDifference(records[i].time, records[i + 1].time);
                            if (workTime > 0) dailyWorkMinutes += workTime;
                        } else if (records[i].type === 'C' && records[i + 1].type === 'G') {
                            const breakTime = calculateTimeDifference(records[i].time, records[i + 1].time);
                            if (breakTime > 0) dailyBreakMinutes += breakTime;
                        }
                    }

                    if (isOutlier(dailyWorkMinutes, avgWorkMinutes, workStdDev) ||
                        isOutlier(dailyBreakMinutes, avgBreakMinutes, breakStdDev)) {
                        outliers.push({
                            date,
                            workMinutes: dailyWorkMinutes,
                            breakMinutes: dailyBreakMinutes
                        });
                    }
                });

                statistics[sicilNo] = {
                    name: data.name,
                    averageWorkMinutes: avgWorkMinutes,
                    averageBreakMinutes: avgBreakMinutes,
                    totalWorkMinutes: totalWorkMinutes,
                    totalBreakMinutes: totalBreakMinutes,
                    daysWorked: daysCount,
                    averageFirstEntry: avgFirstEntry,
                    averageLastExit: avgLastExit,
                    outliers
                };

                companyTotalWorkMinutes += totalWorkMinutes;
                companyTotalBreakMinutes += totalBreakMinutes;
                employeeCount++;
            }

            // Calculate company averages
            const companyStats = {
                averageWorkMinutesPerDay: companyTotalWorkMinutes / (employeeCount * totalDays),
                averageBreakMinutesPerDay: companyTotalBreakMinutes / (employeeCount * totalDays),
                totalWorkMinutes: companyTotalWorkMinutes,
                totalBreakMinutes: companyTotalBreakMinutes,
                averageFirstEntry: calculateAverageTime(companyFirstEntryTimes),
                averageLastExit: calculateAverageTime(companyLastExitTimes)
            };

            // Clean up uploaded file
            fs.unlinkSync(req.file.path);

            res.json({
                employeeStats: statistics,
                companyStats
            });
        });
});

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 