require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { check } = require('express-validator');
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.authenticate('session'));

const uri = process.env.ATLAS_URI;
mongoose.connect(uri, {useNewUrlParser: true});

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleID: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user){
      done(err, user);
  });
});

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "https://vast-stream-95984.herokuapp.com/auth/google/home",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
function(accessToken, refreshToken, profile, cb){
  User.findOrCreate({googleID: profile.id }, function(err, user){
    return cb(err, user);
  });
}
));

// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());
// mongoose.createConnection("mongodb://localhost:27017/blogDB", {useNewUrlParser: true});

const postSchema = new mongoose.Schema({
  title: String,
 content: String,
 date: String,
 userId: String
});

const Post = new mongoose.model("Post", postSchema);

// let navArr = [];

// login related routes and authentication //
app.get("/login", function(req, res) {
  res.render("login");
});

app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

app.get("/auth/google/home",
passport.authenticate("google", {failureRedirect: "/login"}),
function(req, res){
  res.redirect("/home");
}
)

app.post("/login", function(req, res){
  const errors =[];
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });
  User.findOne({ username: req.body.username }, function (err, user) {
   if (err) {
     console.log(err);
   } if (!user) {
     errors.push({ msg: "This email has not been registered" });
     res.render("login", { errors });
   }
   else {
      req.login(user, function(err) {
        if (err) {
          errors.push({ msg: err.message });
          res.render("login", {errors});
        } else {
          passport.authenticate("local", { failureRedirect: '/login' })(req, res, function(){
          res.redirect("/home");
          });
        }
      });
    }
});
});



// signup related routes and authentication //
app.get("/signup", function(req, res) {
res.render("signup");
  });

app.post("/signup", function (req, res) {
  const errors = [];

    if (req.body.password != req.body.enteredPassword) {
      errors.push({ msg: "Password didn't match!" });
    }
    if(req.body.password.length < 6) {
    errors.push({ msg: "Password should be at least 6 characters" });
  }
    if (errors.length > 0) {
      res.render("signup", { errors });
    }
    else {
      User.register({ username: req.body.username }, req.body.password,  function (err, user) {
        if (err) {
          errors.push({ msg: err.message });
          res.render("signup", {errors});
        } else
        {
          passport.authenticate("local")(req, res, function () {
            res.render("login", {success: "successfully signedup, Login to continue."});
          });
        }
      });
    }
  });

app.get('/logout', function(req, res) {
    req.logout(function(err) {
      if (err) {
        console.log(err);
      }
      res.redirect('/login');
    });
  });


// home related routes and authentication //
app.get("/home", function(req, res) {
const randomNumber = Math.floor(Math.random()*21)+1;
const randomQuote = ("quote"+ randomNumber);

const currentTime = new Date().getHours();
let greetingText = "";

if (currentTime < 12) {
  greetingText = "Good Morning to Myself";
} else if (currentTime < 18) {
  greetingText = "Good Afternoon to Myself";
} else {
  greetingText = "Good Evening to Myself";
}

// res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stal   e=0, post-check=0, pre-check=0');

if(req.isAuthenticated()){
  res.render(randomQuote,{greetingText: greetingText});
} else {
  res.redirect("/login");
}
});




// compose related routes and authentication //
app.get("/compose", function(req, res) {
  if(req.isAuthenticated()){
    res.render("compose")
  } else {
    res.redirect("/login");
  }
});

app.post("/compose", function(req, res){
  const time = new Date();
  const post = new Post ({
      date: time,
      title: req.body.postTitle,
      content: req.body.postBody,
      userId: req.user.id
  });
  User.findById(req.user.id, function(err, foundUser){
    if(err){
      console.log(err);
    } else {
      if(foundUser){
        post.save(function(err){
          if (!err){
              res.redirect("/posts");
          }
        });
      }
    }
  });
});




// Post-pages related routes //
app.get("/posts", function(req, res) {
  if(req.isAuthenticated()){
    User.findById(req.user.id, function (err, foundUser) {
      if (err) {
        console.log(err);
      } else {
        if (foundUser) {
          Post.find({userId: foundUser._id}, function(err, posts){
            res.render("posts", {
              posts: posts
              });
          });
      }
    }
});
}   else {
    res.redirect("/login");
  }
});

app.get("/postedItems/:postId", function(req, res){
  const requestedPostId = req.params.postId;
if(req.isAuthenticated()){
  Post.findOne({_id: requestedPostId}, function(err, post){
     res.render("post", {
       title: post.title,
       content: post.content,
       date: post.date,
       requestedPostId: requestedPostId,
     });
   });
} else {
  res.redirect("/login");
}


});




// edit&&delete-posts related routes //
app.get("/edit/:postId", function(req, res){
    const requestedPostId = req.params.postId;
  if(req.isAuthenticated()){
    Post.findOne({_id: requestedPostId}, function(err, post){
       res.render("edit", {
         title: post.title,
         content: post.content,
         requestedPostId: requestedPostId,
       });
     });
  } else {
    res.redirect("/login");
  }
});

app.post("/edit/:postId", function(req, res){
    const requestedPostId = req.params.postId;
  if(req.isAuthenticated()){
    Post.findByIdAndUpdate({_id: requestedPostId}, {$set: {title: req.body.postTitle, content: req.body.postBody}}, {new:true}, function(err, post){
      if(!err){
        post.save();
        res.redirect("/posts");
      };
    });
  } else {
    res.redirect("/login");
  }
});


app.post("/delete", function (req, res) {
    const deletedPost = req.body.deletedPost;
  if(req.isAuthenticated()){
    Post.deleteOne({ _id: deletedPost }, function (err) {
      if (!err) {
        res.redirect("/posts");
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.listen(process.env.PORT || 3000, function(){
  console.log("server has started successfully ");
});
