const express = require("express");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();

const app = express();
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const nodemailer = require('nodemailer');

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

const userSchema = new mongoose.Schema({
  teamName: { type: String, required: true },
  teamNumber: { type: Number, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  insta: {type: String, required: true, unique: true},
  CNC: { type: Boolean, required: false },
  _3DPrint: { type: Boolean, required: false },
  address: { type: String, required: true, unique: true },
  position: { type: Map, of: String , required: true },  
  pending: {type: Boolean, required: true}
});

const User = mongoose.model('User', userSchema);

module.exports = User; 

const storage = multer.memoryStorage();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const upload = multer({ storage });

const limiter = rateLimit({
  windowMs: 3 * 60 * 60 * 1000,
  max: 2,
  message: "Too many submissions from this IP, please try again later."
});

async function addUser(tmName, tmNum, eml, insta, cnc, _3dprnt, add, pos) {
  try{
    let truePos = JSON.parse(pos);
    const newUser = new User({
      teamName: tmName,
      teamNumber: tmNum,
      email: eml,
      insta: insta,
      CNC: cnc,
      _3DPrint: _3dprnt,
      address: add,
      position: { lat: truePos.lat, long: truePos.long },
      pending: true,
    });
    await newUser.save(); 
    return true;
  } catch (err) { console.error(err); return false; }
}

async function sendEmail(from, teamName, teamNumber){
  try{
    await transporter.sendMail({
      from: `"CNC4FTC" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      replyTo: from,
      subject: "Request",
      text: `Request from ${teamName} #${teamNumber}
      
      I would like to have my location shown on the map`
    });

    return true;
  } catch (err) {console.log("Error sending email"); return false; }
}

app.use("/upload", limiter);

app.post("/upload", (req, res) => {
  res.json({ message: req.body.message })
});

app.post("/try-upload", upload.single("file"), async (req, res) => {
  let added = false;
  let sentEmail = false;

  added = await addUser(
    req.body.teamName,
    req.body.teamNumber,
    req.body.email,
    req.body.insta,
    req.body.hasCNC,
    req.body.has3DPrint,
    req.body.address,
    req.body.position,
  );

  res.json({ userAdded: added});

  if(added)
    console.log(`Added ${added}`);
    sentEmail = await sendEmail(
      req.body.email,
      req.body.teamName,
      req.body.teamNumber
    );
});

app.post('/check-pass', (req, res) => {
  try{
    const data = req.body;
    console.log(data.password);
    console.log(process.env.ADMIN_PASSWORD);
    console.log(data.password == process.env.ADMIN_PASSWORD);
    res.json({ val: data.password == process.env.ADMIN_PASSWORD })
  } catch (err) { console.error(err); res.json({ message: 'Unexpected Error' });}
})

app.post('/request-accept', async (req, res) => {
  try{
    const data = req.body;
    await User.findByIdAndUpdate(data._id, { pending: false });  
    res.json({
      message: "Request accepted",
      success: true
    });
  } catch (err) { console.error(err); }
})

app.post('/request-decline', async (req, res) => {
  try{
    const data = req.body;
    await User.findByIdAndDelete(data._id);
    res.json({
      message: "Request rejected",
      success: true
    });
  } catch (err) { console.error(err); }
})

app.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) { console.error(err); }
});

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(5000, () => console.log("Server running on port 5000"));