const express = require('express');
const cors = require('cors');
const mongoose = require("mongoose");
const User = require('./models/User');
const Post = require('./models/Post');
const Comment = require('./models/Comment');

const bcrypt = require('bcryptjs');
const app = express();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const storage = multer.memoryStorage()
const uploadMiddleware = multer()
const cron = require('node-cron');


const cronJob = cron.schedule('*/10 * * * *', () => {
  http.get('https://blog-backend3-0.onrender.com/', (res) => {
    console.log(`Ping sent to the server at: ${new Date()}`);
  }).on('error', (error) => {
    console.error('Error pinging the server:', error);
  });
});


cronJob.start();
require('dotenv').config();

const fs = require('fs');
const { log } = require('console');

const cloudinary = require('cloudinary').v2;
          
cloudinary.config({ 
  cloud_name: process.env.CLOUD_NAME, 
  api_key: process.env.API_KEY, 
  api_secret: process.env.API_SECRET
});

const salt = bcrypt.genSaltSync(10);
const secret = process.env.HASH_SECRET;

app.use(cors({credentials:true,origin:`${process.env.REQ_URL }`}));

app.use(express.json());
app.use(cookieParser());

mongoose.connect(process.env.DATABASE);

app.post('/register', async (req,res) => {
  const {username,password} = req.body;
  try{
    const userDoc = await User.create({
      username,
      password:bcrypt.hashSync(password,salt),
    });
    res.json(userDoc);
  } catch(e) {
    res.status(400).json(e);
  }
});

app.post('/login', async (req,res) => {
  const {username,password} = req.body;
  const userDoc = await User.findOne({username});
  const passOk = bcrypt.compareSync(password, userDoc.password);
  if (passOk) {
    // logged in
    jwt.sign({username,id:userDoc._id}, secret, {}, (err,token) => {
      if (err) throw err;
      res.cookie('token', token, { sameSite: 'none', secure: true}).json({
        id:userDoc._id,
        username,
      });
    });
  } else {
    res.status(400).json('wrong credentials');
  }
});

app.get('/profile', (req,res) => {
  const {token} = req.cookies
  jwt.verify(token, secret, {}, (err,info) => {
    if (err) throw err;
    res.json(info);
  });
});


app.post('/logout', (req,res) => {
  res.cookie('token', '', { sameSite: 'none', secure: true}).json('ok');
});

 

app.post('/post', uploadMiddleware.single('file'), async (req,res) => {
  
  const base64Data = req.file.buffer.toString('base64');
  const dataUri = `data:${req.file.mimetype};base64,${base64Data}`;
  
  const result = await cloudinary.uploader.upload(dataUri);

  const {token} = req.cookies;
  jwt.verify(token, secret, {}, async (err,info) => {
    if (err) throw err;
    const {title,summary,content} = req.body;
    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover:result.secure_url,
      author:info.id,
    });
    res.json(postDoc);
  });

});



app.put('/post',uploadMiddleware.single('file'), async (req,res) => {
  let newPath = null;
  
  if (req.file) {
    const base64Data = req.file.buffer.toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${base64Data}`;
    const result = await cloudinary.uploader.upload(dataUri);
    newPath = result.secure_url;
  }

  const {token} = req.cookies;
  jwt.verify(token, secret, {}, async (err,info) => {
    if (err) throw err;
    const {id,title,summary,content} = req.body;
    const postDoc = await Post.findById(id);
    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
    if (!isAuthor) {
      return res.status(400).json('you are not the author');
    }
    await postDoc.update({
      title,
      summary,
      content,
      cover: newPath ? newPath : postDoc.cover,
    });

    res.json(postDoc);
  });

});

app.get('/post', async (req,res) => {
  res.json(
    await Post.find()
      .populate('author', ['username'])
      .sort({createdAt: -1})
      .limit(20)
  );
});

app.get('/post/:id', async (req, res) => {
  const {id} = req.params;
  const postDoc = await Post.findById(id).populate('author', ['username']);
  res.json(postDoc);
})


app.post('/comment', async(req, res)=>{
  
    const {token} = req.cookies;
    jwt.verify(token, secret, {}, async (err,info) => {
      if (err) throw err;
      const {id, comment} = req.body;
      const newComment = await Comment.create({
        message: comment,
        author:info.id,
        post: id,
        createdAt:new Date(),
      });
      res.json(newComment);
    });
})

app.get('/comment/:id', async (req, res) => {
  const {id} = req.params;
  
  res.json(
    await Comment.find({ post: id })
    .populate('author', ['username'])
    .sort({createdAt: -1})
    .limit(20)
  );
})

app.delete('/comment/:_id', async (req, res) => {
  try {
    const { _id } = req.params;

    const deletedComment = await Comment.findByIdAndDelete(_id);

    if (!deletedComment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/comment/:id', async (req, res) => {
  const id = req.params.id;
  const { message } = req.body;

  try {
    // Find the comment by ID and update it
    const updatedComment = await Comment.findByIdAndUpdate(
      id,
      { message },
      { new: true }
    );

    if (updatedComment) {
      res.status(200).json(updatedComment);
    } else {
      // If comment is not found, return 404 Not Found
      res.status(404).send('Comment not found');
    }
  } catch (error) {
    // If an error occurs, return 500 Internal Server Error
    console.error('Error updating comment:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(process.env.PORT);
//
