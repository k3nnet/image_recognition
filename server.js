var express=require('express');
var path =require('path');
var app=express();



app.use(express.static(__dirname+"/dist/imageRecognition"));

app.get('/',function(req,res){
    res.sendFile(path.join(__dirname+"/dist/imageRecognition/index.html"))
})

var port=process.env.PORT || 4000;

app.listen(port,function(){
    console.log('server started on port '+port)
})