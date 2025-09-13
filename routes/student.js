const express = require('express');
const ADMIN = require('../models/admin')
const Student = require('../models/student');
const Fees = require('../models/studentFees');
const sessionHistory = require('../models/sessionHistory')
const mongoose = require('mongoose');
// for show download data in excel sheet
const ExcelJS = require('exceljs');
const { check, validationResult, query } = require('express-validator');


const router = express.Router();

//upload excel data
const multer = require('multer');
const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');
const { type } = require('os');
const { restrictTo } = require('../middleware/auth');

// STUDENT FORM WITH GET AND POST METHOD

router.post('/register', [
    check('studentName', 'Name should be of at least 2 characters').isLength({ min: 2 }).trim().escape(),
    check('fatherName', "Father's name should be of at least 2 characters").isLength({ min: 2 }).trim().escape(),
    check('motherName', "Mother's name should be of at least 2 characters").isLength({ min: 2 }).trim().escape(),
    check('address', "Address should be atleast 10 characters").isLength({ min: 10 }).trim().escape(),
    // New validation for gender
    check('gender', 'Gender is required and must be Male, Female, or Other').isIn(['Male', 'Female', 'Other']).notEmpty(),
    check('studentDob', 'Dob is required'), // Added max for age
    // Update validation for studentClass to allow strings
    check('studentClass', 'Invalid Class selected').notEmpty(),
    // Add validation for medium
    check('medium', 'Medium is required').notEmpty().isIn(['Hindi', 'English']),
    // Conditionally validate stream
    check('stream').custom((value, { req }) => {
        if (['11', '12'].includes(req.body.studentClass) && !value) {
            throw new Error('Stream is required for Class 11 and 12');
        }
        return true;
    }).optional({ checkFalsy: true }), // Make stream optional if not class 11/12
    check('contactNo', 'Contact number must be exactly 10 digits').isLength({ min: 10, max: 10 }).isNumeric(),
    check('registrationNo', 'Registration Number is required and cannot be empty').isString().notEmpty().trim().escape(),
    check('totalFees', 'Total fees must be a non-negative number').isFloat({ min: 0 }),
    check('feesPaid').custom((value, { req }) => {
        if (parseFloat(value) > parseFloat(req.body.totalFees)) {
            throw new Error('Fees paid cannot exceed total fees');
        }
        if (parseFloat(value) < 0) { // Ensure fees paid is not negative
            throw new Error('Fees paid cannot be negative');
        }
        return true;
    }),
    check('paymentMethod').custom((value, { req }) => {
    if (parseFloat(req.body.feesPaid) > 0 && (!value || value.trim() === '')) {
        throw new Error('Payment method is required when fees are paid');
    }
    return true;
}),
    // New validation for session
    check('session', 'Session is required and must be in YYYY-YY format (e.g., 2023-24)').matches(/^\d{4}-\d{2}$/).trim().escape(),
], async (req, res) => {

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.render('student', {
            errors: errors.array(),
            formdata: req.body
        });
    }
    const admin = req.user;
    const {
        studentName,
        fatherName,
        motherName,
        gender,
        studentDob,
        studentClass,
        medium,
        stream,
        contactNo,
        registrationNo,
        totalFees,
        feesPaid,
        session,
        date,
        paymentMethod,
        address,
    } = req.body;

    try {
        const existStudent = await Student.findOne({ registrationNo, sName: admin.sName });
        if (existStudent) {
            return res.status(409).render('student', {
                errors: [{ msg: 'Student with this registration already exists' }],
                formdata: req.body
            });
        }

        const student = await Student.create({
            studentName,
            fatherName,
            motherName,
            gender,
            address,
            studentDob,
            studentClass,
            medium,
            stream: (studentClass === '11' || studentClass === '12') ? stream : null,
            contactNo,
            registrationNo,
            totalFees,
            feesPaid,
            session,
            sName: admin.sName,

        });

        if (parseFloat(feesPaid) > 0) {
    try {
        await Fees.create({
            date,
            studentName,
            amount: feesPaid,
            sName: admin.sName,
            sAddress: admin.sAddress,
            registrationNo,
            studentClass,
            paymentMethod,
        });
    } catch (feeErr) {
        console.error("Error saving fee receipt:", feeErr);
        return res.status(500).render('student', {
            errors: [{ msg: 'Failed to create fee receipt. Please try again.' }],
            formdata: req.body
        });
    }
}

        return res.status(201).redirect('/?message=Student registered successfully');
    } catch (error) {
        console.error("Error during student registration:", error);
        return res.status(500).send('Server Error');
    }
})
    .get('/register', async (req, res) => {
        try {
            return res.render('student', {
                errors: [],
                formdata: {},
            });
        } catch (error) {
            console.error("Error rendering registration form:", error);
            return res.status(500).send("Internal Server Error");
        }
    });

// In your Express route file (e.g., studentController.js or wherever your routes are defined) // Adjust the path to your Student model

// This function seems to be intended as a controller function, not directly a route definition.
// If it's used as a middleware or part of another route, keep it as is.
// If it's meant to be a route, it should be defined like router.get('/students/all-classes', async (req, res) => { ... });
router.get('/all-classes-overview', async (req, res) => { // Changed the route name for clarity
    try {
        const aggregatedData = await Student.aggregate([
            // Group by medium, class, and conditionally by stream
            {
                $match: {
                    sName: req.user.sName
                }
            },
            {

                $group: {
                    _id: {
                        medium: "$medium",
                        studentClass: "$studentClass",
                        // Conditionally include stream only for classes 11 and 12
                        stream: {
                            $cond: {
                                if: { $in: ["$studentClass", ["11", "12"]] },
                                then: "$stream",
                                else: null // For other classes, stream is not relevant
                            }
                        }
                    },
                    count: { $sum: 1 } // Count students in each group
                }
            },
            // Project to reshape the output
            {
                $project: {
                    _id: 0,
                    medium: "$_id.medium",
                    studentClass: "$_id.studentClass",
                    stream: "$_id.stream",
                    studentCount: "$count"
                }
            },
            // Sort for consistent output order (optional but good practice)
            {
                $sort: {
                    medium: 1,
                    studentClass: 1,
                    stream: 1
                }
            }
        ]);

        // Now, restructure the aggregated data into the desired format for the EJS template
        const organizedData = {
            hindiMedium: [],
            englishMedium: []
        };

        const classMapHindi = {};
        const classMapEnglish = {};

        aggregatedData.forEach(item => {
            let targetMap;
            let targetArray;

            if (item.medium === 'Hindi') {
                targetMap = classMapHindi;
                targetArray = organizedData.hindiMedium;
            } else if (item.medium === 'English') {
                targetMap = classMapEnglish;
                targetArray = organizedData.englishMedium;
            } else {
                return; // Skip if medium is neither Hindi nor English (shouldn't happen with proper validation)
            }

            if (item.studentClass === '11' || item.studentClass === '12') {
                // For classes 11 and 12, group by stream
                if (!targetMap[item.studentClass]) {
                    targetMap[item.studentClass] = {
                        studentClass: item.studentClass,
                        streams: []
                    };
                    targetArray.push(targetMap[item.studentClass]);
                }
                if (item.stream) { // Only add stream if it exists (e.g., not null from aggregation)
                    targetMap[item.studentClass].streams.push({
                        stream: item.stream,
                        studentCount: item.studentCount
                    });
                }
            } else {
                // For other classes, just a total count
                targetArray.push({
                    studentClass: item.studentClass,
                    totalStudents: item.studentCount
                });
            }
        });

        // Ensure streams within Class 11/12 are sorted (optional)
        Object.values(classMapHindi).forEach(classObj => {
            if (classObj.streams) {
                classObj.streams.sort((a, b) => a.stream.localeCompare(b.stream));
            }
        });
        Object.values(classMapEnglish).forEach(classObj => {
            if (classObj.streams) {
                classObj.streams.sort((a, b) => a.stream.localeCompare(b.stream));
            }
        });

        // Ensure overall class order (Nursery, LKG, UKG, then numbers) within medium arrays
        const sortClasses = (arr) => {
            const classOrder = ['Nursery', 'LKG', 'UKG'];
            arr.sort((a, b) => {
                const aIndex = classOrder.indexOf(a.studentClass);
                const bIndex = classOrder.indexOf(b.studentClass);

                if (aIndex > -1 && bIndex > -1) return aIndex - bIndex;
                if (aIndex > -1) return -1;
                if (bIndex > -1) return 1;
                return parseInt(a.studentClass) - parseInt(b.studentClass);
            });
        };
        sortClasses(organizedData.hindiMedium);
        sortClasses(organizedData.englishMedium);

        res.render('classAndStudentData', {
            user: req.user, // Pass the user object if you have authentication
            data: organizedData
        });

    } catch (error) {
        console.error('Error fetching class data:', error);
        res.status(500).send('Internal Server Error');
    }
});

// STUDENT FEES FORM WITH GET AND POST METHOD
router.post('/studentFees', restrictTo(['ADMIN','ACCOUNTANT']),[
    // check('receptNo', 'Receipt Number cannot be negative or 0').isInt({ min: 1 }),
    check('studentName', 'Name should be of at least 2 characters').isLength({ min: 2 }).trim().escape(),
    check('studentClass', 'Class should be of at least 1 characters').isLength({ min: 1 }).trim().escape(),
    check('registrationNo', 'Registration Number is required and cannot be empty').isString().notEmpty().trim().escape(),
    check('amount', 'Amount cannot be negative or 0').isInt({ min: 1 }),
    check('date', 'Invalid Date').isISO8601().toDate(), // Assuming date is in ISO format
    check('paymentMethod', 'Payment method is required').notEmpty().trim().escape(),
], async (req, res) => {

    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).render('studentFees', { // Use 400 Bad Request for validation errors
                errors: errors.array(),
                formdata: req.body,
                user:req.user,
                submittedData:null,
                feesDetail:null,
            });
        }
        // await mongoose.connection.collection('studentfees').dropIndex('registrationNo_1'); // This line seems problematic, consider removing or understanding its purpose. It's usually not good practice to drop indexes in a route handler unless absolutely necessary and carefully managed.

        const { registrationNo, studentName, studentClass, amount, date, paymentMethod } = req.body;
        // const { receptNo, registrationNo, studentName, studentClass, amount, date, paymentMethod } = req.body;

        const student = await Student.findOne({ registrationNo, studentName, sName: req.user.sName }); // Shortened query
        if (!student) {
            return res.status(404).render('studentFees', { // Use 404 Not Found if student doesn't exist
                errors: [{ msg: "Student with this registration number and name does not exist." }],
                formdata: req.body,
                user:req.user,
                feesDetail:null,
                submittedData:null,

            });
        }

        const amt = parseFloat(amount);
        // Check if fees paid exceeds total fees before saving
        if (student.feesPaid + amt > student.totalFees) {
            return res.status(400).render('studentFees', {
                errors: [{ msg: `Paying ₹${amount} would exceed total fees. Remaining dues: ₹${student.totalFees - student.feesPaid}.` }],
                formdata: req.body,
                user:req.user,
                submittedData:null,
                feesDetail:null,

            });
        }
        console.log(req.user)
        const feesDetail = await Fees.create({

            studentName: studentName,
            studentClass: studentClass,
            registrationNo: registrationNo,
            amount: amt,
            date: date,
            paymentMethod: paymentMethod,
            sName: req.user.sName,
            sAddress:req.user.sAddress,
        });

        await Student.findOneAndUpdate({ registrationNo, sName: req.user.sName }, { $inc: { feesPaid: amt } });

        // return res.status(200).render('home', { // Consider redirecting to a success page or the student's fees details
        //     user: req.user,
        //     msg: "Fees Updated Successfully",
        // });
        console.log(req.body,"body")
        
        return res.status(200).render('studentFees', {
           
            errors: [],
            formdata: {},
            submittedData: req.body,
            feesDetail,
            user:req.user,
        });

        // return res.status(200).redirect('/students/studentFees?success=Fees Updated Successfully')
        
    } catch (error) {
        console.error("Error processing student fees:", error); // Log the actual error for debugging
        return res.status(500).send("Internal Server Error");
    }
    
})
.get('/studentFees', restrictTo(['ADMIN','ACCOUNTANT']) ,async (req, res) => {
    try {
        
        console.log(req.user,"user")

            res.render('studentFees.ejs', {
                errors: [],
                formdata: {},
                submittedData: req.body || null,
                feesDetail: null,
                user: req.user,
            });
        } catch (error) {
            console.error("Error rendering student fees form:", error);
            return res.status(500).send("Internal Server Error");
        }
    });

router.get('/allstudents', async (req, res) => {
    try {
        const aggregatedData = await Student.aggregate([
            {
                $match: {
                    sName: req.user.sName
                }
            },
            {
                $group: {
                    _id: {
                        medium: "$medium",
                        studentClass: "$studentClass",
                        stream: {
                            $cond: {
                                if: { $in: ["$studentClass", ["11", "12"]] },
                                then: "$stream",
                                else: null
                            }
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    medium: "$_id.medium",
                    studentClass: "$_id.studentClass",
                    stream: "$_id.stream",
                    studentCount: "$count"
                }
            },
            {
                $sort: {
                    medium: 1,
                    studentClass: 1,
                    stream: 1
                }
            }
        ]);

        const organizedData = {
            hindiMedium: [],
            englishMedium: []
        };

        const classMapHindi = {};
        const classMapEnglish = {};

        aggregatedData.forEach(item => {
            let targetMap;
            let targetArray;

            if (item.medium === 'Hindi') {
                targetMap = classMapHindi;
                targetArray = organizedData.hindiMedium;
            } else if (item.medium === 'English') {
                targetMap = classMapEnglish;
                targetArray = organizedData.englishMedium;
            } else {
                return;
            }

            if (item.studentClass === '11' || item.studentClass === '12') {
                if (!targetMap[item.studentClass]) {
                    targetMap[item.studentClass] = {
                        studentClass: item.studentClass,
                        streams: []
                    };
                    targetArray.push(targetMap[item.studentClass]);
                }
                if (item.stream) {
                    targetMap[item.studentClass].streams.push({
                        stream: item.stream,
                        studentCount: item.studentCount
                    });
                }
            } else {
                targetArray.push({
                    studentClass: item.studentClass,
                    totalStudents: item.studentCount
                });
            }
        });

        Object.values(classMapHindi).forEach(classObj => {
            if (classObj.streams) {
                classObj.streams.sort((a, b) => a.stream.localeCompare(b.stream));
            }
        });
        Object.values(classMapEnglish).forEach(classObj => {
            if (classObj.streams) {
                classObj.streams.sort((a, b) => a.stream.localeCompare(b.stream));
            }
        });

        const sortClasses = (arr) => {
            const classOrder = ['Nursery', 'LKG', 'UKG'];
            arr.sort((a, b) => {
                const aIndex = classOrder.indexOf(a.studentClass);
                const bIndex = classOrder.indexOf(b.studentClass);

                if (aIndex > -1 && bIndex > -1) return aIndex - bIndex;
                if (aIndex > -1) return -1;
                if (bIndex > -1) return 1;
                return parseInt(a.studentClass) - parseInt(b.studentClass);
            });
        };
        sortClasses(organizedData.hindiMedium);
        sortClasses(organizedData.englishMedium);


        res.render('classAndStudentData', {
            user: req.user,
            data: organizedData
        });

    } catch (error) {
        console.error('Error fetching class data:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/classes/:studentClass', async (req, res) => {
    const studentClass = req.params.studentClass;
    const { search, medium, stream } = req.query; // Extract medium and stream

    const filter = {
        studentClass: studentClass
    };

    if (medium) {
        filter.medium = medium;
    }

    // Add stream filter only if studentClass is 11 or 12 AND stream is provided
    if (['11', '12'].includes(studentClass) && stream) {
        filter.stream = stream;
    }

    if (search) {
        filter.studentName = { $regex: search, $options: 'i' };
    }

    try {
        const students = await Student.find(filter);
        res.render('classDetails', {
            students,
            user: req.user,
            query: req.query // Pass query back for consistent display/filters
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// download the student data in excel sheet
router.get('/download-excel', async (req, res) => {
    try {
        const { studentClass, medium, stream } = req.query;

        const query = {};

        if (studentClass) query.studentClass = studentClass;
        if (medium) query.medium = medium;

        // Only add stream filter for class 11 or 12
        if ((studentClass === '11' || studentClass === '12') && stream) {
            query.stream = stream;
        }

        const students = await Student.find(query);

        if (!students.length) {
            return res.status(404).send('No students found for the selected criteria.');
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Students');

        worksheet.columns = [
            { header: 'S.No.', key: 'sno', width: 10 },
            { header: 'Name', key: 'studentName', width: 30 },
            { header: 'Age', key: 'studentAge', width: 10 },
            { header: 'Gender', key: 'gender', width: 15 }, // Added gender column
            { header: 'Session', key: 'session', width: 15 }, // Added session column
            { header: 'Contact No.', key: 'contactNo', width: 20 },
            { header: 'Registration No.', key: 'registrationNo', width: 20 },
            { header: 'Medium', key: 'medium', width: 15 },
            { header: 'Class', key: 'studentClass', width: 10 },
            { header: 'Stream', key: 'stream', width: 15 },
            { header: 'Total Fees', key: 'totalFees', width: 15 },
            { header: 'Fees Paid', key: 'feesPaid', width: 15 },
            { header: 'Dues', key: 'dues', width: 15 },
        ];

        students.forEach((student, index) => {
            worksheet.addRow({
                sno: index + 1,
                studentName: student.studentName,
                studentDob: student.studentDob,
                gender: student.gender, // Include gender data
                session: student.session, // Include session data
                contactNo: student.contactNo,
                registrationNo: student.registrationNo,
                medium: student.medium,
                studentClass: student.studentClass,
                stream: student.stream || '-', // handle empty stream with a hyphen
                totalFees: student.totalFees,
                feesPaid: student.feesPaid,
                dues: student.totalFees - student.feesPaid,
            });
        });

        const filename = `Class-${studentClass || 'All'}-${medium || 'All'}${stream ? '-' + stream : ''}-students.xlsx`;

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${filename}"`
        );

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Excel export error:', err);
        res.status(500).send('Server error');
    }
});


router.get('/feeReceipt',  restrictTo(['ADMIN','ACCOUNTANT']),async (req, res) => {
    try {
        return res.render('feeReceipt', {
            errors: [],
            formdata: {},
        });
    } catch (error) {
        console.error("Error rendering fee receipt form:", error);
        return res.status(500).send("Internal Server Error");
    }
})
// .post('/feeReceipt', [
//     check('registrationNo', 'Valid registration no. is required').notEmpty().trim().escape(),
// ], async (req, res) => {
//     try {
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//             return res.status(400).render('feeReceipt', {
//                 errors: errors.array(),
//                 formdata: req.body,
//             });
//         }

//         const { receptNo, registrationNo } = req.body;
//         const result = await Fees.findOne({ receptNo, registrationNo, sName: req.user.sName });

//         if (!result) {
//             return res.status(404).render('hasFeeReceipt', {
//                 result,
//                 user: req.user,
//             });
//         }

//         return res.status(200).render('hasFeeReceipt', {
//             result,
//             user: req.user,
//         });
//     } catch (error) {
//         console.error("Error fetching fee receipt:", error);
//         return res.status(500).send("Internal Server Error");
//     }
// });


router.get('/feeReceipt/edit/:receptNo',  restrictTo(['ADMIN','ACCOUNTANT']) ,async (req, res) => {
    try {
        const receptNo = req.params.receptNo;

        const feeRecord = await Fees.findOne({ receptNo, sName: req.user.sName });

        if (!feeRecord) {
            return res.status(404).render('errorPage', {
                message: 'Receipt not found',
            });
        }

        res.render('editReceipt', {
            formdata: feeRecord,
            errors: [],
        });

    } catch (error) {
        console.error('Error fetching fee record:', error);
        res.status(500).render('errorPage', {
            message: 'Internal Server Error',
        });
    }
});

router.post('/feeReceipt/edit/:receptNo',  restrictTo(['ADMIN','ACCOUNTANT']) ,async (req, res) => {
    try {
        const { receptNo } = req.params;
        const {
            studentName,
            studentClass,
            registrationNo,
            amount,
            date,
            paymentMethod
        } = req.body;

        // const student = await Student.findOne({ registrationNo, studentName, sName: req.user.sName });
        // if (!student) {
        //     return res.status(404).render('editReceipt', {
        //         errors: [{ msg: "Student with this registration number and name does not exist." }],
        //         formdata: req.body,
        //     });
        // }

        // const feeRecord = await Fees.findOne({ receptNo, sName: req.user.sName });

        // if (!feeRecord) {
        //     return res.status(404).render('errorPage', {
        //         message: 'Original fee receipt not found',
        //     });
        // }

        // const oldAmount = feeRecord.amount;
        // const newAmount = parseFloat(amount);
        // const difference = newAmount - oldAmount;

        // const newFeesPaid = student.feesPaid + difference;

        // // Check if new feesPaid exceeds total fees
        // if (newFeesPaid > student.totalFees) {
        //     return res.status(400).render('studentFees', {
        //         errors: [{
        //             msg: `Editing to ₹${newAmount} would exceed total fees. Remaining dues: ₹${student.totalFees - student.feesPaid}.`
        //         }],
        //         formdata: req.body,
        //     });
        // }

        // // Update the fee receipt
        // await Fees.findOneAndUpdate(
        //     { receptNo, sName: req.user.sName },
        //     {
        //         studentName,
        //         studentClass,
        //         registrationNo,
        //         amount: newAmount,
        //         date,
        //         paymentMethod
        //     },
        //     { new: true }
        // );

        // // Update student's feesPaid
        // await Student.findOneAndUpdate(
        //     { registrationNo, sName: req.user.sName },
        //     { $set: { feesPaid: newFeesPaid } }
        // );

        const student = await Student.findOne({ registrationNo, studentName, sName: req.user.sName });
        if (!student) {
            return res.status(404).render('editReceipt', {
                errors: [{ msg: "Student with this registration number and name does not exist." }],
                formdata: req.body,
            });
        }

        const feeRecord = await Fees.findOne({ receptNo, sName: req.user.sName });
        if (!feeRecord) {
            return res.status(404).render('errorPage', {
                message: 'Original fee receipt not found',
            });
        }

        const oldAmount = feeRecord.amount;
        const newAmount = parseFloat(amount);
        const difference = newAmount - oldAmount;

        const isCurrentClass = student.studentClass === studentClass;

        if (isCurrentClass) {
            // Check if new feesPaid exceeds total fees in Student model
            const updatedFeesPaid = student.feesPaid + difference;
            if (updatedFeesPaid > student.totalFees) {
                return res.status(400).render('editReceipt', {
                    errors: [{
                        msg: `Editing to ₹${newAmount} would exceed total fees. Remaining dues: ₹${student.totalFees - student.feesPaid}.`
                    }],
                    formdata: req.body,
                });
            }

            // Update student's feesPaid
            await Student.updateOne(
                { registrationNo, sName: req.user.sName },
                { $set: { feesPaid: updatedFeesPaid } }
            );

        } else {
            // Update SessionHistory instead
            const history = await sessionHistory.findOne({ registrationNo, className: studentClass, sName: req.user.sName });

            if (!history) {
                return res.status(404).render('editReceipt', {
                    errors: [{ msg: "Session history not found for this class." }],
                    formdata: req.body,
                });
            }

            const updatedFeesPaid = history.feesPaid + difference;
            if (updatedFeesPaid > history.totalFees) {
                return res.status(400).render('editReceipt', {
                    errors: [{
                        msg: `Editing to ₹${newAmount} would exceed total fees for this class. Remaining dues: ₹${history.totalFees - history.feesPaid}.`
                    }],
                    formdata: req.body,
                });
            }

            // Update SessionHistory feesPaid
            await sessionHistory.updateOne(
                { registrationNo, className: studentClass, sName: req.user.sName },
                { $set: { feesPaid: updatedFeesPaid } }
            );
        }

        // Update the fee receipt (common for both)
        await Fees.updateOne(
            { receptNo, sName: req.user.sName },
            {
                studentName,
                studentClass,
                registrationNo,
                amount: newAmount,
                date,
                paymentMethod
            }
        );



        res.redirect('/students/feeReceipt');

    } catch (error) {
        console.error('Error updating fee record:', error);
        res.status(500).render('errorPage', {
            message: 'Internal Server Error',
        });
    }
});


router.post('/allTransactions', [
    check('registrationNo', 'Registration Number is required').notEmpty().trim().escape()
],  restrictTo(['ADMIN','ACCOUNTANT']) ,async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // If validation fails, re-render the page with errors
            return res.status(400).render('allTransactions', {
                errors: errors.array(),
                transactions: [], // No transactions to display on error
                formdata: req.body
            });
        }

        const { registrationNo } = req.body;
        const transactions = await Fees.find({ registrationNo, sName: req.user.sName }).sort({ receptNo: -1 }); // Sort by date for better presentation

        if (!transactions.length) {
            return res.status(404).render('allTransactions', {
                transactions,
            });
        }

        return res.status(200).render('allTransactions', {
            transactions,
        });

    } catch (error) {
        console.error("Error fetching all transactions:", error);
        return res.status(500).send("Internal Server Error");
    }
}).get('/allTransactions',  restrictTo(['ADMIN','ACCOUNTANT']) ,async (req, res) => {
    try {
        // When accessed via GET, just render the form without transactions
        return res.render('allTransactions', {
            errors: [],
            transactions: [], // Empty array for initial load
            formdata: {} // Empty object for initial load
        });
    } catch (error) {
        console.error("Error rendering all transactions form:", error);
        return res.status(500).send("Internal Server Error");
    }
});

router.get('/studentFees/receipt/:receptNo', restrictTo(['ADMIN','ACCOUNTANT']) , async (req, res) => {
    try {
        const { receptNo } = req.params;

        const result = await Fees.findOne({ receptNo, sName: req.user.sName });

        return res.render('hasFeeReceipt', {
            result,
            user: req.user,
        });
    } catch (error) {
        console.error("Error fetching receipt by receptNo:", error);
        return res.status(500).send("Internal Server Error");
    }
});

router.get('/feeReceipt/daywise',  restrictTo(['ADMIN','ACCOUNTANT']) , async (req, res) => {
    try {
        const students = await Student.aggregate([
            {
                $match: {
                    sName: req.user.sName,
                    studentClass: { $ne: 'Passout' }
                }
            },
            {
                $addFields: {
                    groupKey: {
                        $cond: [
                            { $in: ['$studentClass', ['11', '12']] },
                            { $concat: ['$medium', '_', '$studentClass', '_', '$stream'] },
                            { $concat: ['$medium', '_', '$studentClass'] }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: '$groupKey',
                    students: { $push: '$$ROOT' }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);
        if (!students) {
            return res.render('daywise-transaction.ejs', {
                result: null,
            })
        }

        return res.render('daywise-transaction.ejs', {
            result: null,
            students,
        })
    } catch (error) {
        return res.status(500).send("Internal Server Error")
    }
})
    .post('/feeReceipt/daywise',  restrictTo(['ADMIN','ACCOUNTANT']) ,async (req, res) => {
        try {

            const { date } = req.body;
            const result = await Fees.find({ date });
            console.log(result)
            return res.status(200).render('daywise-transaction.ejs', {
                result,
                students:null,
            })
        } catch (error) {
            return res.status(500).send('Internal Error')
        }
    })

router.get('/edit/:registrationNo',  restrictTo(['ADMIN']) ,async (req, res) => {
    try {
        const student = await Student.findOne({ registrationNo: req.params.registrationNo, sName: req.user.sName });
        if (!student) {
            // Redirect or render an error page if student is not found
            return res.status(404).render('errorPage', { message: 'Student not found.' });
        }

        res.render('editStudent', {
            student,
            errors: [], // Pass an empty errors array for initial load
        });

    } catch (error) {
        console.error("Error fetching student for edit:", error);
        res.status(500).send("Server Error");
    }
})
    .post('/edit/:registrationNo', restrictTo(['ADMIN']) , [
        // Add validations for gender and session for the edit route as well
        check('studentName', 'Name should be of at least 2 characters').isLength({ min: 2 }).trim().escape(),
        check('fatherName', "Father's name should be of at least 2 characters").isLength({ min: 2 }).trim().escape(),
        check('motherName', "Mother's name should be of at least 2 characters").isLength({ min: 2 }).trim().escape(),
        check('address', "Address should be of at least 10 characters").isLength({ min: 10 }).trim().escape(),
        check('gender', 'Gender is required and must be Male, Female, or Other').isIn(['Male', 'Female', 'Other']).notEmpty(),
        check('studentDob', 'Dob is required'),
        check('studentClass', 'Invalid Class selected').notEmpty(),
        check('medium', 'Medium is required').notEmpty().isIn(['Hindi', 'English']),
        check('stream').custom((value, { req }) => {
            if (['11', '12'].includes(req.body.studentClass) && !value) {
                throw new Error('Stream is required for Class 11 and 12');
            }
            return true;
        }).optional({ checkFalsy: true }),
        check('contactNo', 'Contact number must be exactly 10 digits').isLength({ min: 10, max: 10 }).isNumeric(),
        // registrationNo should not be changed as it's readonly and used for identification
        // check('registrationNo', 'Registration Number is required and cannot be empty').isString().notEmpty(),
        check('totalFees', 'Total fees must be a non-negative number').isFloat({ min: 0 }),
        check('feesPaid').custom((value, { req }) => {
            if (parseFloat(value) > parseFloat(req.body.totalFees)) {
                throw new Error('Fees paid cannot exceed total fees');
            }
            if (parseFloat(value) < 0) {
                throw new Error('Fees paid cannot be negative');
            }
            return true;
        }),
        check('session', 'Session is required and must be in YYYY-YY format (e.g., 2023-24)').matches(/^\d{4}-\d{2}$/).trim().escape(),
    ], async (req, res) => {

        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            const student = await Student.findOne({ registrationNo: req.params.registrationNo, sName: req.user.sName }); // Fetch student data again for re-rendering
            return res.status(400).render('editStudent', {
                errors: errors.array(),
                student: { ...student.toObject(), ...req.body } // Merge existing student data with submitted form data to retain valid fields
            });
        }

        try {
            const { registrationNo } = req.params; // Use params for the lookup, body for updated data
            let updatedData = req.body;

            // Ensure stream is set to null if class is not 11 or 12
            if (!['11', '12'].includes(updatedData.studentClass)) {
                updatedData.stream = null;
            }

            const student = await Student.findOneAndUpdate({ registrationNo: registrationNo, sName: req.user.sName }, updatedData, { new: true });

            if (!student) {
                return res.status(404).render('errorPage', { message: 'Student not found for update.' });
            }

            res.status(200).render('home', {
                user: req.user,
                msg: `Data of ${student.studentName} Updated Successfully`,
                message:null,
                danger:null,
            });

        } catch (error) {
            console.error("Error updating student:", error);
            res.status(500).send("Server Error");
        }
    });

router.get('/delete/:registrationNo',  restrictTo(['ADMIN','ACCOUNTANT']) ,async (req, res) => {
    try {
        const deletedStudent = await Student.findOneAndDelete({ registrationNo: req.params.registrationNo, sName: req.user.sName });
        let msg = 'Student data deleted successfully';
        if (deletedStudent) {
            msg = `Data of ${deletedStudent.studentName} Deleted Successfully`;
        } else {
            msg = 'No student found with that registration number.';
        }
        // res.render('home', {
        //     user: req.user,
        //     msg: msg,
        // });
        res.redirect(`/students/classes/${deletedStudent.studentClass}?medium=${deletedStudent.medium}`)
    } catch (error) {
        console.error("Error deleting student:", error);
        res.status(500).send("Internal Server Error");
    }
});

router.post('/delete-multiple/:studentClass/:medium/:stream?',  restrictTo(['ADMIN']) ,async (req, res) => {
    try {
        const { studentClass, medium, stream } = req.params;
        const registrationNos = req.body.registrationNos; // Array of selected IDs
        console.log(registrationNos)
        if (!registrationNos || registrationNos.length === 0) {
            return res.send('No students selected.');
        }

        let query = {
            studentClass,
            medium,
            sName: req.user.sName
        };

        if (['11', '12'].includes(studentClass) && stream) {
            query.stream = stream;
        }

        const students = await Student.find(query)
        console.log(students)

        await Student.deleteMany({
            registrationNo: { $in: registrationNos },
            sName: req.user.sName, // Optional: restrict by logged-in user's school
        });

        // Redirect to the classes page or wherever you want
        // res.redirect(`/students/classes/${students[0].studentClass}?medium=${students[0].medium}&stream=${(students[0].studentClass === '11' || students[0].studentClass === '12') ? `&stream=${students[0].stream}` : ''}`);
        res.redirect('/students/allstudents');
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
})

router.get('/delete-multiple/:studentClass/:medium/:stream?',  restrictTo(['ADMIN']) ,async (req, res) => {
    const { studentClass, medium, stream } = req.params;

    let query = {
        studentClass,
        medium,
        sName: req.user.sName
    };

    if (['11', '12'].includes(studentClass) && stream) {
        query.stream = stream;
    }

    const students = await Student.find(query);

    console.log(students)
    res.render('delete-multiple', { students });
});

router.get('/details/:registrationNo', async (req, res) => {
    const { registrationNo } = req.params;
    try {
        const student = await Student.findOne({ registrationNo });
        if (!student) {
            return res.status(404).render('errorPage', { message: 'Student details not found.' });
        }
        return res.status(200).render('studentDetail.ejs', {
            student,
        });
    } catch (error) {
        console.error("Error Fetching student details:", error);
        res.status(500).send("Internal Server Error");
    }
});

//upload excel data 
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// GET upload form page
router.get('/upload', (req, res) => {
    res.render('upload'); // Ensure views/upload.ejs exists
});

// POST upload and process Excel
// POST upload and process Excel
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('No file uploaded.');

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawData = xlsx.utils.sheet_to_json(sheet);

        fs.unlinkSync(req.file.path); // Delete the uploaded file after processing

        const students = rawData.map(row => {
            // Handle possible variations in field names
            const rawFatherName = row["Father Name"] || row["Father's Name"];
            const rawMotherName = row["Mother Name"] || row["Mother's Name"];

            return {
                studentName: row['Name']?.trim() || 'N/A',
                fatherName: rawFatherName?.trim() || 'N/A',
                motherName: rawMotherName?.trim() || 'N/A',
                gender: row['Gender']?.trim() || 'N/A',
                studentDob,
                studentClass: row['Class']?.toString().trim() || 'N/A',
                stream: row['Stream']?.trim() || 'N/A',
                medium: row['Medium']?.trim() || 'N/A',
                contactNo: row['Contact No.']?.toString().trim() || 'N/A',
                registrationNo: row['Registration No.']?.toString().trim() || 'N/A',
                totalFees: isNaN(Number(row['Total Fees'])) ? 0 : Number(row['Total Fees']),
                feesPaid: isNaN(Number(row['Fees Paid'])) ? 0 : Number(row['Fees Paid']),
                dues: isNaN(Number(row['Dues'])) ? 0 : Number(row['Dues']),
                session: row['Session']?.trim() || 'N/A',
                sName: req.user?.sName || 'Unknown'
            };
        });


        const validStudents = students.filter(s =>
            s.studentName &&
            s.gender &&
            s.studentDob &&
            s.studentClass &&
            s.medium &&
            s.contactNo &&
            s.registrationNo &&
            typeof s.totalFees === 'number' &&
            s.session &&
            s.sName
        );

        if (validStudents.length === 0) {
            return res.status(400).send('Excel file is missing required fields or data is invalid.');
        }

        const existingRegNos = await Student.find({
            registrationNo: { $in: validStudents.map(s => s.registrationNo) },
            sName: req.user?.sName || 'Unknown'
        }).distinct('registrationNo');

        const newStudents = validStudents.filter(
            s => !existingRegNos.includes(s.registrationNo)
        );

        if (newStudents.length === 0) {
            return res.status(400).send('All students in the file already exist in the database.');
        }

        await Student.insertMany(newStudents);
        return res.send(`${newStudents.length} students inserted successfully.`);

    } catch (err) {
        console.error('Upload Error:', err);
        res.status(500).send('Server error while processing Excel data.');
    }
});

router.get('/edit-total-fees', restrictTo(['ADMIN','ACCOUNTANT']) , async (req, res) => {
    const { medium, studentClass, stream } = req.query;
    let students = null;

    // If query params are available, auto-fetch students
    if (medium && studentClass) {
        const filter = { medium, studentClass };
        if (['11', '12'].includes(studentClass) && stream) {
            filter.stream = stream;
        }

        students = await Student.find(filter);
    }

    res.render('edit-total-fees-form', { students, queryParams: { medium, studentClass, stream } });
});


// POST to update total fees
router.post('/update-total-fees', restrictTo(['ADMIN','ACCOUNTANT']) , async (req, res) => {
    try {
        const { medium, studentClass, stream, totalFee } = req.body;
        console.log(totalFee)
        const filter = { medium, studentClass };
        if (['11', '12'].includes(studentClass) && stream) {
            filter.stream = stream;
        }

        const result = await Student.updateMany(filter, {
            $set: { totalFees: parseFloat(totalFee) }
        });

        // res.send(`✅ Updated totalFee to ₹${totalFee} for ${result.modifiedCount} students.`);
        res.redirect('/students/allstudents')
    } catch (err) {
        console.error(err);
        res.status(500).send("❌ Error updating bulk fees.");
    }
});

router.get('/passout', async (req, res) => {
    try {
        return res.status(200).render('passoutForm.ejs')
    } catch (error) {
        res.status(500).send("❌ Server Error.");
    }
})
    .post('/passout', async (req, res) => {
        try {

            const { session, studentClass, stream } = req.body;
            const students = await Student.find({ session, studentClass, stream, sName: req.user.sName }).sort({ registrationNo: 1 })

            console.log(students)

            res.render('passoutStudents', {
                students,
            });
        } catch (error) {
            console.error('Error fetching passout students:', err);
            res.status(500).send('Internal Server Error');
        }
    })

module.exports = router;