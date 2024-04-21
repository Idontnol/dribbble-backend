const express=require('express');
const {MongoClient}=require('mongodb');
const cors=require('cors');
const bcrypt=require('bcrypt');
const cloudinary=require('./utils/cloudinary');
// const multer = require('multer');
const { uploadImage } = require('./utils/multer');
const jwt=require('jsonwebtoken');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { validUser } = require('./utils/helper');

const app=express();
app.use(bodyParser.json({ limit: '50mb' })); //increase the limit of uploading data using body-parser
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(express.json());
app.use(cors()); 

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  });


let PORT=process.env.PORT || 3001;

let db;
const connectDb=async()=>{
    let client=await MongoClient.connect(process.env.MONGO_URI);
    db=client.db("dribble"); //database name
}
connectDb();

app.get('/',(req,res)=>{
    res.json({'message':'hello world'});
})

app.post('/user/register',async(req,res)=>{
    const userDetails=req.body;
    console.log(userDetails,"details reqbody");
    let checkExist= await db.collection('users').findOne({username:userDetails.username});
    if(checkExist!== null){
        console.log(checkExist);
        res.status(400).json({"status":"error",'msg':"user already exists with that username"});
    }
    else if(userDetails.password){

        const salt = await bcrypt.genSalt(10); 
        const hashedPassword = await bcrypt.hash(userDetails.password, salt); 
        console.log(hashedPassword);

        const {name,username,email}=userDetails;
        const user=await db.collection('users').insertOne({name,username,email,password: hashedPassword,emailVerified:false});
        let jwt_token= jwt.sign({username,email,userId:user.insertedId},"charan");
        console.log(user);
        res.status(200).json({"status":"success",'msg':'user created successfully',"jwt_token":jwt_token,'updateduser':userDetails});
    }
})

app.post('/user/login',async(req,res)=>{
    const userDetails=req.body;
    console.log(userDetails);
    let checkUserExists=await db.collection('users').findOne({username:userDetails.username});
    let checkPasswordExists=await bcrypt.compare(userDetails.password,checkUserExists.password)
    if(checkUserExists===null){
        res.json({'msg':'user not found'});
    }
    else if(checkPasswordExists){
        res.json({'msg':'successfully logged in'});
    }
    else{
        res.json({'msg':'please check the details'});
    }
})


app.post('/user/profile',validUser,async(req,res)=>{

    console.log("enter backend haha");
    // get the data from request
    const file = req.body.imageData; //get the file data through req.file irrespective of name of file
    // console.log(file);
    const {location}=req.body; //gte normal data
    // console.log(req.body);
    const oldProfile= await db.collection('profiles').findOne({username:req.currentUser?.username});
    
    try{
        const uploadResponse= await cloudinary.uploader.upload(`data:image/jpeg;base64,${file}`,{folder:"dribbleUsers"});
        console.log(uploadResponse,"cloud");
        const profileUrl=uploadResponse.secure_url;
        const public_id=uploadResponse.public_id;
        console.log(profileUrl,"proUrl");
        if(oldProfile!= null){ //update profile
            const oldProfile_public_id=oldProfile.public_id;
            await cloudinary.uploader.destroy(oldProfile_public_id,()=>{console.log("deleted old profile")}); //delete old profile
            await db.collection('profiles').updateOne(
                { username: req.currentUser.username },
                { $set: { profileUrl, public_id, location } }
              );

              res.status(200).json({ "msg": "successfully Updated" });
        }
        else{ //create new profile
            await db.collection('profiles').insertOne({profileUrl,public_id,location,username:req.currentUser?.username});
            res.status(200).json({"msg":"successfully inserted"});
        }
    }
    catch(e){
        console.log("here error backend",e);
        res.status(400).json({"error from backe":e.message});
    }
})

app.post('/user/default-profile',validUser,async(req,res)=>{
    const oldProfile= await db.collection('profiles').findOne({username:req.currentUser?.username});
    const {location,defaultImage}=req.body;
    const imageSplit=defaultImage.split('/');

    const public_id = imageSplit[imageSplit.length-1];
    const profileUrl=defaultImage;
    const defaultPublicIds=['obdawmtikeraefpkeira','mdhy3p1o9wrq2w6dtlit','mpryzldzgdkn9s6sogmr','zdali6cgfzrw8fz8e13g','dpkd0ftqwel6kqed8dlb','jyx633zukbyzpetqd2be','bwssnxbnhhhlrnxjm1vt','jowsw66qqfxny8b3kwhe'];

    if(oldProfile!= null){ //update profile
        const oldProfile_public_id=oldProfile.public_id;
        if(! oldProfile_public_id in defaultPublicIds){
            await cloudinary.uploader.destroy(oldProfile_public_id,()=>{console.log("deleted old profile")}); //delete old profile
        }
        
        await db.collection('profiles').updateOne(
            { username: req.currentUser.username },
            { $set: { profileUrl, public_id, location } }
          );

          res.status(200).json({ "msg": "successfully Updated" });
    }
    else{ //create new profile
        await db.collection('profiles').insertOne({profileUrl,public_id,location,username:req.currentUser?.username});
        res.status(200).json({"msg":"successfully inserted"});
    }
})

app.get('/users/profile/:userId',async(req,res)=>{
    const {userId }= req.params;

    const {username}=await db.collection('users').findOne({_id:new mongoose.Types.ObjectId(userId)});
    const profileDetails= await db.collection('profiles').findOne({username:username});
    res.json({...profileDetails});
})

app.get('/users/email-verification/:userId',async(req,res)=>{
    const {userId }= req.params;
    if(mongoose.isValidObjectId(userId)){
        res.status(400).json({'msg':"not a valid user"});
        return;
    }
    const responseDb=await db.collection('users').findOne({_id:new mongoose.Types.ObjectId(userId)});
    if(responseDb ===null){
        res.status(400).json({'msg':"not a valid user"});
        return;
    }
    const {username}=responseDb;

    await db.collection('users').updateOne({username:username},{ $set: { emailVerified:true } });
    res.status(200).json({'msg':"successfully verified"});
})

app.post('/users/exists',async(req,res)=>{
    const {newUserName}=req.body;
    console.log(newUserName,"userput");
    const isExists=await db.collection('users').findOne({username:newUserName});
    if(isExists === null){
        res.status(200).json({userExists:false});
    }
    else{
        res.status(400).json({userExists:true});
    }
})

app.get('/users/',validUser,async(req,res)=>{
    const allUsers= await db.collection('users').find().toArray();
    res.status(200).json({"users":allUsers});
})

app.get('/getdata/:userQuery',async(req,res)=>{
    const userQuery = req.params.userQuery;
    console.log(userQuery);
    const clients_id="MoMBkj4oXIL2za6kWwh4U3hT2RR_hNXfue0WO4qLjwY";
    const results= await fetch(`https://api.unsplash.com/search/photos?page=1&per_page=10&query=${userQuery}&client_id=${clients_id}`);
    const data=await results.json();
    console.log(data);
    const formattedData = data.results.map(result => ({
        url: result.urls.small,
        description: result.alt_description,
        likes: result.likes,
        creatorId: result.user?.id,
        creatorName: result.user?.username,
        creatorImage: result.user?.profile_image?.small, // Use small size for efficiency
      }));
    console.log(formattedData);

    res.status(200).json(formattedData);
})

app.get('/users/verification/:userId',async(req,res)=>{
    const userId = req.params.userId;
    try {
        // Find user by ID using Mongoose
        const userData = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(userId) });

        if (userData) {
            userData.emailVerified = true;
            await db.collection('users').updateOne({ _id: userId }, { $set: { emailVerified: true } });
            console.log('backend', userData);

            res.status(200).json({ msg: 'success' ,userId,userData: userData});
        } else {
        
            res.status(404).json({ msg: 'User not found',userId,userData: userData });
        }
    } catch (error) {
        console.error(error); 
        res.status(404).json({ msg: 'Internal server error' ,userId,error,mess:error.message });
    }
})

app.get('/hi',async(req,res)=>{
    res.json({'msg':'back'});
})

app.listen(PORT,(req,res)=>{
    console.log('listening at '+PORT);
})