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
    res.redirect('/login');
  }
}


// Initializes passport and passport sessions
app.use(passport.initialize());
app.use(passport.session());

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
  res.render('pages/profile');
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
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;

    // Upload the file to AWS S3
    const params = {
      Bucket: 'uploadonaws', // Replace with your S3 bucket name
      Key: `${Date.now()}-${file.originalname}`,
      Body: file.buffer,
    };

    const uploadedFile = await s3.upload(params).promise();
    const uploadedFiles = []; // Store the uploaded file details in an array

    // Optionally, you can store the uploaded file details (e.g., URL, key) in your database
    uploadedFiles.push({
      name: file.originalname,
      url: uploadedFile.Location, // The URL of the uploaded file in S3
    });

    res.redirect('/');
    
  } catch (err) {
    console.error('Error during file upload:', err);
    res.status(500).send('Oops! Something went wrong during file upload.');
  }
});


// Function to list uploaded files for a user account
async function listUploadedFilesForUser(userId) {
  try {
    // Retrieve file information from your application's database based on userId
    const userUploadedFiles = await YourDatabaseFunction.getUserUploadedFiles(userId);

    // Array to store the file keys (file names or unique identifiers) associated with the user
    const fileKeys = userUploadedFiles.map((file) => file.key);

    // Use the AWS SDK to list objects in the S3 bucket
    const bucketName = 'your-s3-bucket-name';
    const listObjectsParams = {
      Bucket: bucketName,
      Prefix: 'user_uploads/' + userId + '/', // Assuming you have a specific prefix for each user's uploads
    };

    const s3Response = await s3.listObjectsV2(listObjectsParams).promise();
    const uploadedFiles = s3Response.Contents;

    // Filter the files to only include those associated with the user
    const userFiles = uploadedFiles.filter((file) => fileKeys.includes(file.Key));

    // Return the list of files associated with the user
    return userFiles;
  } catch (err) {
    console.error('Error listing uploaded files:', err);
    throw err;
  }
}

// Example usage:
const userId = req.session.userId; // Replace this with the actual user ID of the logged-in user
listUploadedFilesForUser(userId)
  .then((userFiles) => {
    console.log('Uploaded files for the user:');
    console.log(userFiles);
  })
  .catch((err) => {
    console.error('Error:', err);
  });

