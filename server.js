require('dotenv').config();
require("./utils.js");
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const MongoStore = require('connect-mongo')
const usersModel = require('./models/user.js');
const saltRounds = 10;
const app = express();
const port = process.env.port || 3000;

// var numPageHits = 0;
const expireTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
// var users = [];
// const node_session_secret = '9b806987-6671-4b46-ab4d-66bf0a8a41d6'

const Joi = require("joi");

/* secret information section */
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;
/* END secret section */

var {database} = include('databaseConnections');

const userCollection = database.db(mongodb_database).collection("users");

app.use(express.urlencoded({extended: false}));
app.use(express.static('public'));


var mongoStore = MongoStore.create({
	mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/sessions`,
    crypto: {
		secret: mongodb_session_secret
	}
})

app.listen(port, () => {
console.log('Listening to ' + port)
})

app.use(session({ 
    secret: node_session_secret,
	store: mongoStore, //default is memory store 
	saveUninitialized: false, 
	resave: true
}
));

app.get('/', (req, res) => {
    if (!req.session.authenticated) {
        res.send(`<button onclick="window.location.href='/signup'">Sign up</button>
        <button onclick="window.location.href='/login'">Login</button>`);
    }
    else {
        res.send(`Hello ${req.session.name}!
        <br>
        <button onclick="window.location.href='/members'">Go to Members Area</button>
        <button onclick="window.location.href='/logout'">Logout</button>`);
    }
});

app.get('/about', (req,res) => {
    var color = req.query.color;
    var bg = req.query.bg;
    res.send("<body style='background-color:"+bg+";'><h1 style='color:"+color+";'>Nicole</h1></body>");
});

// creating user to store in array
app.get('/signup', (req,res) => {
    var html = `
    create user:
    <form action='/signupSubmit' method='post'>
    <input name='name' type='text' placeholder='name'>
    <input name='email' type='text' placeholder='email'>
    <input name='password' type='password' placeholder='password'>
    <button>Submit</button>
    </form>
    `;
    res.send(html);
});

app.post('/signupSubmit', async (req,res) => {
    var name = req.body.name;
    var email = req.body.email;
    var password = req.body.password;

    const schema = Joi.object(
        {
            name: Joi.string().alphanum().max(25).required(),
            email: Joi.string().max(25).required(),
			password: Joi.string().max(20).required()
		});
        
        const validationResult = schema.validate({username, password});
        if (validationResult.error != null) {
            console.log(validationResult.error);
            res.redirect("/signup");
            return;
        }

    var hashedPassword = await bcrypt.hashSync(password, saltRounds);

    if (!name) {
        res.send(`Please enter a name!<br>
        <a href='/signup'>Try again</a>`)
    }
    else if (!email) {
        res.send(`Please enter an email!<br>
        <a href='/signup'>Try again</a>`)
    }
    else if (!password) {
        res.send(`Please enter a password!<br>
        <a href='/signup'>Try again</a>`)
    }
    else {

        // users.push({ name: name, email: email, password: hashedPassword });
        // console.log(users);
        await userCollection.insertOne({ name: name, email: email, password: hashedPassword }, (err, result) => {
            if (err) {
                console.log(err);
                res.send("Error creating user");
                return;
            }
            console.log("inserted user")
        });
        req.session.authenticated = true;
        req.session.name = name;
        req.session.email = email;
        req.session.cookie.maxAge = expireTime;
            
        
        res.redirect('/members');
    }
});

app.get('/login', (req,res) => {
    var html = `
    log in
    <form action='/loginSubmit' method='post'>
    <input name='email' type='text' placeholder='email'>
    <input name='password' type='password' placeholder='password'>
    <button>Submit</button>
    </form>
    `;
    res.send(html);
});

app.post('/loginSubmit', async (req,res) => {
    var user_name = req.body.name;
    var user_email = req.body.email;
    var user_password = req.body.password;

    const schema = Joi.string().max(20).required();
	const validationResult = schema.validate(username);
	if (validationResult.error != null) {
	   console.log(validationResult.error);
	   res.redirect("/login");
	   return;
	}    
    
    const result = await userCollection.find({email: user_email}).project({email: 1, password: 1, _id: 0}).toArray();

    if (result.length == 0) {
        res.send("User and password not found. <br> <a href='/login'>Try again</a>");
        return;
    }
    
    if (bcrypt.compareSync(user_password, result[0].password)) {
        req.session.authenticated = true;
        req.session.name = user_name;
        req.session.email = user_email;
        req.session.cookie.maxAge = expireTime;
        res.redirect('/members');
    }
    else {
        res.send(`Invalid email/password combination.
        <br>
        <br>
        <a href='/login'>Try again</a>`);
    }
    

});

app.get('/members', (req,res) => {
    if (!req.session.authenticated) {
        res.redirect("/login");
        return
    }
    const randomInt = Math.floor(Math.random() * 3) + 1;
    // const image = "/public/image" + randomInt + ".jpg";
    var name = req.session.name;
    console.log(name)
    var html = `
    <h1>Hello ${name}!</h1>
    <img src="view${randomInt}.jpg" alt="A wonderful view." width=50%>
    <br>
    <button onclick="window.location.href='/logout'">Logout</button>
    `;
    res.send(html);
});

app.get('/logout', (req,res) => {
    req.session.destroy();
    res.redirect('/');
});

app.use(express.static(__dirname + "/public"));

//catch all the other pages, must go at end
app.get("*", (req,res) => {
	res.status(404);
	res.send("<h1>Page not found - 404 :(</h1>");
})