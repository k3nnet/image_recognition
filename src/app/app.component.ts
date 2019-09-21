import { Component, Input, ViewChild, ElementRef, AfterViewInit, Inject } from '@angular/core';
import * as faceapi from 'face-api.js';
import {WebcamImage, WebcamInitError, WebcamUtil} from 'ngx-webcam';
import {Subject,Observable} from 'rxjs';
import * as canvas from 'canvas';
import * as $ from 'jquery';
import { DOCUMENT } from '@angular/common'; 

const  Canvas = canvas.Canvas;
const Image=canvas.Image;
const ImageData=canvas.ImageData;

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
  @Input() cameraName:string = "";
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
 private doc:Document

 // webcam snapshot trigger
 private trigger: Subject<void> = new Subject<void>();
 // switch to next / previous / specific webcam; true/false: forward/backwards, string: deviceId
 private nextWebcam: Subject<boolean|string> = new Subject<boolean|string>();
  private input:HTMLVideoElement
constructor(@Inject(DOCUMENT) document
) {
  this.doc=document;
}

ngOnInit() {
this.loadModels();

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
 
 
  }


  public async detectFaces(){

    //prepare image to detect  faces and canvas
    const input = <HTMLImageElement>this.doc.getElementById("myImage")
    const canvas = <HTMLCanvasElement>this.doc.getElementById("overlay")
  
    
    const displaySize = { width: input.width, height: input.height }
    faceapi.matchDimensions(canvas, displaySize)
    
    let fullFaceDescriptions = await faceapi.detectAllFaces(input).withFaceLandmarks().withFaceDescriptors()
    fullFaceDescriptions = faceapi.resizeResults(fullFaceDescriptions,input)
   
    
    console.log(input)
    faceapi.draw.drawDetections(canvas, fullFaceDescriptions)
    /* Display face landmarks */
     const detectionsWithLandmarks = await faceapi
     .detectAllFaces(input).
     withFaceLandmarks()
    // resize the detected boxes and landmarks in case your displayed image has a different size than the original
    const resizedResults = faceapi.resizeResults(detectionsWithLandmarks, displaySize)
    // draw detections into the canvas
    faceapi.draw.drawDetections(canvas, resizedResults)
    // draw the landmarks into the canvas
    faceapi.draw.drawFaceLandmarks(canvas, resizedResults)
  }


  
  public get triggerObservable(): Observable<void> {
    return this.trigger.asObservable();
  }

  public get nextWebcamObservable(): Observable<boolean|string> {
    return this.nextWebcam.asObservable();
  }
}
