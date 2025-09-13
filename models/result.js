const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
 
  registrationNo: { type: String, required: true },
  examType: { type: String, required: true },
  session: { type: String, required: true },
  studentClass: { type: String, required: true },
  subjects: [
    {
      name: { type: String, required: true },
      obtainedMarks: { type: Number, required: true },
      totalMarks: { type: Number, required: true },
    }
  ],
  date: { type: Date, default: Date.now },
  sName: {
    type: String,
    required: true,
  },
});

const Result = new mongoose.model('result', resultSchema);
module.exports = Result;
