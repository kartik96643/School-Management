const mongoose = require('mongoose')

const timetableSchema = new mongoose.Schema({
    className:{type:String, required:true},
    medium:{type:String, required:true},
    examType:{type:String,required:true},
     sName: {
        type: String,
        required: true,
    },
    exams:[
        {
            subject:{type:String, required:true,},
            date:{type:Date, required:true},
            startTime:{type:String, required:true},
            endTime:{type:String,required:true},
        }
    ]
}, {capped:{size:5242880, max:25}});

const TimeTable = mongoose.model('timetable', timetableSchema);

module.exports = TimeTable;