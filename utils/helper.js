const jwt=require('jsonwebtoken');

exports.validUser = (req,res,next)=>{
    const jwt_token_way=req.headers['authorization']; 
    if(jwt_token_way==undefined){
        res.json({"msg":"no jwt token"})
    }
    else{
        const jwt_token = jwt_token_way.split(" ")[1];
        console.log(jwt_token);
        jwt.verify(jwt_token,"charan",(err,payload)=>{
            if(err){
                res.json({"msg":"there is an erro in token jwt"});
            }
            else{
                console.log(payload);
                const {username, email } = payload; // Modify property names based on your JWT payload structure
                req.currentUser = { username, email };
            }
        })
    }
    next();
}
