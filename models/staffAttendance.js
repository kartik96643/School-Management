const mongoose = require("mongoose");

const staffAttendanceSchema = new mongoose.Schema({
    date:{
        type: Date,
        required:true,
    },
  jobTitle: {
    type: String,
    required: true
  },
   sName: {
        type: String,
        required: true,
    },
  records: [
    {
      staffId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Teacher",
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


staffAttendanceSchema.index({ date: 1,jobTitle:1 }, { unique: true });

const staffAttendance = mongoose.model("staffAttendance", staffAttendanceSchema);
module.exports = staffAttendance;

