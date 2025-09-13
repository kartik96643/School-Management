const express = require('express');
const TimeTable = require('../models/timetable')

const router = express.Router();

router.post('/', async(req,res)=>{
    const {className,examType,medium,exams} = req.body;

  try {
    let existing = await TimeTable.findOne({ className, medium, examType });

    if (existing) {
      existing.exams = exams; 
      await existing.save();
    } else {
      await TimeTable.create({ className: className, medium: medium, examType: examType, exams});
    }

    res.redirect(`/exam-timetable/${className}/${medium}/${examType}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving exam timetable");
  }
})

router.get('/', async(req,res)=>{
    try {
       res.status(200).render('timetable-form.ejs',{
        user:req.user
       })
    } catch (error) {
      res.status(500).send("Error fetching timtable form")
    }
})

router.post('/view', async(req,res)=>{
    try {
        const {className, medium, examType} = req.body;
       
        const existing = await TimeTable.findOne({className,medium,examType});
        console.log(existing)
        res.status(200).render('timetable-viewer.ejs',{timetable : existing, user:req.user})
    } catch (error) {
        res.status(500).send("Error fetching timetable")
    }
})

router.get("/:className/:medium/:examType", async (req, res) => {
  try {
    const timetable = await TimeTable.findOne({ className: req.params.className, medium:req.params.medium, examType:req.params.examType });
    res.render("timetable-viewer.ejs", { timetable , user:req.user});
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching exam timetable");
  }
});

module.exports = router;