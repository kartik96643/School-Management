
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  try {
    const message = req.query.message || null
    const danger = req.query.danger || null
    res.render('home', {
      user: req.user,
      msg: null,
      message: message,
      danger:danger,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error> Pleasy try again later.");
  }
});

module.exports = router;