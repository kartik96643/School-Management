const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  className: {
    type: String,
    required: true
  },
   stream: {
        type: String,
        enum: ['Science', 'Arts', 'Commerce'],
        required: function () {
            return this.className === '11' || this.className === '12';
        },
       
    },
  medium: {
    type: String,
    required: true
  },
   sName: {
        type: String,
        required: true,
    },
  records: [
    {
      studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
        required: true
      },
      status: {
        type: String,
        enum: ["Present", "Absent", "Leave"],
        required: true
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});


attendanceSchema.index({ date: 1, className: 1, medium: 1, stream: 1 }, { unique: true });

const Attendance = mongoose.model("Attendance", attendanceSchema);
module.exports = Attendance

