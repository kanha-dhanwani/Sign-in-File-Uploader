require('dotenv').config()
const express = require('express')
const app = express()
const passport = require('passport');
const multer = require('multer');
const AWS = require('aws-sdk');
const path = require('path');
const session = require('express-session');
require('./passport-setup');
const cors = require('cors');



const s3Controller = require('./s3-controller');

app.set('view engine','ejs')
app.set('views', path.join(__dirname, 'views'));


// Use express-session middleware with your desired configuration
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false,
}));

function isLoggedIn(req, res, next) {
  // Check if the user is authenticated
  if (req.session.isAuthenticated) {
    // If authenticated, proceed to the next middleware or route handler
    next();
  } else {
    // If not authenticated, redirect to the login page or return an error
    res.redirect('/');
  }
}


// Initializes passport and passport sessions
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname));

// Example protected and unprotected routes
app.get('/', (req, res) => res.render('pages/index'))
app.get('/failed', (req, res) => res.send('You Failed to log in!'))

// In this route you can see that if the user is logged in u can acess his info in: req.user
app.get('/index', isLoggedIn, (req, res) =>{
    res.render('pages/profile',{name:req.user.displayName,pic:req.user.photos[0].value,email:req.user.emails[0].value})
})



// Auth Routes
app.get('/google', passport.authenticate('google', { scope: ['profile'], callbackURL: 'http://localhost:5000/google/callback' }));

app.get('/google/callback', passport.authenticate('google', { failureRedirect: '/' }), async (req, res) => {
  req.session.regenerate((err) => {
    // Handle the regeneration callback (if needed)
    if (err) {
      console.error('Error regenerating session:', err);
    }
    // Redirect or respond to the login success
    res.render('pages/profile');
  });

});

app.get('pages/profile', (req, res) => {
  // Your logic to handle the /profile request goes here
  res.render('/');
});

app.get('/successful-upload', (req, res) => {
      // Set a custom response header to instruct the client to reload the page
      res.setHeader('X-Reload-Page', 'true');
});


app.get('/logout', (req, res) => {
    req.session = null;
    req.logout();
    res.redirect('/');
})


app.listen(5000, () => console.log(`Example app listening on port ${5000}!`))


app.use(cors());
// Configure AWS credentials (Set these as environment variables)
const awsConfig = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'ap-south-1', 
};

AWS.config.update(awsConfig);

const s3 = new AWS.S3();

// Set the storage destination for uploaded files
const storage = multer.memoryStorage();

// Configure multer to handle file uploads
const upload = multer({ storage });

// Handle file uploads
app.post('/upload-to-s3', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;

    // Upload the file to AWS S3
    const params = {
      Bucket: 'uploadonaws', // Replace with your S3 bucket name
      Key: `${Date.now()}-${file.originalname}`,
      Body: file.buffer,
    };

    const uploadedFile = await s3.upload(params).promise(); //To push file on aws
    const uploadedFiles = []; // Store the uploaded file details in an array

    // Optionally, you can store the uploaded file details (e.g., URL, key) in your database
    uploadedFiles.push({
      name: file.originalname,
      url: uploadedFile.Location, // The URL of the uploaded file in S3
    });

    
    // console.log('Upload Successful');
    location.url('profile');
    // app.get('/files', (req, res) => {
    //   res.json(fileList);
    // });

  } catch (err) {
    console.error('Error during file upload:', err);
    res.status(500).send('Oops! Something went wrong during file upload.');
  }
});



// app.post('/upload-to-s3', upload.single('file'), s3Controller.s3Upload);

app.get('/all-files', s3Controller.s3Get);

app.get('/get-object-url/:key', s3Controller.getSignedUrl);
