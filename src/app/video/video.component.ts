
import { Component, Input, ViewChild, ElementRef, AfterViewInit, OnInit, Inject } from '@angular/core';
import * as faceapi from 'face-api.js';
import { Observable, Subject } from 'rxjs';
import * as canvas from 'canvas';
import { DOCUMENT } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { AngularFireDatabase, AngularFireObject } from '@angular/fire/database';
import { DrawBox } from 'tfjs-image-recognition-base/build/commonjs/draw';
import * as d3 from 'd3';
import {DataModel} from '../data/model';
import {MatVideoModule} from 'mat-video'
import { MatVideoComponent } from 'mat-video/app/video/video.component';
import { WebcamInitError, WebcamUtil } from 'ngx-webcam';

faceapi.env.monkeyPatch({
  Canvas: HTMLCanvasElement,
  Video: HTMLVideoElement,
  createCanvasElement: () => document.createElement('canvas')
})
@Component({
  selector: 'app-video',
  templateUrl: './video.component.html',
  styleUrls: ['./video.component.css']
})


export class VideoComponent implements OnInit  {
  public loading: boolean;


  // toggle webcam on/off
  public showWebcam = true;
  public allowCameraSwitch = true;
  public multipleWebcamsAvailable = false;
  public deviceId: string;
   // switch to next / previous / specific webcam; true/false: forward/backwards, string: deviceId
   private nextWebcam: Subject<boolean|string> = new Subject<boolean|string>();

  //view properties
  doc: Document
  videoCanvas: HTMLCanvasElement
  htmlVideoEl: HTMLVideoElement
  @ViewChild('chart',{static:true})
  @ViewChild('video',{static:false}) matVideo: MatVideoComponent;

  private chartContainer: ElementRef;

  isExpression=false;

  title = 'Facial recognition DEMO';
  private db: AngularFireDatabase
  private expressions: Observable<any[]>;
  private expressionsRef: AngularFireObject<any>;

  public showVideo: boolean;

  public showGraph:boolean;
  public isStarted:boolean;

  labeledFaceDescriptors:any;
  video: HTMLVideoElement;

  chartData: Array<any>;
  inputSize = 512;
  scoreThreshold = 0.5;
  withFaceLandmarks = false; //disable face landmark detection
  withBoxes = true;
  videoEl;
  stream;
  margin = {top: 20, right: 20, bottom: 20, left: 40};
  constructor(private toastr: ToastrService ,@Inject(DOCUMENT) document) {
    this.doc = document;
    this.isStarted=false;
    this.chartData=[{
      expression:"neutral",
      frequency:0
    },{
      expression:"sad",
      frequency:0
    },{
      expression:"happy",
      frequency:0
    },{
      expression:"surprised",
      frequency:0
    }]
    

   }
 

  ngOnInit() {

    WebcamUtil.getAvailableVideoInputs()
    .then((mediaDevices: MediaDeviceInfo[]) => {
      this.multipleWebcamsAvailable = mediaDevices && mediaDevices.length > 1;
    });
      // give everything a chance to get loaded before starting the animation to reduce choppiness
      setTimeout(() => {
        //load models
        console.log("start loading models")
        this.loadModels();
      }, 1000);
     
  
  }

  public get nextWebcamObservable(): Observable<boolean|string> {
    return this.nextWebcam.asObservable();
  }

  public toggleWebcam(): void {
    this.showWebcam = !this.showWebcam;
  }
  public showNextWebcam(directionOrDeviceId: boolean|string): void {
    // true => move forward through devices
    // false => move backwards through devices
    // string => move to device with given deviceId
    this.nextWebcam.next(directionOrDeviceId);
  }
  public cameraWasSwitched(deviceId: string): void {
    console.log('active device: ' + deviceId);
    this.deviceId = deviceId;
  }
  public handleInitError(error: WebcamInitError): void {
    if (error.mediaStreamError && error.mediaStreamError.name === "NotAllowedError") {
      console.warn("Camera access was not allowed by user!");
    }
  }

  public async loadVideo(mode?: string) {
 
    const constraints={ audio: false, video: { facingMode: "user" ,video: { frameRate: { ideal: 10, max: 15 } }} }
    navigator.mediaDevices.getUserMedia(constraints).then((stream)=>{
    
      //grab video element and the canvas element
      const videoEl = <HTMLVideoElement>this.doc.getElementById("webcam")
      const canvas = <HTMLCanvasElement>this.doc.getElementById("overlayVid")
      let videoPlayer = <HTMLVideoElement> videoEl.getElementsByTagName("video")[0];
     
      
      //attaching our webcam stream to the video element 
      videoPlayer['srcObject'] = stream;
     
      videoPlayer.addEventListener('play', async (videoEl) => {
         
        console.log(videoEl)
        await this.run(videoEl,canvas,mode);
        
      
        
    });
    }).catch(err=>{
      console.log("unhanled error: "+ err);
    })
 


  }

  async onDetectFaces(mode: string){
    console.log(mode)
    if(mode==="expression"){
      this.isExpression=true;
    }else{
      this.isExpression=false
    }
    
    await this.loadVideo(mode)
  
   
  }
  public async videoFaceDetection(input: HTMLVideoElement, canvas: HTMLCanvasElement,mode:string ) {

    this.loading = true;
    let terminalbox=<HTMLDivElement> this.doc.getElementsByClassName("terminal")[0]
 
    console.log(terminalbox)
    
    let width = terminalbox.offsetWidth
    let height = terminalbox.offsetHeight

    console.log(width, height)
    input['width'] = width;
    input['height'] = height;

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
      minFaceSize: 150
    }
    const options = new faceapi.MtcnnOptions(mtcnnParams)
    const displaySize = { width: width, height: height }
     faceapi.matchDimensions(canvas, displaySize)

    //detects faces on a screen
    let fullFaceDescriptions = await faceapi.detectAllFaces(input, options).withFaceLandmarks().withFaceDescriptors().withFaceExpressions()
    console.log("face detected")
    console.log(fullFaceDescriptions)
    fullFaceDescriptions = await faceapi.resizeResults(fullFaceDescriptions, input)
    console.log("face resized")

    console.log("face recognitions started")
    await this.faceRecognition(fullFaceDescriptions,canvas,mode)
    console.log("face recongition ended")
    this.loading = false;
   
    
  
  


  }
  public getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
  }
  createChart():void{
    d3.select('svg').remove();
    
    const element =this.doc.getElementById("chart");
    const data = this.chartData;
   

    const svg = d3.select(element).append('svg')
        .attr('width', element.offsetWidth)
        .attr('height', element.offsetHeight);
    
 

    const contentWidth = element.offsetWidth - this.margin.left - this.margin.right;
    const contentHeight = element.offsetHeight - this.margin.top - this.margin.bottom;
  

    const x = d3
      .scaleBand()
      .rangeRound([0, contentWidth])
      .padding(0.1)
      .domain(this.chartData.map(d => d['expression']));

    const y = d3
      .scaleLinear()
      .rangeRound([contentHeight, 0])
      .domain([0, d3.max(data, d => d['frequency'])]);

    const g = svg.append('g')
      .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')');

    g.append('g')
      .attr('class', 'axis axis--x')
      .attr('transform', 'translate(0,' + contentHeight + ')')
      .call(d3.axisBottom(x));

    g.append('g')
      .attr('class', 'axis axis--y')
      .call(d3.axisLeft(y).ticks(1, '%'))
      .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 6)
        .attr('dy', '0.71em')
        .attr('text-anchor', 'end')
        .text('Frequency');

    g.selectAll('.bar')
      .data(data)
      .enter().append('rect')
        .attr( 'fill','steelblue')
        .attr('x', d => x(d['expression']))
        .attr('y', d => y(d['frequency']))
        .attr('width', x.bandwidth())
        .attr('height', d => contentHeight - y(d['frequency']));
  }
  async run(videoEl,canvas,mode:string) {
    // run face detection & recognition
        let modeLocal=mode;
        console.log(videoEl['srcElement'])
        
       await this.videoFaceDetection(<HTMLVideoElement>videoEl['srcElement'], canvas,modeLocal)

       await setTimeout(async () => await this.run(videoEl,canvas,modeLocal),2000)  
  }
  public async faceRecognition(fullFaceDescriptions: faceapi.WithFaceExpressions<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{
    detection: faceapi.FaceDetection;
  }, faceapi.FaceLandmarks68>>>[], canvas: HTMLCanvasElement, mode: string) {

   
    //match the face descriptors of the detected faces from our input image to our reference data
    // 0.6 is a good distance threshold value to judge
    // whether the descriptors match or not
    const maxDescriptorDistance = 0.6
    console.log(this.labeledFaceDescriptors)
    console.log(fullFaceDescriptions)

    //match the face descriptors of the detected faces from our input image to our reference data
    const faceMatcher = new faceapi.FaceMatcher(this.labeledFaceDescriptors, maxDescriptorDistance)
  
    const results = fullFaceDescriptions.map(function (fd) {
      console.log(fd);
      return { faceMatcher: faceMatcher.findBestMatch(fd['descriptor']), faceExpressions: fd['expressions'] }

    })
   
  results.forEach((bestMatch, i) => {
    
      let expressions = bestMatch['faceExpressions'];
      let recognize = bestMatch['faceMatcher'].toString().split(" ")[0]
      let max = Math.max.apply(null, Object.values(expressions))

      
      const box = fullFaceDescriptions[i]['detection']['box']
      let text = ""
      
      //count expression
      var expression=this.getKeyByValue(expressions,max)

      if (mode === "expression") {
        text = recognize + ":" + this.getKeyByValue((expressions), max);
        this.toastr.success(this.getKeyByValue((expressions), max) + " " + recognize);
        this.chartData.map((val)=>{
          console.log(val['expression'])
          if(val['expression']===expression){
            val['frequency']++;
          }
          return val;
        })
        this.createChart()
      } else {
        text = recognize;
      }
      //draw the bounding boxes together with their labels into a canvas to display the results
      const drawBox = new faceapi.draw.DrawBox(box, { label: text })
       drawBox.draw(canvas)
    })

  }
  public startVideoDetection() {
    console.log(this.htmlVideoEl)


  }

  async computeLabeledFaceDescriptor(){
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
      minFaceSize: 50
    }
    const options = new faceapi.MtcnnOptions(mtcnnParams)

    const labels = ['Barney', 'Lilly', 'Marshall', 'Robin','Ted','kenneth']
    this.labeledFaceDescriptors=await Promise.all(
      labels.map(async label => {
        // fetch image data from urls and convert blob to HTMLImage element
        const imgUrl = '../assets/images/' + `${label}.jpeg`
        const img = await faceapi.fetchImage(imgUrl)

        // detect the face with the highest score in the image and compute it's landmarks and face descriptor
        const fullFaceDescription = await faceapi.detectSingleFace(img,options).withFaceLandmarks().withFaceDescriptor()

        if (!fullFaceDescription) {
          throw new Error(`no faces detected for ${label}`)
        }

        const faceDescriptors = [fullFaceDescription.descriptor]
        return new faceapi.LabeledFaceDescriptors(label, faceDescriptors)
      })
    )
  }
  async loadModels() {
    // load the models
    this.loading = true;
    const MODEL_URL = './assets/models/'
    
    await faceapi.loadFaceLandmarkModel(MODEL_URL)
    await faceapi.loadFaceRecognitionModel(MODEL_URL)
    await faceapi.loadFaceExpressionModel(MODEL_URL)
    await faceapi.loadMtcnnModel(MODEL_URL)

    this.loading = false;
    this.toastr.success('Models Loaded!');
    await this.computeLabeledFaceDescriptor()
   




  }
}
