const express = require('express');
const SessionHistory = require('../models/sessionHistory');
const Fees = require('../models/studentFees');
const { restrictTo } = require('../middleware/auth');

const router = express.Router();

// GET form page
// router.get('/', async (req, res) => {
//   try {
//     return res.render('sessionHistoryForm', {
//       user: req.user,
//     });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).send("Internal Server Error");
//   }
// });

// POST - Fetch history based on filters
// router.post('/', async (req, res) => {
//   try {
//     const { session, className, stream, medium } = req.body;
   
//     // Base query
//     const query = {
//       medium,
//       session,
//       className,
//       sName: req.user.sName
//     };

//     // Add stream conditionally for class 11 or 12
//     if (className === '11' || className === '12') {
//       query.stream = stream;
//     }

//     const data = await SessionHistory.find(query);
//     console.log(data);

//     return res.status(200).render('getSessionHistory.ejs', {
//       data,
//       user: req.user,
//     });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).send("Internal Server Error");
//   }
// });

router.get('/', async (req, res) => {
  try {
    // If no filters, show the form page
    if (!req.query.session || !req.query.className || !req.query.medium) {
      return res.render('sessionHistoryForm', {
        user: req.user,
      });
    }

    const { session, className, stream, medium } = req.query;

    const query = {
      medium,
      session,
      className,
      sName: req.user.sName
    };

    if ((className === '11' || className === '12') && stream) {
      query.stream = stream;
    }

    const data = await SessionHistory.find(query);

    return res.render('getSessionHistory.ejs', {
      data,
      user: req.user
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
});


// POST - Redirect with query params to GET route
router.post('/', async (req, res) => {
  try {
    const { session, className, stream, medium } = req.body;

    // Construct query string
    let query = `?session=${encodeURIComponent(session)}&className=${encodeURIComponent(className)}&medium=${encodeURIComponent(medium)}`;
    if (className === '11' || className === '12') {
      query += `&stream=${encodeURIComponent(stream)}`;
    }

    return res.redirect(`/sessionHistory${query}`);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
});


router.get('/edit/:registrationNo/:session/:className',restrictTo(['ADMIN','ACCOUNTANT']) ,async(req,res)=>{ 

  const student = await SessionHistory.findOne({ registrationNo: req.params.registrationNo, session:req.params.session, className: req.params.className });
  if (!student) return res.status(404).send('Student not found');
  res.render('edit-session-history', { student });
});

router.post('/edit/:registrationNo/:session/:className', restrictTo(['ADMIN','ACCOUNTANT']) , async (req, res) => {
  const {
    studentName,
    totalFees,
    promotedTo,
    grade,
    percentage,
    resultDate,
    amount,
    paymentMethod,
    date,
    
  } = req.body;

  try {
    const regNo = req.params.registrationNo;
    const sess = req.params.session;
    const cls = req.params.className;

    // 1. Fetch current feesPaid and totalFees
    const student = await SessionHistory.findOne({ registrationNo: regNo, session: sess, className:cls }).sort({receptNo:-1});
    // console.log(student)
    if (!student) return res.status(404).send('Student not found');

    const currentFeesPaid = student.feesPaid || 0;
    const currentTotalFees = parseFloat(totalFees);
    const amountToAdd = parseFloat(amount) || 0;

    // 2. Validation: Prevent overpayment
    if (currentFeesPaid + amountToAdd > currentTotalFees) {
      return res.status(400).send(`❌ Cannot add ₹${amountToAdd}. It would exceed the total fee of ₹${currentTotalFees}.`);
    }

    // 3. Proceed with update
   const updatedSessionHistory = await SessionHistory.updateOne(
      { registrationNo: regNo, session: sess, className:cls },
      {
        $set: {
          studentName,
          totalFees: currentTotalFees,
          promotedTo,
          grade,
          percentage: parseFloat(percentage),
          resultDate: new Date(resultDate)
        },
        $inc: {
          feesPaid: amountToAdd
        }
      }
    );

    if(updatedSessionHistory.modifiedCount > 0){
      const receipt = await Fees.create({
        paymentMethod: paymentMethod,
        date: date,
        registrationNo: regNo,
        studentName:studentName,
        studentClass: cls,
        sName:req.user.sName,
        amount: amountToAdd,
        sAddress: req.user.sAddress,
      })
      
    }

    // 4. Redirect to original list page
    return res.redirect(`/sessionHistory?session=${encodeURIComponent(student.session)}&className=${encodeURIComponent(student.className)}&medium=${encodeURIComponent(student.medium)}&stream=${encodeURIComponent(student.stream)}`);
  } catch (err) {
    console.error('❌ Update error:', err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;