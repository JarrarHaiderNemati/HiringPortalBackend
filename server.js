const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const PORT = 5000;
const bcrypt = require('bcryptjs');

const User = require('./schemas/User');
const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MONGO DB CONNECTED ! '))
  .catch((err) => console.log("Error occured connecting to mongo db ! ", err));

app.post('/login', async (req, res) => {
  const { email, password, role } = req.body;
  console.log('Email', email, 'pass', password, 'role', role);
  if (!email || !password) {
    console.log('Email or password missing ! ');
    return res.status(500).json({ message: 'Email or password missing ! ' });
  }

  try {
    const findUser = await User.findOne({ email });
    if (findUser) {
      const isMatch = await bcrypt.compare(password, findUser.password);
      if (isMatch) {
        if (role !== findUser.role) {
          return res.status(400).json({ status: '400', message: 'Wrong role selected ! ' });
        }
        return res.status(200).json({ status: '200', message: 'Login successful ! ' });
      }
      return res.status(400).json({ status: '400', message: 'Wrong password ! ' });
    }
    return res.status(404).json({ status: '404', message: 'User does not exist ! ' });
  }
  catch (err) {
    console.log('Inside catch block of login !',err);
    return res.status(500).json({ status: '500', message: 'Some error occured ! ' });
  }
});

app.post('/signup', async (req, res) => {

  const { name, email, password, role } = req.body;
  console.log('Name',name, 'Email', email, 'pass', password, 'role', role);
  if (!name || !email || !password) {
    return res.status(400).json({ status: '400', message: 'All fields are required!' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ status: '409', message: 'User already exists!' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ name, email, password: hashedPassword, role });
    await newUser.save();

    res.status(201).json({ status: '201', message: 'Signup successful!' });
  }
  catch (err) {
    console.log('Inside catch block of signup !');
    console.error('Signup error:', err);
    res.status(500).json({ status: '500', message: 'Something went wrong during signup!' });
  }
});

app.listen((PORT), () => {
  console.log('Server running on port', PORT);
});
