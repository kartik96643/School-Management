const express = require('express');
const Teacher = require('../models/teacher');
const { check, validationResult, body } = require('express-validator');
const { restrictTo } = require('../middleware/auth')

const router = express.Router();

router.post('/register', restrictTo(['ADMIN', 'NORMAL']), [
    check('empId', "Employee Id should be atleast 5 characters").isLength({min:5}),
    check('jobTitle', 'Title should be at least 2 characters').isLength({ min: 2 }),
    check('teacherName', 'Name should be at least 2 characters').isLength({ min: 2 }),
    check('teacherEmail', 'Valid Email is required').isEmail().notEmpty(),
    check('teacherContact', 'Valid Phone number is required').isLength({ min: 10, max: 10 }).isNumeric(),
    check('teacherSalary', 'Salary must be a positive number').isFloat({ min: 1 }),
    check('gender', 'Gender is required').notEmpty(),
    check('medium')
        .custom((value, { req }) => {
            const jobTitle = req.body.jobTitle?.trim().toLowerCase();
            if (jobTitle === 'teacher' && (!value || value.trim() === '')) {
                throw new Error('Medium is required for Teacher');
            }
            return true;
        }),

    // Only required if jobTitle is teacher
    body('teacherSubject')
        .custom((value, { req }) => {
            if (req.body.jobTitle.trim().toLowerCase() === 'teacher' && (!value || value.trim() === '')) {
                throw new Error('Subject is required for Teacher');
            }
            return true;
        }),

    body('teacherClass')
        .custom((value, { req }) => {
            if (req.body.jobTitle.trim().toLowerCase() === 'teacher' && (!value || value.trim() === '')) {
                throw new Error('Class is required for Teacher');
            }
            return true;
        }),

], async (req, res) => {
    try {
        console.log(req.body)
        req.body.jobTitle = req.body.jobTitle.trim().toLowerCase(); // Normalize jobTitle

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('teacher', {
                user: req.user,
                errors: errors.array(),
                formdata: req.body,
            });
        }

        const {
            empId,jobTitle, teacherName, teacherEmail,
            teacherContact, teacherClass, teacherSalary,
            teacherSubject, gender, medium
        } = req.body;

        const existing = await Teacher.findOne({ teacherEmail, sName: req.user.sName });
        if (existing) {
            return res.render('teacher', {
                user: req.user,
                errors: [{ msg: "Teacher with this email already exists." }],
                formdata: req.body,
            });
        }

        const newTeacher = {
            empId,
            jobTitle,
            teacherName,
            teacherEmail,
            teacherContact,
            teacherSalary,
            gender,
            sName:req.user.sName,

        };

        if (jobTitle === 'teacher') {
            newTeacher.teacherSubject = teacherSubject;
            newTeacher.teacherClass = teacherClass;
            newTeacher.medium = medium;
        }

        await Teacher.create(newTeacher);

        return res.render('home', {
            user: req.user,
            msg: "Staff Added Successfully",
            message:null,
            danger:null,
            // errors:[{msg:"Staff Added Succesfully"}],
            // formdata:[],
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
}).get('/register', restrictTo(['ADMIN', 'NORMAL']), async (req, res) => {
    try {
        return res.render('teacher', {
            user: req.user,
            errors: [],
            formdata: [],
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Internal Server Error');
    }
});



// router.get('/list', restrictTo(['ADMIN']), async (req, res) => {
//     try {
//         const result = await Teacher.aggregate([
//             {
//     $group: {
//         _id: "$teacherSubject",
//         teacherCount: { $sum: 1 },
//     },
// },
// {
//     $project: {
//         _id: 0,
//         teacherSubject: "$_id",
//         teacherCount: 1,
//     },
// },
// {
//     $sort: { teacherSubject: 1 },
//             },
//         ]);

//         return res.render('teacherAndSubjectData', {
//             data: result,
//             user: req.user,
//         });
//     } catch (error) {
//         console.error(error);
//         return res.status(500).send('Internal Server Error');
//     }
// });

router.get('/list', restrictTo(['ADMIN']), async (req, res) => {
    try {
        const result = await Teacher.aggregate([
            {
                $match: {
                    sName: req.user.sName
                }
            },
            {
                $group: {
                    _id: "$jobTitle",
                    staffCount: { $sum: 1 },
                },
            },
            {
                $project: {
                    _id: 0,
                    jobTitle: "$_id",
                    staffCount: 1,
                },
            },
            {
                $sort: { jobTitle: 1 },
            },
        ]);

        res.render('staffList', { data: result, user: req.user });
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});

router.get('/staff/details/:jobTitle', restrictTo(['ADMIN']), async (req, res) => {
    const jobTitle = req.params.jobTitle.toLowerCase();

    try {
        if (jobTitle === 'teacher') {
            // Group teachers by subject
            const result = await Teacher.aggregate([
                { $match: { jobTitle: 'teacher', sName:req.user.sName } },
                {
                    $group: {
                        _id: "$teacherSubject",
                        teacherCount: { $sum: 1 },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        teacherSubject: "$_id",
                        teacherCount: 1,
                    },
                },
                {
                    $sort: { teacherSubject: 1 },
                }
            ]);

            return res.render('teacherAndSubjectData', {
                data: result,
                user: req.user,
            });
        } else {
            const staffList = await Teacher.find({ jobTitle: jobTitle.toLowerCase(), sName:req.user.sName });
            res.render('genericStaffDetails', {
                jobTitle,
                staff: staffList,
                user: req.user
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});



router.get('/details/:teacherSubject', restrictTo(['ADMIN']), async (req, res) => {
    try {
        let teachers = await Teacher.find({teacherSubject:req.params.teacherSubject, sName:req.user.sName});

        const { sort } = req.query;

        if (sort === 'nameAsc') {
            teachers.sort((a, b) => a.teacherName.localeCompare(b.teacherName));
        } else if (sort === 'nameDesc') {
            teachers.sort((a, b) => b.teacherName.localeCompare(a.teacherName));
        }

        return res.render('teacherDetail', {
            teachers,
            user: req.user,
            query: req.query,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Internal Server Error');
    }
});

router.get('/edit/:teacherEmail', restrictTo(['ADMIN']), async (req, res) => {
    try {
        const teacher = await Teacher.findOne({ teacherEmail: req.params.teacherEmail, sName:req.user.sName });
        if (!teacher) {
            return res.status(401).render('teacherDetail');
        }

        res.render('editTeacher', {
            teacher,
        });
    } catch (error) {
        res.status(500).send("Server Error");
    }
}).post('/edit/:teacherEmail', restrictTo(['ADMIN']), async (req, res) => {
    try {
        const { teacherEmail } = req.body;
        const updatedData = req.body;

        const teacher = await Teacher.findOneAndUpdate({ teacherEmail, sName:req.user.sName }, updatedData);
        res.status(200).render('home', {
            user: req.user,
            msg: `Data of ${teacher.teacherName} Updated Successfully`,
            message:null,
            danger:null,
        });
    } catch (error) {
        res.status(500).send("Server Error");
    }
});

router.get('/delete/:teacherEmail', restrictTo(['ADMIN']), async (req, res) => {
    try {
        await Teacher.findOneAndDelete({ teacherEmail: req.params.teacherEmail, sName:req.user.sName });
        res.render('home', {
            user: req.user,
            msg: `Data Deleted Successfully`,
            message:null,
            danger:null,
        });
    } catch (error) {
        console.error("Error deleting teacher:", error);
        res.status(500).send("Internal Server Error");
    }
});

router.get('/details/email/:teacherEmail', restrictTo(['ADMIN']), async (req, res) => {
    const { teacherEmail } = req.params;
    try {
        const teacher = await Teacher.findOne({ teacherEmail, sName:req.user.sName });
        if (!teacher) return res.status(404).send("Teacher not found");

        return res.status(200).render('particularTeacherDetail.ejs', {
            teacher,
        });
    } catch (error) {
        console.error("Error Fetching teacher details:", error);
        res.status(500).send("Internal Server Error");
    }
});

module.exports = router;
