const { Schema, model } = require("mongoose");

const teacherSchema = new Schema(
  {

    empId:{
      type:String,
      required:true,
    },

    jobTitle: {
      type: String,
      required: true,
    }
    ,
    teacherName: {
      type: String,
      required: true,
    },
    teacherContact: {
      type: Number,
      required: true,
    },
    teacherEmail: {
      type: String,
      required: true,
      unique: true,
    },
    teacherSubject: {
      type: String,
      default: "None",
      validate: {
        validator: function (value) {
          return this.jobTitle !== 'teacher' || (value && value.length > 0);
        },
        message: 'Subject is required for Teacher.'
      }
    },
    teacherClass: {
      type: String,
      default: "None",
      validate: {
        validator: function (value) {
          return this.jobTitle !== 'teacher' || (value && value.length > 0);
        },
        message: 'Class is required for Teacher.'
      }
    },
  
    teacherSalary: {
      type: Number,
      required: true,
    },
     sName:{
            type:String,
            required:true,
        },

    gender: {
      type: String,
      required: true,
    },
    medium: {
      type: String,
      default: 'None',
      validate: {
        validator: function (value) {
          // Required only if jobTitle is teacher
          return this.jobTitle !== 'teacher' || (value && value.trim().length > 0);
        },
        message: 'Medium is required for Teacher.'
      }
    }
    ,
  },
  { timestamps: true }
);

const Teacher = model("teacher", teacherSchema);

module.exports = Teacher;
