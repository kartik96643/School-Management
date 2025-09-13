const { validateToken } = require('../services/auth');

function checkCookieToken(token) {
    return async (req, res, next) => {
        const cookieToken = req.cookies[token];
        if (!cookieToken) {
            req.user = null
            return next();
        }

        try {
            const payload = await validateToken(cookieToken);
            req.user = payload;
            // console.log("checkCookieToken: req.user =", req.user);

        } catch (error) {
            console.error('Invalid token:', error);
            req.user = null;
        }

        next();

    }
};

function restrictTo(roles) {
    return function (req, res, next) {

        if (req.originalUrl.startsWith('/result/marksheet') || req.originalUrl.startsWith('/exam-timetable')) {
            return next();
        }
        
        if (!req.user) {
            return res.status(401).render('home', {
                msg: null,
            });

        }
        console.log("Authenticated User Role:", req.user?.role);


        if (!roles.includes(req.user.role)) {
            return res.status(403).render('not-authorized.ejs');
            // return res.status(403).send(("You are not Authorized to access this functionality!"));
        }

        next();
    };
}


module.exports = {
    checkCookieToken,
    restrictTo,
}