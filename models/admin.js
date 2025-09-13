const { Schema, model } = require('mongoose');
const { createHmac, randomBytes } = require("crypto");
const { GenerateToken } = require('../services/auth');
const { type } = require('os');
// const { type } = require('os');

const adminSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    sName:{
        type:String,
        required:true,
    },
    sAddress:{
        type:String,
        required:true,
    },
    role: {
        type: String,
        enum: ['ADMIN', 'NORMAL', 'ACCOUNTANT'],
        default: 'NORMAL'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date,
    },
    salt: {
        type: String,
    },
    password: {
        type: String,
        required: true,
    },
    resetToken: {
        type: String,
    },
    resetTokenExpiry: {
        type: Date,
    },
}, { timestamps: true });



adminSchema.pre('save', function (next) {
    const admin = this;
    // console.log(admin)
    // if(!password.isModified()) return null;
    if (!admin.isModified('password')) return next();

    const salt = randomBytes(16).toString();
    const hashedPassword = createHmac('sha256', salt).update(admin.password).digest('hex');

    // this.salt = salt;
    // this.password= hashedPassword;
    admin.salt = salt;
    admin.password = hashedPassword;

    next();


});

adminSchema.static('matchPassAndGenerateToken', async (email, password) => {

    if (!email || !password) throw new Error("All fields mandatory");


    try {

        const admin = await ADMIN.findOne({ email });
        if (!admin) throw new Error("User not found");


        console.log(admin)

        const salt = admin.salt;
        const hashedPassword = admin.password;
        // console.log(hashedPassword)

        const providedPassword = await createHmac('sha256', salt).update(password).digest('hex');

        if (providedPassword !== hashedPassword) throw new Error("Invalid Password");
        // console.log(admin)
        admin.lastLogin = new Date();
        
        await admin.save();
        return {
            token: GenerateToken(admin),
            user: admin
        };

    } catch (error) {
        console.log("Internal Error Occurred", error)

    }
    // const token = GenerateToken(admin);
    // return token;



})

const ADMIN = new model('admin', adminSchema);

module.exports = ADMIN;