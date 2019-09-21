var express=require('express');
var path =require('path');
var app=express();



app.use(express.static(__dirname+"/dist/imageRecognition"));

app.get('/',function(req,res){
    res.sendFile(path.join(__dirname+"/dist/imageRecognition/index.html"))
})