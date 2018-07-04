var express = require("express");
var router = express.Router();
var passport = require("passport");
var User = require("../models/user");
var Campground = require("../models/campground");
var async = require("async");
var nodemailer = require("nodemailer");
var crypto = require("crypto");

// ROOT ROUTE(LANDING)
router.get("/", function(req, res){
    res.render("landing");
});

//REGISTER FORM ROUTE
router.get("/register", function(req, res){
    res.render("register", {page: 'register'}); 
});

//SIGNUP ROUTE
//handle sign up logic
router.post("/register", function(req, res){
    var newUser = new User({
            username: req.body.username,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            avatar: req.body.avatar
        });
    if(req.body.adminCode === "supersecretcode"){ // should be env variable, or manually set admins
        newUser.isAdmin = true;
    }
    User.register(newUser, req.body.password, function(err, user){
        if(err){
            console.log(err);
            return res.render("register", {error: err.message});
        }
        passport.authenticate("local")(req, res, function(){
           req.flash("success", "Successfully Signed Up! Nice to meet you " + req.body.username);
           res.redirect("/campgrounds"); 
        });
    });
});

//LOGIN ROUTE
router.get("/login", function(req, res){
    res.render("login", {page: 'login'}); 
});

//login logic route
router.post("/login", passport.authenticate("local",
    {
        successRedirect: "/campgrounds",
        failureRedirect: "/login"
    }), function(req, res){
});

//LOGOUT ROUTE
router.get("/logout", function(req, res){
    req.logout();
    req.flash("success", "You are now logged out!");
    res.redirect("/campgrounds");
});


///////////needs to be refactored////////////
// USER PROFILE ROUTE
router.get("/users/:id", function(req, res){
   User.findById(req.params.id, function(err, foundUser){
       if(err){
           req.flash("error", "Error while finding the user.");
           return res.redirect("/");
       }
      Campground.find().where("author.id").equals(foundUser._id).exec(function(err, campgrounds){
          if(err){
              req.flash("error", "Error while finding owner.");
              return res.redirect("/");
          }
          res.render("users/show", {user: foundUser, campgrounds: campgrounds});
      })
   });
});

// FORGOT PASSWORD ROUTE
router.get("/forgot", function(req, res){
    res.render("forgot");
})
//forgot password middleware
router.post('/forgot', function(req, res, next) {
    async.waterfall([
        function(done) {
            crypto.randomBytes(20, function(err, buf) {
                var token = buf.toString('hex');
                done(err, token);
            });    
        },
        function(token, done){
            User.findOne({email: req.body.email}, function(err, user) {
                if(!user) {
                    req.flash("error", "No account with that email address exists");
                    return res.redirect('/forgot');
                }
                
                user.resetPasswordToken = token;
                user.resetPasswordExpires = Date.now() + 3600000 // 1 hour token expiration
                
                user.save(function(err){
                    done(err, token, user);
                });
            });
        },
        function(token, user, done) {
            var smtpTransport = nodemailer.createTransport({
                service: "Gmail", // Email service provider option
                auth: {
                    user: "admin@gmail.com", // Admin email address
                    pass: "GMAILPW"    // Password should be changed to an environment variable
                    /* install dotenv as a dev depenency and require it. Create ".env" file containing the variable
                     * and add ".env" to ".gitignore" if pushing to a public repository on github.
                     *
                     * Alternatively, input into the host terminal, "export GMAILPW=yourpwhere"
                     * then set "pass: GMAILPW"
                     */
                }
            });
            var mailOptions = {
                to: user.email,
                from: 'admin@gmail.com',
                subject: 'Node.js Password Reset',
                text: 'You are receiving this because of a request to reset your password. ' +
                'Please click this link or paste it into your browser:\n\n' +
                'http://' + req.headers.host + '/reset/' + token + '\n\n' +
                'If you did not request this, please ignore this email.'
            };
            smtpTransport.sendMail(mailOptions, function(err) {
                console.log('mail sent');
                req.flash('success', 'An e-mail has been sent to ' + user.email +
                ' with further instructions.');
                done(err, 'done');
            });
        }
    ], function(err) {
        if (err) return next(err);
        res.redirect('/forgot');
    });
});

router.get('/reset/:token', function(req, res) {
  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/forgot');
    }
    res.render('reset', {token: req.params.token});
  });
});

router.post('/reset/:token', function(req, res) {
  async.waterfall([
    function(done) {
      User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
        if (!user) {
          req.flash('error', 'Password reset token is invalid or has expired.');
          return res.redirect('back');
        }
        if(req.body.password === req.body.confirm) {
          user.setPassword(req.body.password, function(err) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;

            user.save(function(err) {
              req.logIn(user, function(err) {
                done(err, user);
              });
            });
          })
        } else {
            req.flash("error", "Passwords do not match.");
            return res.redirect('back');
        }
      });
    },
    function(user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'Gmail', 
        auth: {
          user: 'admin@gmail.com', // Admin email address
          pass: "GMAILPW"  // Password should be changed to an environment variable
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'admin@gmail.com',
        subject: 'Your password has been changed',
        text: 'Hello,\n\n' +
          'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        req.flash('success', 'Success! Your password has been changed.');
        done(err);
      });
    }
  ], function(err) {
    res.redirect('/campgrounds');
  });
});


module.exports = router;