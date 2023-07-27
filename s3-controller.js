const formidable = require('formidable');
const {uploadFileToS3, getBucketListFromS3, getPresignedURL} = require('./s3-service');

function readFormData(req) {
    return new Promise((resolve, reject) => {
      upload.single('file')(req, {}, (err) => {
        if (err) {
          reject(err);
        } else {
          // Access the file information from 'req.file'
          const fileInformation = req.file;
          resolve(fileInformation);
        }
      });
    });
  }

async function s3Upload (req, res) {
    const formData = await readFormData(req);
    console.log(formData);
    try{
        await uploadFileToS3(req, formData.file, 'uploadonaws');
        res.send('Uploaded!!');
    } catch(ex) {
        console.log(ex);
        res.send('ERROR!!!!');
    }
}

async function s3Get (req, res) {
    try{
        const bucketData = await getBucketListFromS3('uploadonaws');
        const {Contents = []} = bucketData; 
        res.send(Contents.map(content => {
        return {
            key: content.Key,
            size: (content.Size/1024).toFixed(1) + ' KB',
            lastModified: content.LastModified
        }
    }));
    } catch(ex) {
        res.send([]);
    }
}

async function readFormData(req) {
    return new Promise(resolve => {
        const dataObj = {};
        var form = new formidable.IncomingForm();
        form.parse(req);

        form.on('file', (name, file) => {
            dataObj.name = name;
            dataObj.file = file;
        });

        form.on('end', () => {
            resolve(dataObj);
        });
    });
}

async function getSignedUrl(req, res) {
    try {
        const {key} = req.params;
        const url = await getPresignedURL('uploadonaws', key);
        res.send(url);

    } catch(ex) {
        res.send('');
    }
}

module.exports = {
    s3Upload,
    s3Get,
    getSignedUrl
}