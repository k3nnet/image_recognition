import { Component, Input, ViewChild, ElementRef, AfterViewInit,OnInit, Inject } from '@angular/core';
import * as faceapi from 'face-api.js';
import { WebcamImage, WebcamInitError, WebcamUtil } from 'ngx-webcam';
import { Subject, Observable } from 'rxjs';
import * as canvas from 'canvas';
import * as $ from 'jquery';
import { DOCUMENT } from '@angular/common';
import { MtcnnOptions } from 'face-api.js';
import { ToastrService } from 'ngx-toastr';
import { MatVideoComponent } from 'mat-video/app/video/video.component';
import { AngularFireDatabase, AngularFireObject } from '@angular/fire/database';


const Canvas = canvas.Canvas;
const Image = canvas.Image;
const ImageData = canvas.ImageData;

faceapi.env.monkeyPatch({
  Canvas: HTMLCanvasElement,
  Image: HTMLImageElement,
  ImageData: ImageData,
  Video: HTMLVideoElement,
  createCanvasElement: () => document.createElement('canvas'),
  createImageElement: () => document.createElement('img')
})
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements  OnInit, AfterViewInit {
  @Input() cameraName: string = "";
  
  video: HTMLVideoElement;
  title = 'Facial Expressions recognition';
  // tiny_face_detector options
  inputSize = 512;
  scoreThreshold = 0.5;
  withFaceLandmarks = false;
  withBoxes = true;
  videoEl;
  stream;
 private expressionsRef: AngularFireObject<any>;
 private expressions: Observable<any[]>;
  public webcamImage: WebcamImage = null;
  private doc: Document
  // webcam snapshot trigger
  private trigger: Subject<void> = new Subject<void>();
  // switch to next / previous / specific webcam; true/false: forward/backwards, string: deviceId
  private nextWebcam: Subject<boolean | string> = new Subject<boolean | string>();

  private  inputVideo: HTMLVideoElement
  private imageCanvas:HTMLCanvasElement
  private videoCanvas:HTMLCanvasElement
  public inputImage:HTMLImageElement

  public showVideo:boolean;
  public loading:boolean;
  private db:AngularFireDatabase
  //=====================================================================================================//
  constructor(@Inject(DOCUMENT) document,private toastr: ToastrService,db: AngularFireDatabase
  ) {
    this.doc = document;
    this.db=db;
    this.showVideo=false;
    this.loading=false;
    this.expressionsRef= db.object('Expressions');
    this.expressions = this.expressionsRef.valueChanges();
   
  }

  ngOnInit() {
   
   //load all the models
   this.loadModels();
   
   
   


  }


 async onDetectFaces(){
   this.loading=true;
  console.log(<HTMLImageElement>this.doc.getElementById("inputImage"))
      //detects facesim
      let img=<HTMLImageElement>this.doc.getElementById("inputImage");
      let imageCanvas=<HTMLCanvasElement>this.doc.getElementById("overlayImage")
     
      await this.faceRecognition(img,imageCanvas)
      this.loading=false

      
  }




  ngAfterViewInit() {
    //prepare image to detect  faces and canvas
    this.inputVideo = <HTMLVideoElement>this.doc.getElementById("inputVideo")
    this.videoCanvas = <HTMLCanvasElement>this.doc.getElementById("overlayVideo")
    console.log("view loaded")
    console.log(this.inputVideo);

  }

  public  async onShowVideo(showVideo){
    console.log(this.doc)
    if(showVideo){
      this.showVideo=false
    }else{
      console.log(this.inputVideo)
     await this.loadVideo(this.doc,this.videoFaceDetection,this.faceRecognition,this.getKeyByValue)
    
     this.showVideo=true

      
    }
  }

  public saveExpression(expression:string){

    this.expressionsRef.set({ name: expression });
  }

  public startVideoDetection(){
    console.log(this.inputVideo)
    
    
  }
  async loadModels() {
    // load the models
    this.loading=true;
    const MODEL_URL = './assets/models/'

    await faceapi.loadSsdMobilenetv1Model(MODEL_URL)
    await faceapi.loadFaceLandmarkModel(MODEL_URL)
    await faceapi.loadFaceRecognitionModel(MODEL_URL)
    await faceapi.loadFaceExpressionModel(MODEL_URL)
    await faceapi.loadMtcnnModel(MODEL_URL)
   
    this.loading=false;
    this.toastr.success('Models Loaded!');
  
   


  }

  public async loadVideo(doc:Document,videoFaceDetection:any,faceRecognition:any,getKeyByValue:any){
    
  //stream back the visual to the UI
   navigator.getUserMedia({ video: {} }, (stream)=>{
      console.log("loaded video");
      
      const videoEl = <HTMLVideoElement>doc.getElementById("inputVideo");
      const canvas=<HTMLCanvasElement>doc.getElementById('overlayVideo');
     
      let videoPlayer = <HTMLVideoElement>videoEl.getElementsByTagName("video")[0];
      console.log(videoPlayer);
      videoEl.getElementsByTagName("video")[0]['srcObject'] = stream;

      videoPlayer.addEventListener('playing', (videoEl) =>  {
        console.log(videoEl['srcElement'])
       
       setInterval(() => this.faceRecognition(<HTMLVideoElement>videoEl['srcElement'],canvas) ,5000 )
      });
        
    }, function (err) { console.error(err); })
   

  }

  async myFunction(videoEl) {
    // run face detection & recognition
    // ...
    
    setTimeout(() => this.myFunction(videoEl))
  }

 

  public async videoFaceDetection(input:HTMLVideoElement,canvas:HTMLCanvasElement,){
   
    console.log(input)
    let width=400;
    let height=240;

   console.log(width,height)
   input['width']=width;
   input['height']=height;
    
    const mtcnnParams = {
      // number of scaled versions of the input image passed through the CNN
        // of the first stage, lower numbers will result in lower inference time,
        // but will also be less accurate
        maxNumScales: 10,
        // scale factor used to calculate the scale steps of the image
        // pyramid used in stage 1
        scaleFactor: 0.709,
        // the score threshold values used to filter the bounding
        // boxes of stage 1, 2 and 3
        scoreThresholds: [0.6, 0.7, 0.7],
        // mininum face size to expect, the higher the faster processing will be,
        // but smaller faces won't be detected
            minFaceSize: 100
    }
    const options = new faceapi.MtcnnOptions(mtcnnParams)
    const displaySize = { width:width, height:height }
    faceapi.matchDimensions(canvas, displaySize)

    //detects faces on a screen
    let fullFaceDescriptions = await faceapi.detectAllFaces(input, options).withFaceLandmarks().withFaceDescriptors().withFaceExpressions()
    console.log(fullFaceDescriptions)
    fullFaceDescriptions = await faceapi.resizeResults(fullFaceDescriptions, input)
    faceapi.draw.drawDetections(canvas, fullFaceDescriptions)

    return fullFaceDescriptions;
   
     

  }
  
  

  public async faceRecognition(videoEl:HTMLVideoElement | HTMLImageElement,canvas:HTMLCanvasElement){

    //detects faces
    console.log(videoEl)
    let fullFaceDescriptions:any;
    //check whether it's an image or video element
    if (videoEl instanceof HTMLVideoElement){
      fullFaceDescriptions=await this.videoFaceDetection(<HTMLVideoElement>videoEl,canvas)
    }else if(videoEl instanceof HTMLImageElement){
      fullFaceDescriptions=await this.detectFaces(<HTMLImageElement>videoEl,canvas)
    }
    


    const labels = ['sheldon']
    console.log(this.getKeyByValue)
    const labeledFaceDescriptors = await Promise.all(
      labels.map(async label => {
        // fetch image data from urls and convert blob to HTMLImage element
        const imgUrl ='../assets/images/'+`${label}.png`
        const img = await faceapi.fetchImage(imgUrl)
        
        // detect the face with the highest score in the image and compute it's landmarks and face descriptor
        const fullFaceDescription = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor()
        
        if (!fullFaceDescription) {
          throw new Error(`no faces detected for ${label}`)
        }
        
        const faceDescriptors = [fullFaceDescription.descriptor]
        return new faceapi.LabeledFaceDescriptors(label, faceDescriptors)
      })
    )

    const maxDescriptorDistance = 0.6
    console.log(labeledFaceDescriptors)
    console.log(this.getKeyByValue)
  const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, maxDescriptorDistance)
    console.log()
  const results = fullFaceDescriptions.map(function(fd) { 
    console.log(fd);
    return {faceMatcher:faceMatcher.findBestMatch(fd['descriptor']),faceExpressions:fd['expressions']}
  
  })
  console.log(this.getKeyByValue)
  console.log(results)
  results.forEach((bestMatch, i) => {
    console.log(bestMatch['faceExpressions']['angry'])
    let expressions= bestMatch['faceExpressions'];
   
    let max=Math.max.apply(null, Object.values(expressions)) 
    
    console.log()
    const box = fullFaceDescriptions[i]['detection']['box']
    const text =this.getKeyByValue((expressions),max);
    this.saveExpression(text)
    const drawBox = new faceapi.draw.DrawBox(box, { label: text })
    drawBox.draw(canvas)
  })

  }

  public getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
  }
  


  public async detectFaces(input:HTMLImageElement,canvas:any) {


    this.inputImage=<HTMLImageElement>this.doc.getElementById("inputImage");
  
    
    let width=input['width'];
    let height=input['height'];
    console.log(width,height)
   
    const displaySize = { width:width, height:height }
    console.log(displaySize);
    console.log(canvas);
    faceapi.matchDimensions(canvas, displaySize)

    let fullFaceDescriptions = await faceapi.detectAllFaces(input).withFaceLandmarks().withFaceDescriptors().withFaceExpressions()
    fullFaceDescriptions = faceapi.resizeResults(fullFaceDescriptions, input)


    console.log(fullFaceDescriptions)
    faceapi.draw.drawDetections(canvas, fullFaceDescriptions)
    return fullFaceDescriptions;
   
    
   
  }





  public get triggerObservable(): Observable<void> {
    return this.trigger.asObservable();
  }

  public get nextWebcamObservable(): Observable<boolean | string> {
    return this.nextWebcam.asObservable();
  }
}
