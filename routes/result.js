const express = require("express");
const router = express.Router();
const Student = require("../models/student");
const SessionHistory = require("../models/sessionHistory");
const Result = require("../models/result");
const { check, validationResult } = require("express-validator");
const qs = require("qs");

// GET route for displaying the class and medium filter form, and then the student list
// GET route for displaying the class and medium filter form, and then the student list
router.get("/", async (req, res) => {
  const {
    studentClass: selectedStudentClass,
    medium: selectedMedium,
    stream: selectedStream,
  } = req.query;

  let students = [];

  if (selectedStudentClass && selectedMedium) {
    try {
      const validClasses = [
        "Nursery",
        "LKG",
        "UKG",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10",
        "11",
        "12",
      ];

      const query = {
        medium: selectedMedium,
        sName: req.user.sName,
        studentClass: selectedStudentClass,
      };

      // ✅ Ensure only valid classes (Nursery to 12)
      if (!validClasses.includes(selectedStudentClass)) {
        // If invalid class is requested (like "Passout"), show empty list
        students = [];
      } else {
        // ✅ Add stream filter only for Class 11 & 12
        if (
          (selectedStudentClass === "11" || selectedStudentClass === "12") &&
          selectedStream
        ) {
          query.stream = selectedStream;
        }

        students = await Student.find(query).sort({ studentName: 1 });
        console.log(students);
      }
    } catch (err) {
      console.error(err);
      return res.status(500).send("Server Error while fetching students.");
    }
  }

  res.render("result", {
    errors: [],
    subjectErrors: [],
    formdata: null,
    students: students,
    filteredStudentClass: selectedStudentClass,
    filteredMedium: selectedMedium,
    filteredStream: selectedStream,
    msg: req.query.msg || null,
  });
});

// POST route for submitting class results
router.post(
  "/class",
  [
    check("studentClass", "Class is required.").notEmpty(), // Changed 'class' to 'studentClass'
    check("medium", "Medium is required.").notEmpty(),
    check("examType", "Exam Type is required.").notEmpty(),
    check("session", "Session is required.").notEmpty(),
  ],
  async (req, res) => {
    const validationErrors = validationResult(req);

    const allErrors = [];
    const allSubjectErrors = [];
    const parsedBody = qs.parse(req.body);
    console.dir(parsedBody);
    // console.log(req.body)
    const {
      studentClass: submittedStudentClass,
      medium: submittedMedium,
      examType,
      session,
      students,
    } = parsedBody;
    // Changed 'class' to 'studentClass' here ^

    // Add validation errors from express-validator
    if (!validationErrors.isEmpty()) {
      allErrors.push(...validationErrors.array());
    }

    if (!students || !Array.isArray(students) || students.length === 0) {
      allErrors.push({
        msg: "No student data provided. Please ensure students are selected and subjects are added.",
      });
    }

    const resultsToCreate = [];
    const submittedResults = [];

    for (let i = 0; i < students.length; i++) {
      const studentData = students[i];
      const studentSpecificErrors = [];
      const subjectSpecificErrors = [];

      if (!studentData.registrationNo) {
        studentSpecificErrors.push({
          msg: `Student ${i + 1} (Name: ${studentData.studentName || "N/A"
            }): Registration No. is missing.`,
        });
      }

      let parsedSubjects = [];
      if (studentData.subjects && Array.isArray(studentData.subjects)) {
        parsedSubjects = studentData.subjects;
        parsedSubjects.forEach((s, subIndex) => {
          if (!s.name || s.name.trim() === "") {
            subjectSpecificErrors.push({
              msg: `Student ${i + 1} (Reg No: ${studentData.registrationNo
                }): Subject ${subIndex + 1}: Name is required.`,
            });
          }
          if (
            s.obtainedMarks === "" ||
            s.obtainedMarks === null ||
            s.obtainedMarks === undefined ||
            isNaN(parseFloat(s.obtainedMarks))
          ) {
            subjectSpecificErrors.push({
              msg: `Student ${i + 1} (Reg No: ${studentData.registrationNo
                }), Subject ${s.name || subIndex + 1
                }: Obtained Marks are required and must be a number.`,
            });
          }
          if (
            s.totalMarks === "" ||
            s.totalMarks === null ||
            s.totalMarks === undefined ||
            isNaN(parseFloat(s.totalMarks))
          ) {
            subjectSpecificErrors.push({
              msg: `Student ${i + 1} (Reg No: ${studentData.registrationNo
                }), Subject ${s.name || subIndex + 1
                }: Total Marks are required and must be a number.`,
            });
          }

          const obtainedMarks = parseFloat(s.obtainedMarks);
          const totalMarks = parseFloat(s.totalMarks);

          if (!isNaN(obtainedMarks) && !isNaN(totalMarks)) {
            if (obtainedMarks < 0 || totalMarks < 0) {
              subjectSpecificErrors.push({
                msg: `Student ${i + 1} (Reg No: ${studentData.registrationNo
                  }), Subject ${s.name || subIndex + 1
                  }: Marks cannot be negative.`,
              });
            }
            if (obtainedMarks > totalMarks) {
              subjectSpecificErrors.push({
                msg: `Student ${i + 1} (Reg No: ${studentData.registrationNo
                  }), Subject ${s.name || subIndex + 1
                  }: Obtained marks (${obtainedMarks}) cannot exceed total marks (${totalMarks}).`,
              });
            }
          }
        });
      } else {
        subjectSpecificErrors.push({
          msg: `Student ${i + 1} (Reg No: ${studentData.registrationNo
            }): At least one subject is required.`,
        });
      }

      if (studentSpecificErrors.length > 0) {
        allErrors.push(...studentSpecificErrors);
      }
      if (subjectSpecificErrors.length > 0) {
        allSubjectErrors.push(...subjectSpecificErrors);
      }

      if (
        studentSpecificErrors.length === 0 &&
        subjectSpecificErrors.length === 0
      ) {
        try {
          const student = await Student.findOne({
            registrationNo: studentData.registrationNo,
          });
          if (!student) {
            allErrors.push({
              msg: `Student with Registration No. ${studentData.registrationNo} does not exist in the database.`,
            });
          } else {
            const studentClassValue = Array.isArray(submittedStudentClass)
              ? submittedStudentClass[0]
              : submittedStudentClass;
            resultsToCreate.push({
              registrationNo: studentData.registrationNo,
              examType: examType,
              session,
              studentClass: studentClassValue,
              subjects: parsedSubjects.map(sub => ({
                name: sub.name,
                obtainedMarks: parseFloat(sub.obtainedMarks),
                totalMarks: parseFloat(sub.totalMarks)
              })),
              date: new Date(),
              sName: req.user.sName
            });


            const totalObtained = parsedSubjects.reduce(
              (sum, s) => sum + parseFloat(s.obtainedMarks),
              0
            );
            const totalMarks = parsedSubjects.reduce(
              (sum, s) => sum + parseFloat(s.totalMarks),
              0
            );
            const percentage = (totalObtained / totalMarks) * 100;

            let grade = "";
            if (percentage >= 90) grade = "A+";
            else if (percentage >= 80) grade = "A";
            else if (percentage >= 70) grade = "B";
            else if (percentage >= 60) grade = "C";
            else if (percentage >= 50) grade = "D";
            else grade = "F";

            const promotionMap = {
              Nursery: "LKG",
              LKG: "UKG",
              UKG: "1",
              1: "2",
              2: "3",
              3: "4",
              4: "5",
              5: "6",
              6: "7",
              7: "8",
              8: "9",
              9: "10",
              10: "11",
              11: "12",
              12: "Passout",
            };

            function incrementSession(sessionStr) {
              const [start, end] = sessionStr.split("-").map(Number);
              if (!start || !end) return sessionStr;
              const nextStart = start + 1;
              const nextEnd = (end + 1).toString().padStart(2, "0");
              return `${nextStart}-${nextEnd}`;
            }

            // Inside your loop for each student
            if (
              [
                "Final",
                "final",
                "FINAL",
                "annual",
                "ANNUAL",
                "Annual",
              ].includes(examType)
            ) {
              const student = await Student.findOne({
                registrationNo: studentData.registrationNo,
                sName: req.user.sName,
              });

              if (student) {
                const currentClass = student.studentClass;
                const nextSession = incrementSession(student.session);
                const nextClass = promotionMap[currentClass];

                // Prepare session history data
                const historyData = {
                  registrationNo: student.registrationNo,
                  studentName: student.studentName,
                  session: student.session,
                  medium: student.medium,
                  className: currentClass,
                  promotedTo: grade !== "F" ? nextClass : currentClass,
                  examType,
                  grade,
                  percentage: percentage.toFixed(2),
                  totalFees: student.totalFees,
                  feesPaid: student.feesPaid,
                  sName: req.user.sName,
                };

                // Add stream only if class is 11 or 12
                if (currentClass === "11" || currentClass === "12") {
                  historyData.stream = student.stream || null; // Ensure stream exists
                }

                await SessionHistory.create(historyData);

                let updatedFields = { session: nextSession }; // session always updates

                if (grade !== "F" && nextClass && currentClass !== "12") {
                  updatedFields.studentClass = nextClass;
                }

                if (grade !== "F" && currentClass === "12") {
                  updatedFields.studentClass = "Passout";
                }

                await Student.updateOne(
                  {
                    registrationNo: student.registrationNo,
                    sName: req.user.sName,
                  },
                  { $set: updatedFields, totalFees: 0, feesPaid: 0 }
                );
              }
            }

            submittedResults.push({
              registrationNo: studentData.registrationNo,
              studentName: studentData.studentName, // Assuming you want to include student name
              percentage: percentage.toFixed(2),
              grade,
            });

            // if(examType === 'Final' || 'Annual' && grade !== 'F'){
            //  const students = await Student.updateMany({},{$inc:{studentClass:1}});
            //  console.log(students);
            // }
          }
        } catch (err) {
          console.error("Error fetching student in result submission:", err);
          allErrors.push({
            msg: `Server error validating student ${studentData.registrationNo}.`,
          });
        }
      }
    }

    if (allErrors.length > 0 || allSubjectErrors.length > 0) {
      let studentsInClass = [];
      try {
        studentsInClass = await Student.find({
          studentClass: submittedStudentClass,
          medium: submittedMedium,
          sName: req.user.sName,
        }).sort({ studentName: 1 });
        // Changed 'class' to 'studentClass' here ^
      } catch (err) {
        console.error("Error re-fetching students for error display:", err);
      }

      return res.render("result", {
        errors: allErrors,
        subjectErrors: allSubjectErrors,
        formdata: req.body,
        students: studentsInClass,
        filteredStudentClass: submittedStudentClass, // Changed 'filteredClass' to 'filteredStudentClass'
        filteredMedium: submittedMedium,
        msg: null,
      });
    }

    try {
      const inserted = await Result.insertMany(resultsToCreate);
      console.log("inserted:", inserted);

      res.render("submittedResults", {
        students: submittedResults,
        studentClass: Array.isArray(submittedStudentClass)
          ? submittedStudentClass[0]
          : submittedStudentClass,
        medium: submittedMedium,
        examType,
        session,
      });

      // res.redirect(`/result?msg=Class results for Class ${submittedStudentClass}, Medium ${submittedMedium} uploaded successfully!`);
      // Changed 'class' to 'studentClass' in redirect message ^
    } catch (err) {
      console.error("Error saving results:", err);
      let studentsInClass = [];
      try {
        studentsInClass = await Student.find({
          studentClass: submittedStudentClass,
          medium: submittedMedium,
          sName: req.user.sName,
        }).sort({ studentName: 1 });
        // Changed 'class' to 'studentClass' here ^
      } catch (fetchErr) {
        console.error("Error re-fetching students after save error:", fetchErr);
      }
      res.status(500).render("result", {
        errors: [
          {
            msg: "Server error during database operation. Results might not have been saved.",
          },
        ],
        subjectErrors: [],
        formdata: req.body,
        students: studentsInClass,
        filteredStudentClass: submittedStudentClass, // Changed 'filteredClass' to 'filteredStudentClass'
        filteredMedium: submittedMedium,
        msg: null,
      });
    }
  }
);

// Existing routes for individual marksheet display (from previous conversations)
router.get("/marksheet", async (req, res) => {
  try {
    const msg = req.query?.msg;
    res.render("marksheet", {
      result: null,
      error: null,
      user: req.user || null,
      msg,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

router.post("/marksheet", async (req, res) => {
  try {
    const { registrationNo, studentName, examType, session, studentClass } =
      req.body;

    const sName = req.user?.sName || req.body.sName;

    const normalizedExamType = examType.toLowerCase();

    const isEligible = await SessionHistory.findOne({
      registrationNo,
      session,
      className: studentClass,
      sName,
    });
    if (["final", "annual"].includes(normalizedExamType)) {
      if (isEligible.totalFees !== isEligible.feesPaid) {
        return res.render("marksheet", {
          result: null,
          error:
            "❌ Your fee is due. Please clear your dues to view the result.",
          user: req.user || null,
          msg: null,
        });
      }
    } else if (
      ["mid-term", "midterm", "half-yearly", "halfyearly"].includes(
        normalizedExamType
      )
    ) {
      if (isEligible.totalFees / 2 > isEligible.feesPaid) {
        return res.render("marksheet", {
          result: null,
          error:
            "❌ Your fee is less than 50%. Please clear your dues to view the result.",
          user: req.user || null,
          msg: null,
        });
      }
    }

    const student = await Student.findOne({
      registrationNo,
      studentName,
      sName,
    });
    if (!student) {
      return res.render("marksheet", {
        result: null,
        error: `${registrationNo} is not allocated to ${studentName}`,
        user: req.user || null,
        msg: null,
      });
    }

    const result = await Result.findOne({
      registrationNo,
      session,
      examType,
      studentClass,
      sName,
    });
    // const result = await Result.findOne({ registrationNo, examType, session, studentClass, sName: req.user.sName });
    if (!result) {
      return res.render("marksheet", {
        result: null,
        error: "Result not found",
        user: req.user || null,
        msg: null,

      });
    }

    let totalObtained = 0;
    let totalMarks = 0;

    // console.log(result.subjects)

    result.subjects.forEach((sub) => {
      totalObtained += sub.obtainedMarks;
      totalMarks += sub.totalMarks;
    });

    const percentage = (totalObtained / totalMarks) * 100;
    let grade = "";
    if (percentage >= 90) grade = "A+";
    else if (percentage >= 80) grade = "A";
    else if (percentage >= 70) grade = "B";
    else if (percentage >= 60) grade = "C";
    else if (percentage >= 50) grade = "D";
    else grade = "F";

    let division = "";
    if (percentage >= 60) division = "First Division";
    else if (percentage >= 45) division = "Second Division";
    else if (percentage >= 33) division = "Third Division";
    else division = "Fail";

    res.render('marksheetView', {
      student,
      result,
      totalObtained,
      totalMarks,
      percentage: percentage.toFixed(2),
      grade,
      division,
      declarationDate: result.declarationDate?.toDateString() || new Date().toDateString(),
      error: null,
      user: req.user || null,
    });

  } catch (err) {
    console.error(err);
    res.render("marksheet", {
      result: null,
      error: "Server error",
      user: req.user || null,
      msg: null,

    });
  }
});

router.get("/marksheetView", async (req, res) => {
  try {
    return res.render("marksheetView", {
      user: req.user || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});


// Edit Result Route

router.get('/editResult', async (req, res) => {
  try {
    res.status(200).render('editResult', { result: null, })
  } catch (error) {
    res.status(500).send('Server Error')
  }
})
  .post('/editResult', async (req, res) => {
    try {
      const { studentClass, examType, session, stream, medium } = req.body;
      const sName = req.user.sName;

      let students = [];
      let registrationNos = [];

      const isFinalExam = examType.toLowerCase() === 'final' || examType.toLowerCase() === 'annual';
      const isMidExam = examType.toLowerCase() === 'midterm' || examType.toLowerCase() === 'halfyearly';

      // Step 1: Fetch all results for given filters
      const allResults = await Result.find({ studentClass, examType, session, sName });
      console.log('all results', allResults)

      const passedRegNos = [];
      const failedRegNos = [];

      for (let result of allResults) {
        const subjects = result.subjects || [];

        let totalObtained = 0;
        let totalMarks = 0;

        for (let sub of subjects) {
          totalObtained += Number(sub.obtainedMarks || 0);
          totalMarks += Number(sub.totalMarks || 0);
        }

        const percentage = totalMarks > 0 ? (totalObtained / totalMarks) * 100 : 0;

        if (percentage >= 33) {
          passedRegNos.push(result.registrationNo);
          console.log(passedRegNos, 'passreg')
        } else {
          failedRegNos.push(result.registrationNo);
          console.log('failreg', failedRegNos)
        }
      }

      // Step 3: Fetch students based on logic
      if (isFinalExam) {
        // Final/Annual — only passed students → from SessionHistory
        registrationNos = passedRegNos;

        students = await SessionHistory.find({
          registrationNo: { $in: registrationNos },
          className: studentClass,
          medium,
          session,
          ...(stream ? { stream } : {}),
          sName
        });
        console.log(students)
      } else {
        // Midterm/Halfyearly OR failed in final/annual → from Student model
        registrationNos = isMidExam ? allResults.map(r => r.registrationNo) : failedRegNos;

        students = await Student.find({
          registrationNo: { $in: registrationNos },
          studentClass,
          session,
          medium,
          ...(stream ? { stream } : {}),
          sName
        });
        console.log(students)
      }

      // Step 4: Filter final results again using the students list
      const result = await Result.find({
        studentClass,
        examType,
        session,
        sName,
        registrationNo: { $in: students.map(s => s.registrationNo) }
      });
      console.log(result)
      if (!result || result.length === 0) {
        return res.send("No results found.");
      }

      return res.render('editResult', { result, students });

    } catch (error) {
      console.error(error);
      res.status(500).send('Server Error');
    }
  })

router.post('/updateResult', async (req, res) => {

  try {
    const parsedBody = qs.parse(req.body);
    const { students } = parsedBody;

    for (const stu of students) {
      const result = await Result.findOne({
        registrationNo: stu.registrationNo,
        studentClass: req.body.studentClass,
        session: req.body.session,
        examType: req.body.examType,
        sName: req.user.sName
      });

      if (result) {
        stu.subjects.forEach((updatedSubj, index) => {
          if (result.subjects[index]) {
            result.subjects[index].name = updatedSubj.name;
            result.subjects[index].obtainedMarks = Number(updatedSubj.obtainedMarks);
            result.subjects[index].totalMarks = Number(updatedSubj.totalMarks);
          }
        });
        await result.save();
      }
    }

    return res.redirect('/result/marksheet?msg=Updated Successfully');
  } catch (error) {
    return res.status(500).send("Server Error")
  }
});


router.get('/summary', async (req, res) => {
  try {
    return res.status(200).render('summaryForm', { result: null, })
  } catch (error) {
    res.status(500).send('Server Error');
  }
})
  .post('/summary', async (req, res) => {
    try {
     const { studentClass, examType, session, stream, medium } = req.body;
      const sName = req.user.sName;

      let students = [];
      let registrationNos = [];

      const isFinalExam = examType.toLowerCase() === 'final' || examType.toLowerCase() === 'annual';
      const isMidExam = examType.toLowerCase() === 'midterm' || examType.toLowerCase() === 'halfyearly';

      // Step 1: Fetch all results for given filters
      const allResults = await Result.find({ studentClass, examType, session, sName });
      console.log('all results', allResults)

      const passedRegNos = [];
      const failedRegNos = [];

      for (let result of allResults) {
        const subjects = result.subjects || [];

        let totalObtained = 0;
        let totalMarks = 0;

        for (let sub of subjects) {
          totalObtained += Number(sub.obtainedMarks || 0);
          totalMarks += Number(sub.totalMarks || 0);
        }

        const percentage = totalMarks > 0 ? (totalObtained / totalMarks) * 100 : 0;

        if (percentage >= 33) {
          passedRegNos.push(result.registrationNo);
          console.log(passedRegNos, 'passreg')
        } else {
          failedRegNos.push(result.registrationNo);
          console.log('failreg', failedRegNos)
        }
      }

      // Step 3: Fetch students based on logic
      if (isFinalExam) {
        // Final/Annual — only passed students → from SessionHistory
        registrationNos = passedRegNos;

        students = await SessionHistory.find({
          registrationNo: { $in: registrationNos },
          className: studentClass,
          medium,
          session,
          ...(stream ? { stream } : {}),
          sName
        });
        console.log(students)
      } else {
        // Midterm/Halfyearly OR failed in final/annual → from Student model
        registrationNos = isMidExam ? allResults.map(r => r.registrationNo) : failedRegNos;

        students = await Student.find({
          registrationNo: { $in: registrationNos },
          studentClass,
          session,
          medium,
          ...(stream ? { stream } : {}),
          sName
        });
        console.log(students)
      }

      // Step 4: Filter final results again using the students list
      const result = await Result.find({
        studentClass,
        examType,
        session,
        sName,
        registrationNo: { $in: students.map(s => s.registrationNo) }
      });
      console.log(result)
      if (!result || result.length === 0) {
        return res.render('errorPage',{
          message:"No Results Found",
        });
      }

      return res.render('summaryForm', { result, students });
    } catch (error) {

    }
  })


module.exports = router;
