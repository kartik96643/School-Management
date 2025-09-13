 const mongoose = require('mongoose');

const sessionHistorySchema = new mongoose.Schema({
    registrationNo: { type: String, required: true },
    studentName: { type: String, required: true },
    session: { type: String, required: true },
    className: { type: String, required: true },
    stream: {
        type: String,
        enum: ['Science', 'Arts', 'Commerce'],
        required: function () {
            return this.className === '11' || this.className === '12';
        },
        default: null
    },
    medium:{type:String, required:true},
    promotedTo: { type: String },
    examType: { type: String, required: true },
    grade: { type: String, required: true },
    percentage: Number,
    totalFees: { type: Number, required: true },
    feesPaid: { type: Number, required: true },
    resultDate: { type: Date, default: Date.now },
    sName: { type: String, required: true },
});

const SessionHistory = mongoose.model('StudentSessionHistory', sessionHistorySchema);

module.exports = SessionHistory;
