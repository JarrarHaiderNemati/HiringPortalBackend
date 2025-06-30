const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const PORT = 5000;
const bcrypt = require('bcryptjs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const archiver = require('archiver');
const fs=require('fs');
const path=require('path');

const User = require('./schemas/User');
const UserDetails = require('./schemas/UserDetails');
const StatusCodes = require('./StatusCodes');
const app = express();
app.use(express.json());
app.use(cors());
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MONGO DB CONNECTED ! '))
  .catch((err) => console.log("Error occured connecting to mongo db ! ", err));

app.get('/downloadAll', (req, res) => {
  const folderPath = path.join(__dirname, 'uploads');
  const zipName = 'all_resumes.zip';

  res.setHeader('Content-Disposition', `attachment; filename=${zipName}`);
  res.setHeader('Content-Type', 'application/zip');

  const archive = archiver('zip', {
    zlib: { level: 9 }
  });

  archive.on('error', err => {
    console.error('Zip error:', err);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: 'Failed to zip files' });
  });

  archive.pipe(res);

  fs.readdir(folderPath, (err, files) => {
    if (err || files.length === 0) {
      return res.status(StatusCodes.NOT_FOUND).send({ message: 'No resumes found' });
    }

    files.forEach(file => {
      const filePath = path.join(folderPath, file);
      archive.file(filePath, { name: file });
    });

    archive.finalize();
  });
});

app.post('/sendemail', async (req, res) => {
  const { email, name } = req.body;
  console.log('Here is email', email, 'here is name', name);
  if (!email || !name) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: StatusCodes.INTERNAL_SERVER_ERROR, message: 'Email and name both are required ! ' });
  }
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  const mailOptions = {
    from: 'jarrarnemati@gmail.com',
    to: email,
    subject: 'Thanks for contacting us!',
    text: `Hi ${name},\n\nThank you for your submission! We'll get back to you soon.\n\nRegards,\nTeam`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent ! ');
    res.status(StatusCodes.SUCCESS).json({ status: StatusCodes.SUCCESS, message: 'Email sent!' });
  } catch (error) {
    console.log('Some error occured ! ', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: StatusCodes.INTERNAL_SERVER_ERROR, message: 'Failed to send email', error });
  }
});

app.post('/uploads', upload.single('resume'), async (req, res) => {
  const resume = req.file?.filename;
  const { email } = req.body;
  if (!resume || !email) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: StatusCodes.INTERNAL_SERVER_ERROR, message: 'Resume or email is missing ! ' });
  }
  try {
    const saved = await UserDetails.findOneAndUpdate(
      { email },
      { $set: { file: `uploads/${resume}` } },
      { upsert: true, new: true }
    );

    res.status(StatusCodes.SUCCESS).json({ status: StatusCodes.SUCCESS, message: 'Resume saved successfully ! ' });
  }
  catch (err) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: StatusCodes.INTERNAL_SERVER_ERROR, message: 'Some error occured ! ' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('Email', email, 'pass', password);
  if (!email || !password) {
    console.log('Email or password missing ! ');
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Email or password missing ! ' });
  }

  try {
    const findUser = await User.findOne({ email });
    if (findUser) {
      const isMatch = await bcrypt.compare(password, findUser.password);
      if (isMatch) {
        return res.status(StatusCodes.SUCCESS).json({ status: StatusCodes.SUCCESS, message: 'Login successful ! ',role:findUser.role});
      }
      return res.status(StatusCodes.BAD_REQUEST).json({ status: StatusCodes.BAD_REQUEST, message: 'Wrong password ! ' });
    }
    return res.status(StatusCodes.NOT_FOUND).json({ status: StatusCodes.NOT_FOUND, message: 'User does not exist ! ' });
  }
  catch (err) {
    console.log('Inside catch block of login !', err);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: StatusCodes.INTERNAL_SERVER_ERROR, message: 'Some error occured ! ' });
  }
});

app.post('/signup', async (req, res) => {
  const { name, email, password, role } = req.body;
  console.log('Name', name, 'Email', email, 'pass', password, 'role', role);
  if (!name || !email || !password) {
    return res.status(StatusCodes.BAD_REQUEST).json({ status: StatusCodes.BAD_REQUEST, message: 'All fields are required!' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(StatusCodes.CONFLICT).json({ status: StatusCodes.CONFLICT, message: 'User already exists!' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ name, email, password: hashedPassword, role });
    await newUser.save();

    res.status(StatusCodes.SUCCESS).json({ status: StatusCodes.SUCCESS, message: 'Signup successful!' });
  }
  catch (err) {
    console.log('Inside catch block of signup !');
    console.error('Signup error:', err);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: StatusCodes.INTERNAL_SERVER_ERROR, message: 'Something went wrong during signup!' });
  }
});

app.post('/saveNiche', async (req, res) => {
  const { niche, email } = req.body;
  console.log('Value of niche:', niche, 'email:', email);

  if (!niche || !email) {
    return res.status(StatusCodes.BAD_REQUEST).json({ status: StatusCodes.BAD_REQUEST, message: 'Some fields are missing!' });
  }

  try {
    const updatedUser = await UserDetails.findOneAndUpdate(
      { email },
      { $set: { niche } },
      { upsert: true, new: true }
    );

    return res.status(StatusCodes.SUCCESS).json({ status: StatusCodes.SUCCESS, message: 'Niche saved/updated!', user: updatedUser });
  } catch (err) {
    console.error('Error in /saveNiche:', err);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: StatusCodes.INTERNAL_SERVER_ERROR, message: 'Some error occurred!' });
  }
});

app.post('/submitForm', async (req, res) => {
  const { email, name, graduation, contact, address, discipline, university, techStack } = req.body;

  if (!email || !name || !graduation || !contact || !address || !discipline || !university || techStack.length === 0) {
    return res.status(StatusCodes.BAD_REQUEST).json({ status: StatusCodes.BAD_REQUEST, message: 'Some fields are missing' });
  }

  try {
    const updatedUser = await UserDetails.findOneAndUpdate(
      { email },
      {
        $set: {
          name,
          graduation,
          contact,
          address,
          discipline,
          university,
          progLanguages: techStack,
        }
      },
      { upsert: true, new: true }
    );

    return res.status(StatusCodes.SUCCESS).json({ status: StatusCodes.SUCCESS, message: 'Form submitted!', user: updatedUser });
  } catch (err) {
    console.error('Error in /submitForm:', err);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: StatusCodes.INTERNAL_SERVER_ERROR, message: 'Some error occurred!' });
  }
});

app.post('/getNameAndEmail', async (req, res) => {
  const { email } = req.body;
  console.log('Email', email);
  if (!email) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: StatusCodes.INTERNAL_SERVER_ERROR, message: 'Email is missing ! ' });
  }
  try {
    const getName = await User.findOne({ email });
    if (getName) {
      return res.status(StatusCodes.SUCCESS).json({ status: StatusCodes.SUCCESS, name: getName.name });
    }
    return res.status(StatusCodes.NOT_FOUND).json({ status: StatusCodes.NOT_FOUND, message: 'Error fecthing name !' });
  }
  catch (err) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: StatusCodes.INTERNAL_SERVER_ERROR, message: 'Some error occured ! ' });
  }
});

app.get('/searchUser', async (req, res) => {
  const { email } = req.query;
  console.log('Email', email);
  if (!email) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: StatusCodes.INTERNAL_SERVER_ERROR, message: 'Email is missing ! ' });
  }
  try {
    const findUser = await UserDetails.findOne({ email });
    if (findUser) {
      console.log('Found user ! ');
      return res.status(StatusCodes.SUCCESS).json({ status: StatusCodes.SUCCESS, message: 'User exists ! ' });
    }
    console.log('Not found user ');
    return res.status(StatusCodes.NOT_FOUND).json({ status: StatusCodes.NOT_FOUND, message: 'User not found ! ' });
  }
  catch (err) {
    console.log('Catch blokc of searchUSer');
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: StatusCodes.INTERNAL_SERVER_ERROR, message: 'Some error occured ! ' });
  }
});

app.get('/fetchRecieved', async (req, res) => {
  try {
    console.log('Inside try block of fetch recieved ! ');
    const recieved = await UserDetails.find({ status: 'Recieved' });
    if (recieved.length > 0) {
      return res.status(StatusCodes.SUCCESS).json({ status: StatusCodes.SUCCESS, candidates: recieved });
    }
    return res.status(StatusCodes.NOT_FOUND).json({ status: StatusCodes.NOT_FOUND, message: 'No candidates found ! with status : recieved !' });
  }
  catch (err) {
    console.log('Inside catch block of fetch recieved ! ');
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: StatusCodes.INTERNAL_SERVER_ERROR, message: 'Some error occured ! ' });
  }
});

app.post('/shortlistCnds', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: StatusCodes.INTERNAL_SERVER_ERROR, message: 'Email is missing ! ' });
  }
  const findEmail = await UserDetails.findOneAndUpdate(
    { email },
    { $set: { status: 'Shortlisted' } }
  );
  if (findEmail) {
    return res.status(StatusCodes.SUCCESS).json({ status: StatusCodes.SUCCESS, message: 'Shortlisted candidate ! ' });
  }
  return res.status(StatusCodes.NOT_FOUND).json({ status: StatusCodes.NOT_FOUND, email: email });
});

app.delete('/deleteCandidate', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: StatusCodes.INTERNAL_SERVER_ERROR, message: 'Email is missing ! ' });
  }
  try {
    const deleteCandidate = await UserDetails.findOneAndDelete({
      email
    });
    if (deleteCandidate) {
      return res.status(StatusCodes.SUCCESS).json({ status: StatusCodes.SUCCESS, message: 'Candidate deleetd  ! ' });
    }
    return res.status(StatusCodes.NOT_FOUND).json({ status: StatusCodes.NOT_FOUND, message: 'Could not delete candidate ! ' });
  }
  catch (err) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: StatusCodes.INTERNAL_SERVER_ERROR, message: 'Some error occured ! ' });
  }
});

app.get('/fetchShortlisted', async (req, res) => {
  try {
    const fetchShortlisted = await UserDetails.find({ status: 'Shortlisted' });
    if (fetchShortlisted.length > 0) {
      return res.status(StatusCodes.SUCCESS).json({ status: StatusCodes.SUCCESS, candidates: fetchShortlisted });
    }
    return res.status(StatusCodes.NOT_FOUND).json({ status: StatusCodes.NOT_FOUND, message: 'No shortlisted canddiates ! ' });
  }
  catch (err) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: StatusCodes.INTERNAL_SERVER_ERROR, message: 'Some error occured ! ' });
  }
});

app.delete('/deleteAll', async (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: StatusCodes.INTERNAL_SERVER_ERROR, message: 'Status is missing ! ' });
  }
  try {
    const deleteCands = await UserDetails.deleteMany({
      status: status
    });
    return res.status(StatusCodes.SUCCESS).json({ status: StatusCodes.SUCCESS, message: 'All deleted successfully ! ' });
  }
  catch (err) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: StatusCodes.INTERNAL_SERVER_ERROR, message: 'Some error occured ! ' });
  }
});

app.get('/getPages',async(req,res)=>{
  const {status}=req.query;
  if(!status){
    return res.status(StatusCodes.BAD_REQUEST).json({status:StatusCodes.BAD_REQUEST,message:'Status is missing ! '});
  }
  try{
    const count = await UserDetails.countDocuments({status});
    return res.status(StatusCodes.SUCCESS).json({status:StatusCodes.SUCCESS,count:count});
  }
  catch(err) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({status:StatusCodes.INTERNAL_SERVER_ERROR,message:'Count fetched successfully ! '});
  }
});

app.get('/pagination',async(req,res)=>{
  const {limit,page,status}=req.query;
  if(!page||!limit||!status) {
    return res.status(StatusCodes.BAD_REQUEST).json({status:StatusCodes.BAD_REQUEST,message:'Page, limit, status is missing '});
  }
  try{
    const find=await UserDetails.find({status}).sort({_id:-1}).skip((page-1)*limit).limit(limit);
    return res.status(StatusCodes.SUCCESS).json({status:StatusCodes.SUCCESS,candidates:find});
  }
  catch(err) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({status:StatusCodes.INTERNAL_SERVER_ERROR,message:'Page or limit is missing '});
  }
});

app.listen((PORT), () => {
  console.log('Server running on port', PORT);
});
