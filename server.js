
const express = require('express')
const session = require('express-session')
const app = express()
const fs = require("fs");


let mongo = require('mongodb');
let mongoose = require('mongoose');
let MongoClient = mongo.MongoClient;
let db;	


app.use(session({ secret: 'some secret here'}))

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// send the home page, if logged, send home_logged.html
app.get("/", function(req, res, next){
    if(req.session.loggedin){
	    res.sendFile(__dirname + "/public/home_logged.html")
    }
    else{
        res.sendFile(__dirname + "/public/home.html")       
    }
});

// send the registration page
app.get("/registration", function(req, res, next){
	res.sendFile(__dirname + "/public/registration.html")
});

// send the users page, if logged, send users_logged.html
app.get("/users", function(req, res, next){
    if(req.session.loggedin){
	    res.sendFile(__dirname + "/public/users_logged.html")
    }
    else{
        res.sendFile(__dirname + "/public/users.html")       
    }
});

// send the user profile page, if logged, send userprofile_logged.html
app.get("/users/:id", function(req, res, next){
    if(req.session.loggedin){
        res.sendFile(__dirname + "/public/userprofile_logged.html")
    }
    else{
        res.sendFile(__dirname + "/public/userprofile.html")       
    }
});

app.get("/order", function(req, res, next){
    res.sendFile(__dirname + "/public/orderform.html")       
});

// called by the users page, send a json object contain all non_private user
app.get("/userlist", function(req, res, next){

    MongoClient.connect("mongodb://localhost:27017/", function(err, client) {
        if(err) throw err;

        db = client.db("a4");

        db.collection("users").find().toArray(function(err,result){
            if(err) throw err;
            let userlist = {}
            for (let i = 0; i < result.length; i++){
                if(!result[i]["privacy"]){
                    userlist[i] = result[i];
                }
            }
            res.set('Content-Type', 'application/json');
            //console.log("before send");
            res.status(200).json(userlist);

            client.close();		
        });
    });

});

// return the current login user's data
app.get("/username", function(req, res, next){
    let u = {};
    u.username = req.session.username;
    u.id = req.session.userid;
    u.privacy = req.session.userprivacy;
    res.status(200).json(u);

});

// logout, update current session
app.get("/logout", function(req, res, next){
    req.session.loggedin = false;
    req.session.username = undefined;
    req.session.userid = undefined;
    req.session.userprivacy = undefined;
    res.sendStatus(200);
});

// update the users colection
app.put("/registration", function(req, res, next){
    let requestBody = req.body;
    console.log(requestBody);
    let exist = false;    
    MongoClient.connect("mongodb://localhost:27017/", function(err, client) {
        if(err) throw err;

        db = client.db("a4");

        db.collection("users").find().toArray(function(err,result){
            if(err) throw err;
            userlist = result;
            for (let i = 0; i < userlist.length; i++){
                if(result[i]["username"] == requestBody["username"]){
                    exist = true;
                    console.log("user exist!");
                    res.sendStatus(401);                                                       
                }
            }
            if(!exist){
                db.collection("users").insertOne(requestBody, function(err, result){
                    if(err){
                        throw err;
                    }
                    res.sendStatus(200);
                    req.session.loggedin = true;
                    req.session.username = requestBody["username"];
                    //console.log(requestBody["username"]);
                    //console.log(req.session.loggedin);
                    console.log("registration complete!");            
                    client.close();    
                });
            }
            else{
                client.close();
                console.log("finish!");
            }            
        });

    });
});

// send user's data
app.get("/Profile/:id", function(req, res, next){

    let id = mongoose.Types.ObjectId(req.params.id);
     MongoClient.connect("mongodb://localhost:27017/", function(err, client){
        if(err) throw err;
        console.log("Connected to database.");
        
        //Select the database by name
        let db = client.db('a4');  

        db.collection("users").findOne({_id : id}, function(err,result){
            if(err) throw err;
            
            console.log(result);
            if(result["privacy"]){
                if(req.session.userid != undefined && req.session.userid == id){
                    res.status(200).json(result);                    
                }
                else{
                    res.sendStatus(403);
                }
            }
            else{
                res.status(200).json(result);
            }
            client.close();
        });
        
    });

});

// send user's order information
app.get("/userorder", function(req, res, next){

    MongoClient.connect("mongodb://localhost:27017/", function(err, client){
        if(err) throw err;
        console.log("Connected to database.");
        
        //Select the database by name
        let db = client.db('a4');  
        console.log(req.body["username"]);
        console.log("user order");
        db.collection("order").find({user: req.body["username"]}).toArray(function(err,result){
            if(err) throw err;

            let data = {};
            console.log(result);            
            for(let i = 0; i < result.length; i++){
                data[`${i}`] = result[i];
            }
            res.status(200).json(data);
            client.close();		
        });
        
    });

});

// update the session data
app.post("/login", function(req, res, next){
	if(req.session.loggedin){
		res.status(200).send("Already logged in.");
		return;
	}
    console.log(req.body);    
    let name = req.body["username"];
    let password = req.body["password"];
    let userlist;
    let authorize = false;

    MongoClient.connect("mongodb://localhost:27017/", function(err, client) {
        if(err) throw err;

        db = client.db("a4");

        db.collection("users").find().toArray(function(err,result){
            if(err) throw err;
            userlist = result;
            client.close();	
            //console.log(result);
            for (let i = 0; i < userlist.length; i++){
                //console.log(result[i]["username"]);
                if(result[i]["username"] == name && result[i]["password"] == password){
                    authorize = true;
                    req.session.loggedin = true;
                    req.session.username = name;
                    req.session.userprivacy = result[i]["privacy"];
                    req.session.userid = result[i]["_id"].toString(); // ***                                       
                }
            }
            
            if(authorize){
                res.status(200).json({id: req.session.userid});
            }
            else{
                res.status(401).send("Not authorized. Invalid username or password.");                
            }
        });
    });

});

// insert new order data to the database
app.post("/orders", function(req, res, next){
    let order = req.body;
    order.user = req.session.username;
    
    MongoClient.connect("mongodb://localhost:27017/", function(err, client) {
        if(err) throw err;

        db = client.db("a4");

        db.collection("order").insertOne(order, function(err,result){
            if(err) throw err;
            
            console.log(result);
            client.close();
        });

    });    
});

// change current login user's privacy
app.put("/changeprivacy/:id", function(req, res, next){
    let id = mongoose.Types.ObjectId(req.params.id);
    if(req.session.userid == id){

        MongoClient.connect("mongodb://localhost:27017/", function(err, client) {
            if(err) throw err;
    
            db = client.db("a4");
            db.collection("users").findOne({username: req.session.username}, function(err,result){
                if(err) throw err;
                
                console.log(result);
                if(result["privacy"]){
                    db.collection("users").updateOne({username: req.session.username}, {$set: {privacy: false}}, function(err, result1){
                        if(err) throw err;
            
                        console.log(result1);
                        res.sendStatus(200);
                        client.close();
                    });
                }
                else if (!result["privacy"]){
                    db.collection("users").updateOne({username: req.session.username}, {$set: {privacy: true}}, function(err, result1){
                        if(err) throw err;
            
                        console.log(result1);
                        res.sendStatus(200);
                        client.close();
                    });
                }

            });           


        });
    }
    else{
        res.sendStatus(403);
    }    
});

app.listen(3000);
console.log("Server listening at http://localhost:3000");