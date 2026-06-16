var express = require('express');
var router = express.Router();

// JWT verification middleware
const jwt = require('jsonwebtoken');
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ msg: 'Access denied. No token provided.' });
  }
  try {
    const verified = jwt.verify(token, 'your-secret-key');
    req.user = verified;
    next();
  } catch (err) {
    return res.status(403).json({ msg: 'Invalid or expired token.' });
  }
}

// Failed login attempt tracker
const failedLoginAttempts = {};

function trackFailedLogin(username) {
  if (!failedLoginAttempts[username]) {
    failedLoginAttempts[username] = { count: 0, lastAttempt: null };
  }
  failedLoginAttempts[username].count += 1;
  failedLoginAttempts[username].lastAttempt = new Date();

  if (failedLoginAttempts[username].count >= 3) {
    console.warn(`[ALERT] Multiple failed logins for user: "${username}" - Total attempts: ${failedLoginAttempts[username].count}`);
  }
}

// -------------------------------admin support-------------------------------

/* GET userlist. */
router.get('/userlist', function (req, res) {
  if (!req.session.user) {
    return res.status(401).json({ msg: 'Access denied. Please login first.' });
  }
  var db = req.db;
  var collection = db.get('userlist');
  collection.find({}, {}, function (e, docs) {
    res.json(docs);
  });
});

/* GET userlist via JWT - for external API access */
router.get('/api/userlist', verifyToken, function (req, res) {
  var db = req.db;
  var collection = db.get('userlist');
  collection.find({}, {}, function (e, docs) {
    res.json(docs);
  });
});

/* POST to adduser. */
router.post('/adduser', async function (req, res) {
  const validator = require('validator');
const email = req.body.email;
if (!validator.isEmail(email)) {
  return res.status(400).send('Invalid email');
}// added validation for email format
  var db = req.db;
  var collection = db.get('userlist');

  // no duplicate username is allowed
  var user = await collection.findOne({ "username": req.body.username });
  if (user) {
    res.send({ msg: "duplicate username" });
  } else {
    const bcrypt = require('bcrypt');
const hashedPassword = await bcrypt.hash(req.body.password, 10);
const newUser = { ...req.body, password: hashedPassword }; //deepcopy req.body and replace password with hashed password
collection.insert(newUser, function (err, result) {
      res.send(
        (err === null) ? { msg: '' } : { msg: err }
      );
    });
  }
});

/* DELETE to deleteuser. */
router.delete('/deleteuser/:id', function (req, res) {
  var db = req.db;
  var collection = db.get('userlist');
  var userToDelete = req.params.id;
  collection.remove({ '_id': userToDelete }, function (err) {
    res.send((err === null) ? { msg: '' } : { msg: 'error: ' + err });
  });
});

// -------------------------------user support-------------------------------

/* authenticate and login user */
router.post('/session', async function (req, res) {
  // session exists and send it back
  if (req.session.user) {
    res.send({ user: req.session.user });
  } else {
    // check the field should not be blank
    if (req.body.username === '' || req.body.password === '') {
      res.send({ msg: "Please fill in all fields" }).end();
    }
    // query for the username
    var db = req.db;
    var collection = db.get('userlist');
    var user = await collection.findOne({ username: req.body.username });
if (!user || !(await require('bcrypt').compare(req.body.password, user.password))) {
  trackFailedLogin(req.body.username); // track failed login attempt
  const attempts = failedLoginAttempts[req.body.username]?.count || 0;
  if (attempts >= 5) {
    return res.status(429).send({ msg: "Account temporarily locked due to multiple failed attempts." });
  }
  res.send({ msg: "unauthorized" });
} else {
  // reset counter on successful login
  delete failedLoginAttempts[req.body.username];
      // sucessfully login
      try {
        req.session.regenerate(() => {
          req.session.user = user;
          console.log(
            `Session.login success: ${req.session.user.username}`
          );
          // If a match, return 200:{ username }
          const jwt = require('jsonwebtoken');
const token = jwt.sign({ id: user._id }, 'your-secret-key');
res.status(200).send({
  username: user.username,
  token: token,
});// added JWT token generation for authentication
        });
      } catch (err) {
        console.log(err);
      }

    }
  }
});

/* delete a user's session */
router.delete('/session', (req, res) => {
  if (req.session.user) {
    console.log(
      `Session.login destroy: ${req.session.user.username}`
    );
    req.session.destroy(() => {
      res.status(204).end();
    });
  }
});

/* get info of the current user in session */
router.get('/', (req, res) => {
  if (req.session.user) {
    res.status(200).send({ user: req.session.user }).end();
  } else {
    res.send({ msg: "Something bad happens" });
  }
});

/* modify the login user's data */
router.put('/modify', async function (req, res) {
  // check is login
  if (!req.session.user) {
    res.send({ msg: "login first" }).end();
  } else {
    var db = req.db;
    var collection = db.get('userlist');
    var query = req.body;
    // update the corresponding fields
    collection.findOneAndUpdate({ 'username': req.session.user.username }, { $set: query }, function (err, result) {
      // update session too
      if (result) {
        req.session.user = result;
      }
      res.send(
        (err === null) ? { msg: '' } : { msg: err }
      );
    });
  }
});

module.exports = router;
