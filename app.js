let createError = require('http-errors');
let express = require('express');
const cors = require('cors'); // restrict cross-origin access
const rateLimit = require('express-rate-limit'); //add rate limiting to prevent brute-force attacks
let helmet = require('helmet'); //add security headers 
let session = require('express-session');
let path = require('path');
let cookieParser = require('cookie-parser');
let logger = require('morgan');
const winstonLogger = require('./logger'); //add logging with winston
// Database
let mongo = require('mongodb');
let monk = require('monk');
let db = monk('localhost:27017/nodetest2');


let adminRouter = require('./routes/admin');
let usersRouter = require('./routes/users');
let loginRouter = require('./routes/index');
let pikachuRouter = require('./routes/pikachu');
let orderRouter = require('./routes/order');
// support php file exec
let phpRouter = require('./routes/php');

let app = express();
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://ajax.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  crossOriginResourcePolicy: false
})); // Disable Cross-Origin-Resource-Policy to allow loading images from external sources

// Rate limiting - max 10 requests per 15 minutes on login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/users/session', loginLimiter);
// CORS - only allow requests from our own frontend
const corsOptions = {
  origin: ['http://localhost:3000', 'http://192.168.64.3:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(session({
  secret: "Shh, its a secret!",
  resave: true,
  saveUninitialized: true,
  expires: new Date(Date.now() + (30 * 86400 * 1000)),
}));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Make our db accessible to our router
app.use(function(req,res,next){
    req.db = db;
    next();
});

app.use('/', adminRouter);
app.use('/users', usersRouter);
app.use('/', loginRouter);
app.use('/', pikachuRouter);
app.use('/', orderRouter);
app.use('/', phpRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
