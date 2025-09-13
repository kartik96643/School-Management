const {Schema,model} = require('mongoose');

const studentSchema = new Schema({
    studentName:{
        type:String,
        required:true,
    },
    fatherName:{
        type:String,
        required:true,
    },
    motherName:{
        type:String,
        required:true,
    },
    gender:{
        type:String,
        required:true,
        enum: ['Male', 'Female', 'Other'] // Added enum for validation and clarity
    },
    studentDob:{
        type: Date,
        required:true,
    },
    studentClass:{
        type:String, // Changed to String to accommodate streams (e.g., "11 Arts")
        required:true,
    },
    stream:{
        type:String, // Added stream field
        required: function() {
            // Only required if studentClass is '11' or '12'
            return this.studentClass === '11' || this.studentClass === '12';
        }
    },
    medium:{
        type:String, // Added medium field
        required:true,
    },
    contactNo:{
        type:Number,
        required:true,
    },
    registrationNo:{
        type:String,
        required:true,
        unique:true,
    },
    address:{
        type:String,
        required: true,
    },
    totalFees:{
        type:Number,
        required:true,
    },
    feesPaid:{
        type:Number,
        default:0,
    },
    session:{
        type:String,
        required:true,
    },
     sName:{
            type:String,
            required:true,
        },

});

const Student = model("student",studentSchema);

module.exports=Student;