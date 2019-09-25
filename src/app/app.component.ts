import { Component, Input, ViewChild, ElementRef, AfterViewInit, Inject } from '@angular/core';
import * as faceapi from 'face-api.js';
import { WebcamImage, WebcamInitError, WebcamUtil } from 'ngx-webcam';
import { Subject, Observable } from 'rxjs';
import * as canvas from 'canvas';
import * as $ from 'jquery';
import { DOCUMENT } from '@angular/common';
import { MtcnnOptions } from 'face-api.js';
import { ToastrService } from 'ngx-toastr';
import { MatVideoComponent } from 'mat-video/app/video/video.component';

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
export class AppComponent implements AfterViewInit {
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

  private showVideo:boolean;
  private loading:boolean;
  //=====================================================================================================//
  constructor(@Inject(DOCUMENT) document,private toastr: ToastrService
  ) {
    this.doc = document;
    //prepare image to detect  faces and canvas
    this.inputVideo = <HTMLVideoElement>this.doc.getElementById("inputVideo")
    this.videoCanvas = <HTMLCanvasElement>this.doc.getElementById("overlayVideo")
    this.showVideo=false;
    this.loading=false;
   
  }

  ngOnInit() {
   
   //load all the models
   this.loadModels();
   
   
   


  }


 async onDetectFaces(){
   this.loading=true;
  console.log(<HTMLImageElement>this.doc.getElementById("inputImage"))
      //detects facesim
      let img=await this.detectFaces(<HTMLImageElement>this.doc.getElementById("inputImage"));
     
      await this.faceRecognition(img,this.imageCanvas)
      this.loading=false

      
  }




  ngAfterViewInit() {


  }

  public onShowVideo(showVideo){
    console.log(showVideo)
    if(showVideo){
      this.showVideo=false
    }else{
      const MODEL_URL = './assets/models/';
      this.loadVideo(MODEL_URL);
      this.showVideo=true
      this.loadModels()
      

      
    }
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

    if(this.showVideo){
     console.log("loading models for webcame")
      this.loadVideo(MODEL_URL);
    }
    this.loading=false;
    this.toastr.success('Models Loaded!');
  
   


  }

  public async loadVideo(MODEL_URL){
    
    await faceapi.loadMtcnnModel(MODEL_URL)
   console.log("loaded model")
    const videoEl =<HTMLVideoElement>this.doc.getElementById("inputVideo")
   console.log(videoEl);
   
    this.inputVideo=<HTMLVideoElement>videoEl.getElementsByTagName("video")[0]
   
    console.log(this.inputVideo)
   await navigator.getUserMedia(
      { video: {} },function(stream ){
       
        videoEl.getElementsByTagName("video")[0]['srcObject'] = stream
       
       
      },
      function(err){ console.error(err)}
    )
    console.log(this.inputVideo)
    this.inputVideo.addEventListener('playing', () => {
      console.log('video playing');
      
      this.videoFaceDetection(this.inputVideo)
      
    });

  }

 

  public async videoFaceDetection(input){
   
    console.log(input)
    
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
            minFaceSize: 200
    }
    const options = new faceapi.MtcnnOptions(mtcnnParams)
    const inputVide =await  this.doc.getElementById('inputVideo');
   const mtcnnResults = await faceapi.mtcnn(input, options);
  console.log(inputVide.attributes)
   let width=400;
   let height=300;
   console.log(width,height)
  
   const displaySize = { width:width, height:height }
   faceapi.matchDimensions(<HTMLCanvasElement>this.doc.getElementById('overlayVideo'), displaySize)
    const fullFaceDescriptions = await faceapi.detectAllFaces(input, options).withFaceLandmarks().withFaceDescriptors()
    console.log(fullFaceDescriptions)
       faceapi.draw.drawDetections(<HTMLCanvasElement>this.doc.getElementById('overlayVideo'), fullFaceDescriptions)
      faceapi.draw.drawFaceLandmarks(<HTMLCanvasElement>this.doc.getElementById('overlayVideo'), fullFaceDescriptions)

  }
  

  public async faceRecognition(fullFaceDescriptions,canvas){
    const labels = ['sheldon']

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
  const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, maxDescriptorDistance)
    console.log()
  const results = fullFaceDescriptions.map(function(fd) { 
    console.log(fd);
    return {faceMatcher:faceMatcher.findBestMatch(fd['descriptor']),faceExpressions:fd['expressions']}
  
  })
  console.log(results)
  results.forEach((bestMatch, i) => {
    console.log(bestMatch['faceExpressions']['angry'])
    let expressions= bestMatch['faceExpressions'];
   
    let max=Math.max.apply(null, Object.values(expressions)) 
    
    console.log()
    const box = fullFaceDescriptions[i]['detection']['box']
    const text = this.getKeyByValue((expressions),max);
    const drawBox = new faceapi.draw.DrawBox(box, { label: text })
    drawBox.draw(canvas)
  })

  }

  public getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
  }
  


  public async detectFaces(input:HTMLImageElement) {


    this.inputImage=<HTMLImageElement>this.doc.getElementById("inputImage");
    this.imageCanvas=<HTMLCanvasElement>this.doc.getElementById("overlayImage")
    
    let width=input['width'];
    let height=input['height'];
    console.log(width,height)
   
    const displaySize = { width:width, height:height }
    console.log(displaySize);
    console.log(this.imageCanvas);
    faceapi.matchDimensions(this.imageCanvas, displaySize)

    let fullFaceDescriptions = await faceapi.detectAllFaces(input).withFaceLandmarks().withFaceDescriptors().withFaceExpressions()
    fullFaceDescriptions = faceapi.resizeResults(fullFaceDescriptions, input)


    console.log(fullFaceDescriptions)
    faceapi.draw.drawDetections(this.imageCanvas, fullFaceDescriptions)
    return fullFaceDescriptions;
   
    
   
  }





  public get triggerObservable(): Observable<void> {
    return this.trigger.asObservable();
  }

  public get nextWebcamObservable(): Observable<boolean | string> {
    return this.nextWebcam.asObservable();
  }
}
