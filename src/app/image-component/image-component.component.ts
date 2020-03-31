
import { Component, Input, ViewChild, ElementRef, AfterViewInit, OnInit, Inject } from '@angular/core';
import * as faceapi from 'face-api.js';
import { Observable } from 'rxjs';
import * as canvas from 'canvas';
import { DOCUMENT } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { AngularFireDatabase, AngularFireObject } from '@angular/fire/database';
import { DrawBox } from 'tfjs-image-recognition-base/build/commonjs/draw';
import * as d3 from 'd3';
import {DataModel} from '../data/model';
import {MatVideoModule} from 'mat-video'
import { MatVideoComponent } from 'mat-video/app/video/video.component';

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
  selector: 'app-image-component',
  templateUrl: './image-component.component.html',
  styleUrls: ['./image-component.component.css']
})
export class ImageComponentComponent implements OnInit{
 

  title = 'Facial recognition DEMO';
  private expressions: Observable<any[]>;
  private expressionsRef: AngularFireObject<any>;

 
  public loading: boolean;
 

  //view properties
  doc: Document
  htmlImageEl: HTMLImageElement
  imageCanvas: HTMLCanvasElement

  inputSize = 512;
  scoreThreshold = 0.5;
  withFaceLandmarks = false; //disable face landmark detection
  withBoxes = true;
  
  constructor(@Inject(DOCUMENT) document, private toastr: ToastrService) { 
    this.doc = document;
    this.loading = false;
  

  }

  ngOnInit() {

    // give everything a chance to get loaded before starting the animation to reduce choppiness
    setTimeout(() => {
      //load models
      console.log("start loading models")
      this.loadModels();
    }, 1000);




  }




  async onDetectFaces(mode: string) {
    let fullFaceDescriptions: any;
    this.loading = true;
    console.log(<HTMLImageElement>this.doc.getElementById("inputImage"))
    //detects faces
    this.htmlImageEl = <HTMLImageElement>this.doc.getElementById("inputImage");
    this.imageCanvas = <HTMLCanvasElement>this.doc.getElementById("overlayImage")
    console.log(this.htmlImageEl)
    fullFaceDescriptions = await this.detectFaces(this.htmlImageEl, this.imageCanvas)

    await this.faceRecognition(fullFaceDescriptions, this.imageCanvas, mode)
    this.loading = false
    return fullFaceDescriptions
  }


 
  async loadModels() {
    // load the models
    console.log("loading models")
    this.loading = true;
    const MODEL_URL = './assets/models/'

    await faceapi.loadSsdMobilenetv1Model(MODEL_URL)
    await faceapi.loadFaceLandmarkModel(MODEL_URL)
    await faceapi.loadFaceRecognitionModel(MODEL_URL)
    await faceapi.loadFaceExpressionModel(MODEL_URL)
   

    this.loading = false;
    this.toastr.success('Models Loaded!');




  }












  public async faceRecognition(fullFaceDescriptions: faceapi.WithFaceExpressions<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{
    detection: faceapi.FaceDetection;
  }, faceapi.FaceLandmarks68>>>[], canvas: HTMLCanvasElement, mode: string) {


    const labels = ['Barney', 'Lily', 'Marshall', 'Robin', 'Ted']
    const labeledFaceDescriptors = await Promise.all(
      labels.map(async label => {
        // fetch image data from urls and convert blob to HTMLImage element
        const imgUrl = '../assets/images/' + `${label}.jpeg`
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
    //match the face descriptors of the detected faces from our input image to our reference data
    // 0.6 is a good distance threshold value to judge
    // whether the descriptors match or not
    const maxDescriptorDistance = 0.6
    console.log(labeledFaceDescriptors)
    console.log(fullFaceDescriptions)

    //match the face descriptors of the detected faces from our input image to our reference data
    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, maxDescriptorDistance)
    console.log()
    const results = fullFaceDescriptions.map(function (fd) {
      console.log(fd);
      return { faceMatcher: faceMatcher.findBestMatch(fd['descriptor']), faceExpressions: fd['expressions'] }

    })
   
  results.forEach((bestMatch, i) => {
      console.log(bestMatch['faceExpressions']['angry'])
      let expressions = bestMatch['faceExpressions'];
      let recognize = bestMatch['faceMatcher'].toString().split(" ")[0]
      let max = Math.max.apply(null, Object.values(expressions))

      console.log(recognize)
      const box = fullFaceDescriptions[i]['detection']['box']
      let text = ""

      if (mode === "expression") {
        text = recognize + ":" + this.getKeyByValue((expressions), max);
        this.toastr.success(this.getKeyByValue((expressions), max) + " " + recognize);
      } else {
        text = recognize;
      }
      //draw the bounding boxes together with their labels into a canvas to display the results
      const drawBox = new faceapi.draw.DrawBox(box, { label: text })
      drawBox.draw(canvas)
    })

  }

  public getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
  }

  



  public async detectFaces(input: HTMLImageElement, canvas: HTMLCanvasElement) {


    this.htmlImageEl = <HTMLImageElement>this.doc.getElementById("inputImage");


    let width = input['width'];
    let height = input['height'];
    const displaySize = { width: width, height: height }

    //resize the canvas to match the input image dimension
    faceapi.matchDimensions(canvas, displaySize)

    let fullFaceDescriptions = await faceapi.detectAllFaces(input).withFaceLandmarks().withFaceDescriptors().withFaceExpressions()

    //The returned bounding boxes and landmark positions are relative to the original image / media size. In case the displayed image size does not correspond to the original image size you can simply resize 
    fullFaceDescriptions = faceapi.resizeResults(fullFaceDescriptions, input)


    console.log(fullFaceDescriptions)
    // faceapi.draw.drawDetections(canvas, fullFaceDescriptions)
    return fullFaceDescriptions;



  }





}
