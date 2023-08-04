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


app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'));


app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname));
app.use(cors());


// Example protected and unprotected routes
app.get('/', (req, res) => res.render('pages/index'))

app.get('/failed', (req, res) => res.send('You Failed to log in!'))

// Auth Routes
app.get('/google', passport.authenticate('google', { scope: ['profile'], callbackURL: 'http://localhost:5000/google/callback' }));

app.get('/google/callback', passport.authenticate('google', { failureRedirect: '/' }), async (req, res) => {
  const username = req.user.id;
  app.locals.username = username;
  req.session.regenerate((err) => {
    // Handle the regeneration callback (if needed)
    if (err) {
      console.error('Error regenerating session:', err);
    }

    res.redirect(`/profile/${username}`);
    // console.log(username)
  });

});

app.get('/profile/:username', (req, res) => {
  const username = req.params.username;
  res.render('pages/profile', { username });
});

app.get('/logout', (req, res) => {
  req.session = null;
  res.redirect('/');
})

app.get('/reload', (req, res) => {
  const data = {
    title: 'Reloaded Page',
    message: 'This page has been reloaded!',
  };

  res.render('reload', data);
});


// AWS credentials
const awsConfig = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'ap-south-1',
};

AWS.config.update(awsConfig);
const s3 = new AWS.S3();
const storage = multer.memoryStorage(); // Storage destination for uploaded files
const upload = multer({ storage }); // multer configs to handle file uploads

// File Upload To S3 Bucket
app.post('/upload-to-s3/:username', upload.single('file'), async (req, res) => {
  try {

    const file = req.file;
    const username = app.locals.username

    // Upload the file to AWS S3
    const params = {
      Bucket: 'uploadonaws', 
      Key: `${username}/${Date.now()}-${file.originalname}`,
      Body: file.buffer,
      ACL: 'private',
    };

    const uploadedFile = await s3.upload(params).promise(); //To push file on aws
    const uploadedFiles = []; // Store the uploaded file details in an array
    // console.log("before",uploadedFiles);

    uploadedFiles.push({
      name: file.originalname,
      url: uploadedFile.Location, // The URL of the uploaded file in S3
    });
    // console.log("after", uploadedFiles);
    // console.log('Upload Successful');
    res.redirect('/reload');

  } catch (err) {
    console.error('Error during file upload:', err);
    res.status(500).send('Oops! Something went wrong during file upload.');
  }
});


// Get Files as per User Logged-In
app.get('/all-files/:username', (req, res) => {
  const username = app.locals.username
  // console.log('username is', username)
  s3Get(req, res, username);
});

async function s3Get (req, res, username) {
  try{
      // console.log('received username', username)
      const prefix = `${username}/`
      // console.log(prefix)
      const bucketData = await getBucketListFromS3('uploadonaws', prefix);
      const {Contents = []} = bucketData; 
      const files = Contents.map((content) => {
          const keyParts = content.Key.split('/'); // Split the key by "/"
          const filename = keyParts[keyParts.length - 1];
          return {
            key: content.Key,
            filename: filename,
            size: (content.Size / 1024).toFixed(1) + ' KB',
            lastModified: content.LastModified,
            owner: username
          };
        });
        res.send(files);
  } catch(ex) {
      res.send([]);
  }
}

async function getBucketListFromS3(bucketName, prefix) {
  // const s3 = createS3Instance();
  // console.log('prefix is', prefix)
  const params = {
      Bucket: bucketName,
      MaxKeys: 10,
      Prefix: prefix
  }

  try {
      const bucketData = await s3.listObjects(params).promise();
      // console.log("Bucket Data is", bucketData)
      return bucketData || {};
  } catch (err) {
      console.error('Error listing objects:', err);
      return {};
  }
}


// Get URL To Download File
app.get(`/get-object-url/:key`, (req, res) => {
  const key = req.params.key
  // console.log('KEY', key)
  // res.setHeader('Content-Disposition', `attachment; filename="${key}"`);
  getSignedUrl(req, res, key);
});

async function getPresignedURL(bucketName, key) {
  const params = {
      Bucket: bucketName,
      Key: key,
      Expires: 60
  }
  const preSignedURL = await s3.getSignedUrl('getObject', params);
  // console.log('presigned url is', preSignedURL);
  return preSignedURL;
}

async function getSignedUrl(req, res, key) {
  try {

      // console.log('key is', key);
      const url = await getPresignedURL('uploadonaws', key);
      res.send(url);
      // console.log('url is', url);

  } catch(ex) {
      res.send('');
  }
}

app.listen(5000, () => console.log(`App listening on port ${5000}!`))
