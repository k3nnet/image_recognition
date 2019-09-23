import { Component, Input, ViewChild, ElementRef, AfterViewInit, Inject } from '@angular/core';
import * as faceapi from 'face-api.js';
import { WebcamImage, WebcamInitError, WebcamUtil } from 'ngx-webcam';
import { Subject, Observable } from 'rxjs';
import * as canvas from 'canvas';
import * as $ from 'jquery';
import { DOCUMENT } from '@angular/common';


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
  // @ViewChild('myImage',{ static: false }) imageInput: HTMLVideoElement;
  title = 'imageRecognition';
  // tiny_face_detector options
  inputSize = 512;
  scoreThreshold = 0.5;
  withFaceLandmarks = false;
  withBoxes = true;
  videoEl;
  stream;
  // latest snapshot
  public webcamImage: WebcamImage = null;
  private doc: Document

  // webcam snapshot trigger
  private trigger: Subject<void> = new Subject<void>();
  // switch to next / previous / specific webcam; true/false: forward/backwards, string: deviceId
  private nextWebcam: Subject<boolean | string> = new Subject<boolean | string>();
  private input: HTMLVideoElement
  private canvas:HTMLCanvasElement
  constructor(@Inject(DOCUMENT) document
  ) {
    this.doc = document;
  }

  ngOnInit() {
   
   //load all the models
   this.loadModels();
  


  }
  public seconds:number ;

 public triggerSnapshot(): void {
   this.seconds = 3;
   setTimeout(()=>{
     this.seconds = 2;
    setTimeout(()=>{
      this.seconds = 1
      setTimeout(()=>{
        this.trigger.next(); 
        this.seconds = null;
      },2000)
    },2000) 
   },2000)
      
 }



 async onDetectFaces(){
      //prepare image to detect  faces and canvas
 const input = <HTMLImageElement>this.doc.getElementById("myImage")
 this.canvas = <HTMLCanvasElement>this.doc.getElementById("overlay")
      //detects faces
     
      this.faceRecognition(await this.detectFaces(input),this.canvas)

  }
  ngAfterViewInit() {


  }
  public handleImage(webcamImage: WebcamImage): void {
    console.info('received webcam image', webcamImage);
    this.webcamImage = webcamImage;
  }

  async loadModels() {
    // load the models
    const MODEL_URL = './assets/models/'

    await faceapi.loadSsdMobilenetv1Model(MODEL_URL)
    await faceapi.loadFaceLandmarkModel(MODEL_URL)
    await faceapi.loadFaceRecognitionModel(MODEL_URL)
    await faceapi.loadFaceExpressionModel(MODEL_URL)
    const videoEl =this.doc.getElementById("inputVideo")
    navigator.getUserMedia(
      { video: {} },
      stream => videoEl['srcObject'] = stream,
      err => console.error(err)
    )
   


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

  public async detectFaces(input) {


    

    const displaySize = { width: input['width'], height: input['height'] }
    faceapi.matchDimensions(this.canvas, displaySize)

    let fullFaceDescriptions = await faceapi.detectAllFaces(input).withFaceLandmarks().withFaceDescriptors().withFaceExpressions()
    fullFaceDescriptions = faceapi.resizeResults(fullFaceDescriptions, input)


    console.log(fullFaceDescriptions)
    faceapi.draw.drawDetections(this.canvas, fullFaceDescriptions)
    return fullFaceDescriptions;
   
    
   
  }





  public get triggerObservable(): Observable<void> {
    return this.trigger.asObservable();
  }

  public get nextWebcamObservable(): Observable<boolean | string> {
    return this.nextWebcam.asObservable();
  }
}
