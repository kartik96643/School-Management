const { Schema, model, default: mongoose } = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);


const studentFeesSchema = new Schema({
    receptNo: {
        type: Number,
        unique: true
    },
    studentName: {
        type: String,
        required: true,
    },
    studentClass: {
        type: String,
        required: true,
    },
    registrationNo: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    paymentMethod: {
        type: String,
        required: true,
    },
    sName: {
        type: String,
        required: true,
    },
    sAddress:{
        type:String,
        required:true,
    },


}, { timestamps: true, });

studentFeesSchema.plugin(AutoIncrement, {
  inc_field: 'receptNo',
  start_seq: 1001,   
    
});

const Fees = model("studentFees", studentFeesSchema);

module.exports = Fees;