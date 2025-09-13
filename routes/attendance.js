const express = require('express');
const mongoose = require('mongoose')
const Attendance = require('../models/attendance');
const Student = require('../models/student');

const router = express.Router();

router.get('/selection', (req,res)=>{
  return res.status(200).render('attendance-selection.ejs')
})

router.get('/student-form', (req, res) => {
    const message = req.query.message || null
  return res.render('attendance-student-form.ejs',{
    msg:null,
    message:message,
  });
});

// STEP 2: Handle form submit and redirect
router.post('/student-form', (req, res) => {
  try {
    const { date, className, medium, stream } = req.body;

    // Build query string
    let query = `?date=${encodeURIComponent(date)}&className=${encodeURIComponent(className)}&medium=${encodeURIComponent(medium)}`;
    if (className === '11' || className === '12') {
      query += `&stream=${encodeURIComponent(stream)}`;
    }

    return res.redirect(`/attendance/student${query}`);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
});

// STEP 3: Show students for marking attendance
router.get('/student', async (req, res) => {
  try {
    const { date, className, medium, stream } = req.query;
    console.log(date)

    if (!date || !className || !medium) {
      return res.redirect('/attendance/student-form');
    }

    const query = {date, className, medium, stream, sName:req.user.sName} 
    if((className === '11' || className === '12') && stream){
        query.stream = stream
    }

    const isExist = await Attendance.findOne(query);
    if(!isExist){
        const filter = { studentClass: className, medium, sName: req.user.sName };
        if ((className === '11' || className === '12') && stream) {
          filter.stream = stream;
        }
    
        const students = await Student.find(filter);
        console.log(students)
    
        if (!students || students.length === 0) {
          // return res.send("No students found for this class");
          return res.redirect('/attendance/student-form?message=No students found for this class')
        }
    
       return res.render('attendance-student.ejs', { students, date, className, medium, stream });
       
    }else{
        //  res.send(`You already marked the attendance of ${date} of class ${className}${stream ? stream : ''} ` )
        res.render('attendance-student-form.ejs',{msg:`You already marked the attendance of ${date} of class ${className}${stream ? stream : ''} `, message:null})
    }

    // Fetch students of that class
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
});

// STEP 4: Save attendance
router.post('/student/mark', async (req, res) => {
  try {
    const { date, className, medium, stream, records } = req.body;

    await Attendance.create({
      date,
      className,
      medium,
      stream : stream || null,
      records,
      sName: req.user.sName
    });

    return res.status(200).redirect('/?message=Attendance marked successfully');
  } catch (err) {
    if (err.code === 11000) {
    return res.redirect("/?danger=Attendance already marked for this class and date!");
  }
  throw err;
  }
});

router.post('/edit', async (req, res) => {
  const { date, className, medium, stream } = req.body;

  try {
    const query = { date, className, medium, sName: req.user.sName };

    if ((className === '11' || className === '12') && stream) {
      query.stream = stream;
    }

    const attendance = await Attendance.find(query);
    // console.log('attendance',attendance[0].records)

    if (attendance && attendance.length > 0) {
      const studentIds = attendance[0].records.map(r => r.studentId);

      const studentNames = await Student.find({ _id: { $in: studentIds } });
      console.log(studentNames)

      const orderedStudents = studentIds.map(
        id => studentNames.find(s => s._id.toString() === id.toString())
      );

      return res.render('edit-attendance.ejs', { attendance, studentNames: orderedStudents });
    }else{
      return res.redirect("/attendance/student-form?message=No attendance data found to edit for this class and date!");
    }

    // res.send('No attendance data found to edit');
  } catch (error) {
    console.log(error);
    res.send('Internal server error');
  }
});

router.post("/update/:id", async (req, res) => {
  try {
    await Attendance.findByIdAndUpdate(req.params.id, req.body);
    res.redirect("/attendance/student-form?message=Edit Successfully");
  } catch (err) {
    console.error(err);
    res.redirect("/attendance/student-form");
  }
});


router.get("/getData-form", async (req, res) => {
  
  try {
    return res.status(200).render('attendanceData-form')
    
  } catch (error) {
    res.send("Internal server error")
  }
});

router.post("/getAttendanceData", async (req, res) => {
  try {
    const { startDate, endDate, className, medium, stream } = req.body;

    let query = {
      date: {
        $gte: startDate,
        $lte: endDate,
      },
      className,
      medium,
    };

    if ((className === "11" || className === "12") && stream) {
      query.stream = stream;
    }

    const attendance = await Attendance.find(query).sort({ date: 1 });
    if (!attendance || attendance.length === 0) {
      return res.render("attendanceData.ejs", { tableData: [], dates: [] });
    }

    // ✅ collect unique dates
    const dates = [...new Set(attendance.map(r => r.date.toISOString().split("T")[0]))];

    // ✅ collect unique student IDs
    let studentIds = new Set();
    attendance.forEach(r => {
      r.records.forEach(st => studentIds.add(st.studentId.toString()));
    });
    studentIds = [...studentIds];

    // ✅ fetch student names
    const studentNames = await Student.find({ _id: { $in: studentIds } });
    const studentMap = {};
    studentNames.forEach(s => {
      studentMap[s._id] = s.studentName;
    });

    // ✅ build tableData (one row per student)
    let tableData = studentIds.map(id => {
      let row = { id, name: studentMap[id], attendance: {} };
      dates.forEach(date => {
        row.attendance[date] = "NA"; // default
      });
      return row;
    });

    // ✅ fill attendance
    attendance.forEach(r => {
      const date = r.date.toISOString().split("T")[0];
      r.records.forEach(st => {
        let student = tableData.find(s => s.id === st.studentId.toString());
        if (student) {
          student.attendance[date] = st.status;
        }
      });
    });

    res.render("attendanceData.ejs", {
      tableData,
      dates,
      startDate,
      endDate,
      className,
      medium,
      stream,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

router.get('/delete', async(req,res)=>{
  try {
    return res.status(200).render('delete-attendance.ejs')
  } catch (error) {
    res.send('Internal server error')
  }
})

router.post('/delete', async(req,res)=>{

  try {
    
    const {className, medium, stream} = req.body;
    let query = {className, medium} 
    if((className === '11' || className === '12') && stream){
      query.stream = stream;
    }

    const dlt = await Attendance.deleteMany(query);
    return res.redirect('/attendance/student-form?message=Deleted Successfully')


  } catch (error) {
    res.send("internal server error")
  }
})

module.exports = router;