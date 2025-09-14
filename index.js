const express = require('express');
const {connectToMongoDb} = require('./database')
const exp = require('constants');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();


const adminRoute = require('./routes/admin')
const studentRoute = require('./routes/student');
const homeRoute = require('./routes/home');
const teacherRoute = require('./routes/teacher')
const resultRoute = require('./routes/result')
const sessionRoute = require('./routes/sessionHistory')
const timetableRoute = require('./routes/timeTable')
const attendanceRoute = require('./routes/attendance')
const staffAttendanceRoute = require('./routes/staffAttendance')
const { checkCookieToken , restrictTo} = require('./middleware/auth');


const app = express();

const PORT = 8000;
 
app.use(express.static('public'));


// DATABASE CONNECTION
connectToMongoDb(process.env.mongoURI)
.then(()=>console.log("database connected")
).catch((error)=>{console.log("Internal Error",error)});

// to suport form data 
app.use(express.urlencoded({extended:true}));
app.use(express.json());  
app.use(cookieParser())

// ENGINE FOR FRONTEND
app.set('view engine','ejs');
app.set('views',path.resolve('./views'));

app.use('/admin', adminRoute);

app.use(checkCookieToken('token'));

app.use('/teacher', teacherRoute);
app.use('/sessionHistory',sessionRoute);
app.use('/exam-timetable', timetableRoute);
app.use('/attendance', attendanceRoute);
app.use('/staffAttendance', staffAttendanceRoute);
app.use('/', restrictTo(['ADMIN', 'NORMAL','ACCOUNTANT']), homeRoute);

app.use('/students', restrictTo(['ADMIN', 'NORMAL','ACCOUNTANT']), studentRoute);
app.use('/result', restrictTo(['ADMIN', 'NORMAL']), resultRoute);




app.listen(PORT,()=>
    console.log(`Server start at port ${PORT}`)
);
