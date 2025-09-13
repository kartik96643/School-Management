const JWT = require("jsonwebtoken");

const SECRET = process.env.SECRET;

function GenerateToken(user){
    const payload = {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        sName:user.sName,
        sAddress:user.sAddress,
    }
    const token = JWT.sign(payload, SECRET, { expiresIn: '1h' });
    return token;
}


const validateToken = async(token)=>{
    const payload = await JWT.verify(token,SECRET);
    if(!payload) throw new Error("Invalid token");
    return payload;
}

module.exports = {
    GenerateToken, validateToken,
}