var express = require("express");
var router = express.Router();
var passport = require("passport");
var User = require("../models/user");

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
    var newUser = new User({username: req.body.username});
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

module.exports = router;