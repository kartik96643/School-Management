const express = require('express');
const ADMIN = require('../models/admin');
const { check, validationResult } = require('express-validator')
const { createHmac, randomBytes } = require("crypto");
const { sendResetEmail } = require('../services/mailer');
const { restrictTo } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', [
    check('name', 'Name length should be 2 to 30 characters').isLength({ min: 2, max: 30 }),
    check('email', 'Email length should be 10 to 30 characters').isEmail().isLength({ min: 10, max: 30 }),
    check('password', 'Password length should be 8 to 10 characters').isLength({ min: 8, max: 10 }),
        check('role', 'Role is required').notEmpty().isIn(['ADMIN','NORMAL','ACCOUNTANT']),
    check('sName', 'School Name length should be atleast 10 characters').isLength({ min: 10 }),
    check('sAddress', 'Address length should be atleast 10 characters').isLength({ min: 10 }),

], async (req, res) => {

    // console.log("Signup route hit");
    const errors = validationResult(req);
    // console.log(errors)
    if (!errors.isEmpty()) {
        // console.log("Validation errors:", errors.array());
        return res.status(400).render('adminSignup', {
            errors: errors.array(),
            formdata: req.body,
        })
    }
    const { name, email, password , sName, sAddress, role} = req.body;
    // console.log(name);
    // if(!name || !email || !password){
    //     return res.status(400).json("All fields are mandatory");
    // }
    try {

        const admin = await ADMIN.findOne({ email });
        // console.log(admin)
        if (admin) {
            return res.render('adminSignup', {
                errors: [{ msg: "User with this email already exists.", param: 'email' }],
                formdata: req.body,
            })
        }

        const user = await ADMIN.create({
            name: name,
            email: email,
            password: password,
            sName:sName,
            role:role,
            sAddress:sAddress,
        })

        return res.status(200).render('adminSignin', {
            errors: [],
            formdata: [],
        });

    } catch (error) {
        console.log(error)
        return res.status(500).render('adminSignup', {
            errors: [{ msg: "Error in Creating User" }],
            formdata: req.body,
        })
    }

})
    .get('/signup', async (req, res) => {
    try {
        return res.render('adminSignup', {
            errors: [],
            formdata: [],
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send("Error fetching Signup form");
    }
});


router.post('/signin', [
    check('email', 'Valid email is required').isEmail(),
    check('password', 'Password is required').notEmpty(),
], async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('adminSignin', {
            errors: errors.array(),
            formdata: req.body,
        })
    }
    const { email, password } = req.body;
    // if(!email || !password){
    //     return res.redirect('/admin/signin',{
    //         msg:"All fields are mandatory",
    //     })
    // }
    try {

        const admin = await ADMIN.findOne({ email });
        if (!admin) {
            return res.status(401).render('adminSignin', {
                errors: [{ msg: "User with this email does not exists", param: 'email' }],
                formdata: req.body,
            })
        }

        const { token, user } = await ADMIN.matchPassAndGenerateToken(email, password);
        // console.log(user)
        // console.log(token)
        // console.log(token,user)

        res.cookie('token', token);

        // return res.status(200).render('home', {
        //     user,
        //     msg:"Successfully login",
        // })
        
        return res.redirect('/?message=Logged in successfully')
    } catch (error) {
        return res.status(401).render('adminSignin', {
            errors: [{ msg: 'Invalid Credentials' }],
            formdata: req.body,
        })
    }
})
   .get('/signin', async (req, res) => {
    try {
        return res.render('adminSignin', {
            errors: [],
            formdata: [],
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send("Error fetching Signin form");
    }
})

router.get('/logout', async (req, res) => {
    try {
        res.clearCookie("token");
        return res.redirect('/');
    } catch (error) {
        console.error(error);
        return res.status(500).send("Error comes in Logout Process.");
    }
});


router.get('/reset-password', (req, res) => {
    try {
        res.render('reset-password-request', {
            error: null,
            formdata: null,
            message: null,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send("Error fetching password reset form");
    }
});



router.post('/reset-password', async (req, res) => {
    try{
    const { email } = req.body;
    const admin = await ADMIN.findOne({ email });
    if (!admin) {
        return res.render('reset-password-request', {
            error: 'Email not found',
            message: null
        });
    }

    const token = randomBytes(32).toString('hex');
    const expiry = Date.now() + 3600000; // 1 hour

    admin.resetToken = token;
    admin.resetTokenExpiry = expiry;
    await admin.save();

    // console.log(req.headers.host)
    const resetLink = `https://e4ae-2409-4090-a023-4401-cfbf-c048-5693-412e.ngrok-free.app/admin/reset-password/${token}`;
    await sendResetEmail(email, resetLink);

    res.render('reset-password-request', {
        error: null,
        message: 'Reset link has been sent to your email'
    });
}catch(error){
     console.error(error);
        res.status(500).render('reset-password-request', {
            error: 'Internal server error. Please try again later.',
            message: null
        });
}

});



// Handle new password submission
router.post('/reset-password/:token', async (req, res) => {
    const token = req.params.token;
    const { password } = req.body;

    try {
        const admin = await ADMIN.findOne({
            resetToken: token,
            resetTokenExpiry: { $gt: Date.now() }
        });

        if (!admin) {
            return res.render('reset-password-request', {
                error: 'Token has expired or is invalid.',
                message: null
            });
        }

        // Set new password
        // const salt = randomBytes(16).toString('hex');
        // const hashedPassword = createHmac('sha256', salt).update(password).digest('hex');

        // admin.salt = salt;
        // admin.password = hashedPassword;
        admin.password = password;
        admin.resetToken = undefined;
        admin.resetTokenExpiry = undefined;

        await admin.save();

        res.render('reset-password-request', {
            error: null,
            message: 'Password has been reset successfully. You can now log in.'
        });

    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
});


// Show the reset password form
router.get('/reset-password/:token', async (req, res) => {
    const token = req.params.token;

    try {
        const admin = await ADMIN.findOne({
            resetToken: token,
            resetTokenExpiry: { $gt: Date.now() }
        });

        if (!admin) {
            return res.render('reset-password-request', {
                error: 'Password reset token is invalid or has expired.',
                message: null
            });
        }

        // If token is valid, render the password reset form
        res.render('reset-password-form', {
            token
        });

    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
});

router.get('/profile/:id', restrictTo(['ADMIN','NORMAL','ACCOUNTANT']),async (req, res) => {
    try {

        const profile = await ADMIN.findById(req.params.id);
        if (!profile) {
            return res.status(404).render('adminSignin', {
                errors:[],
                formdata:[],
            });
        }

        return res.render('profile', { profile });
    } catch (error) {
        console.error(error);
        return res.status(500).send("Error fetching profile data. Please try again later.")
    }
});



module.exports = router;