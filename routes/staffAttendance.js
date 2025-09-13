const express = require('express')
const staffAttendance = require('../models/staffAttendance.js')
const Teacher = require('../models/teacher.js');

const router = express.Router();

router.get('/staff-form', (req, res) => {
    try {
        const message = req.query.message || null;
        res.status(200).render('attendance-staff-form', { msg: null, message: message })
    } catch (error) {
        res.send("Internal server Error")
    }
})

router.post('/staff-form', async (req, res) => {

    const { date, jobTitle } = req.body;
    try {
        const exist = await staffAttendance.findOne({ date, jobTitle: jobTitle.toLowerCase(), sName: req.user.sName });
        console.log(exist, 'exist')
        if (!exist) {
            const staff = await Teacher.find({ jobTitle: jobTitle.toLowerCase(), sName: req.user.sName })
            if (staff && staff.length > 0) {
                console.log('staff', staff)
                return res.status(200).render('attendance-staff.ejs', { exist, staff, date, jobTitle: jobTitle.toLowerCase() });
            } else {
                return res.redirect(`/staffAttendance/staff-form?message=No staff found`)

            }
        } else {

            return res.redirect(`/staffAttendance/staff-form?message=You already marked the attendance for ${jobTitle}s of date ${date} `)
            // console.log(exist)
        }
    } catch (error) {
        res.send("internal server error")
    }

})

router.post('/staff/mark', async (req, res) => {
    console.log(req.body)
    const { date, jobTitle, records } = req.body
    try {
        const att = await staffAttendance.create({
            date: date,
            jobTitle: jobTitle,
            sName: req.user.sName,
            records: records
        })
        console.log(att, 'att')
        return res.redirect(`/staffAttendance/staff-form?message=You Successfully marked the attendance for ${jobTitle}s of date ${date} `)
    } catch (error) {
        if (error.code === 11000) {
            return res.redirect(`/staffAttendance/staff-form?message=You already marked the attendance for this`)
        }
        console.log(error)
        res.send("Internal Server Error")
    }
})



router.get('/delete', (req, res) => {
    try {
        res.render('delete-staffAttendance.ejs')
    } catch (error) {
        res.send("Internal server error")
    }
}).post('/delete', async (req, res) => {
    const { jobTitle } = req.body
    try {
        await staffAttendance.deleteMany({ jobTitle: jobTitle.toLowerCase(), sName: req.user.sName })
        return res.redirect(`/staffAttendance/staff-form?message=Deleted Successfully`)
    } catch (error) {
        res.send("internal server error")
    }
})

router.get('/getData-form', (req, res) => {
    try {
        return res.status(200).render('staffAttendanceData-form.ejs')
    } catch (error) {
        res.send("Internal server error")
    }
})

router.post('/getStaffAttendanceData', async (req, res) => {
    const { startDate, endDate, jobTitle } = req.body;
    try {

        const date = {
            $gte: startDate,
            $lte: endDate,
        }
        const attendance = await staffAttendance.find({ date, jobTitle:jobTitle.toLowerCase(), sName: req.user.sName });
        // console.log('attendances',attendance)
        if (attendance.length <= 0) {
            res.redirect(`/staffAttendance/staff-form?message=No attendance found for ${jobTitle} from date ${startDate} to ${endDate} `)
        } else {
            console.log(attendance)

            const dates = [...new Set(attendance.map(att => att.date.toISOString().split('T')[0]))]


            let staffIds = new Set();
            // console.log(staffIds)
            attendance.forEach(a => {
                a.records.forEach(rec => {
                    staffIds.add(rec.staffId.toString())
                    // console.log(staffIds)
                })
            })
            // console.log(staffIds,"just after foreach")
            // staffIds = [...staffIds]
            staffIds = Array.from(staffIds)
            // console.log(staffIds,"staffIds")

            const staffNames = await Teacher.find({ _id: { $in: staffIds }, sName:req.user.sName })
            // console.log(staffNames, "staffNames")
            const staffMap = new Map();
            staffNames.forEach(sn => {
                staffMap[sn._id] = sn.teacherName
            })
            console.log(staffMap)

            const tableData = staffIds.map(id => {
                let row = { id, staffName: staffMap[id], attendance: {} };
                dates.forEach(date => {
                    row.attendance[date] = "N/A"
                })
                return row
            });



            attendance.forEach((a) => {
                let date = a.date.toISOString().split('T')[0];
                a.records.forEach(rec => {
                    let staff = tableData.find(d => d.id === rec.staffId.toString())
                    console.log(staff)
                    if (staff) {
                        staff.attendance[date] = rec.status;
                    }
                })
            })


            return res.status(200).render('staffAttendanceData.ejs', {
                tableData,
                dates,
                startDate,
                endDate,
                jobTitle,
            })

        }

    } catch (error) {
        return res.send("internal server error")
    }
})

router.post('/edit', async (req, res) => {
    const { date, jobTitle } = req.body
    try {

        const attendance = await staffAttendance.find({ date, jobTitle: jobTitle.toLowerCase(), sName: req.user.sName })

        if (attendance && attendance.length > 0) {
            //  console.log(attendance)
            const staffIds = attendance[0].records.map(id => id.staffId)
            //  console.log(staffIds)

            const staffNames = await Teacher.find({ _id: { $in: staffIds } })
            //  console.log(staffNames)

            const orderedStaffs = staffIds.map(id => staffNames.find(s => s._id.toString() === id.toString()))
            console.log(orderedStaffs)

            return res.status(200).render('edit-staffAttendance.ejs', {
                attendance, staffNames: orderedStaffs,
            })



        } else {
            return res.redirect('/staffAttendance/staff-form?message=No Attendance found to edit')
        }


    } catch (error) {
        res.send('Internal server error')
    }
})

router.post("/update/:id", async (req, res) => {
    try {
        await staffAttendance.findByIdAndUpdate(req.params.id, req.body);
        res.redirect("/staffAttendance/staff-form?message=Edit Successfully");
    } catch (err) {
        console.error(err);
        res.redirect("/staffAttendance/staff-form");
    }
});



///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Salary Stuff Calculation

router.get('/salaryGenerator/form', (req, res) => {
    try {
        const message = req.query.message || null
        return res.status(200).render('salary-form.ejs', { message: message })
    } catch (error) {
        res.send("Internal server error")
    }
})

router.post('/salaryGenerator/form', async (req, res) => {
    const { startDate, endDate, jobTitle, email } = req.body;
    try {

        

        const staff = await Teacher.findOne({ jobTitle: jobTitle.toLowerCase(), teacherEmail: email, sName: req.user.sName })
        console.log(staff)
        if (!staff) {
            res.redirect('/staffAttendance/salaryGenerator/form?message=No staff found with these credentials')
        } else {
            const staffId = staff._id.toString();

            const attendance = await staffAttendance.find({
                date: { $gte: new Date(startDate), $lte: new Date(endDate) },
                jobTitle: jobTitle.toLowerCase(),
                sName: req.user.sName
            })      

            if (!attendance || attendance.length < 1) {
                res.redirect('/staffAttendance/salaryGenerator/form?message=No attendance data found for that period of time')
            } else {
                let attendanceObject = {}
                attendance.forEach((a) => {
                    a.records.forEach(rec => {
                        if (rec.staffId.toString() === staffId) {
                            const dateKey = a.date.toISOString().split('T')[0];
                            attendanceObject[dateKey] = rec.status
                        } else {
                        }
                    })
                })

                let totalDays = 0;
                let presentDays = 0;
                let absentDays = 0;
                let leaveDays = 0;

                for (const key in attendanceObject) {
                    if (attendanceObject[key] === "Present") {
                        presentDays++
                    } else if (attendanceObject[key] === "Absent") {
                        absentDays++
                    } else if (attendanceObject[key] === "N/A") {
                        leaveDays++
                    } else {
                    }
                    totalDays++
                }
                console.log(totalDays, 'total')
                console.log(presentDays, 'present')
                console.log(leaveDays, 'leave')
                console.log(absentDays, "absent")

                const staffSalary = parseFloat(staff.teacherSalary)
                //    console.log(staffSalary)
                const perDaySalary = (staffSalary / totalDays)
                console.log(perDaySalary);
                const deductionForAbsent = absentDays * 500;
                const netSalary = (perDaySalary * presentDays) 


                res.render("salaryReport", {
                    staff: {
                        name: staff.teacherName,
                        jobTitle: staff.jobTitle,
                        email: staff.teacherEmail
                    },
                    startDate,
                    endDate,
                    summary: {
                        totalDays,
                        presentDays,
                        absentDays,
                        leaveDays
                    },
                    salary: {
                        perDay: perDaySalary,
                        total: netSalary,
                        deduction: deductionForAbsent
                    }
                });
            }
        }


    } catch (error) {
res.status(500).send("Internal Server Error");    }
})


module.exports = router;

