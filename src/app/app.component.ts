import { Component, Input, ViewChild, ElementRef, AfterViewInit, OnInit, Inject } from '@angular/core';
import * as faceapi from 'face-api.js';
import { Observable } from 'rxjs';
import * as canvas from 'canvas';
import { DOCUMENT } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { AngularFireDatabase, AngularFireObject } from '@angular/fire/database';
import { DrawBox } from 'tfjs-image-recognition-base/build/commonjs/draw';
import * as d3 from 'd3';
import {DataModel} from './data/model';
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
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit {
  @ViewChild('chart',{static:true})
  @ViewChild('video',{static:false}) matVideo: MatVideoComponent;

  private chartContainer: ElementRef;

  title = 'Facial recognition DEMO';
  private db: AngularFireDatabase
  private expressions: Observable<any[]>;
  private expressionsRef: AngularFireObject<any>;

  public showVideo: boolean;
  public loading: boolean;
  public showGraph:boolean;

  //view properties
  doc: Document
  htmlVideoEl: HTMLVideoElement
  htmlImageEl: HTMLImageElement
  videoCanvas: HTMLCanvasElement
  imageCanvas: HTMLCanvasElement


  video: HTMLVideoElement;

  chartData: Array<any>;
  inputSize = 512;
  scoreThreshold = 0.5;
  withFaceLandmarks = false; //disable face landmark detection
  withBoxes = true;
  videoEl;
  stream;

  

  @Input()
  data: DataModel[];

  margin = {top: 20, right: 20, bottom: 20, left: 40};

  constructor(@Inject(DOCUMENT) document, private toastr: ToastrService, db: AngularFireDatabase) {
    this.doc = document;
    this.db = db;
    this.showVideo = false;
    this.loading = false;
    this.showGraph=false;
    this.expressionsRef = db.object('Expressions');
    this.expressions = this.expressionsRef.valueChanges();
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

   
    // give everything a chance to get loaded before starting the animation to reduce choppiness
    setTimeout(() => {
      //load models
      this.loadModels();
    }, 1000);







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


  ngAfterViewInit() {
    //prepare image to detect  faces and canvas
    this.htmlVideoEl = <HTMLVideoElement>this.doc.getElementById("htmlVideoEl")
    this.videoCanvas = <HTMLCanvasElement>this.doc.getElementById("overlayVideo")
    console.log("view loaded")
   

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




  generateData() {
    this.chartData = [];
    for (let i = 0; i < (8 + Math.floor(Math.random() * 10)); i++) {
      this.chartData.push([
        `Index ${i}`,
        Math.floor(Math.random() * 100)
      ]);
    }
  }
  public async onShowVideo(showVideo) {
    console.log(this.doc)
    if (showVideo) {
      this.showVideo = false
    } else {
      console.log(this.htmlVideoEl)
      await this.loadVideo(this.doc)

      this.showVideo = true


    }
  }

  public saveExpression(expression: string) {

    this.expressionsRef.set({ name: expression });
  }

  public startVideoDetection() {
    console.log(this.htmlVideoEl)


  }
  async loadModels() {
    // load the models
    this.loading = true;
    const MODEL_URL = './assets/models/'

    await faceapi.loadSsdMobilenetv1Model(MODEL_URL)
    await faceapi.loadFaceLandmarkModel(MODEL_URL)
    await faceapi.loadFaceRecognitionModel(MODEL_URL)
    await faceapi.loadFaceExpressionModel(MODEL_URL)
    await faceapi.loadMtcnnModel(MODEL_URL)

    this.loading = false;
    this.toastr.success('Models Loaded!');




  }

  public async loadVideo(doc: Document) {
    console.log( <HTMLVideoElement>doc.getElementById("htmlVideoEl"));

    const constraints={ audio: false, video: { facingMode: "user" } }
    navigator.mediaDevices.getUserMedia(constraints).then((stream)=>{
      console.log(this.video)
      const videoEl = <HTMLVideoElement>doc.getElementById("htmlVideoEl");
      const canvas = <HTMLCanvasElement>doc.getElementById('overlayVideo');
      console.log(videoEl.getElementsByTagName("video")['src'])

      const mediaSource=new MediaSource();
      const url=URL.createObjectURL(mediaSource);
      let videoPlayer = <HTMLVideoElement> videoEl.getElementsByTagName("video")[0];
      console.log( videoEl.getElementsByTagName("video")[0]['srcObject']);
      
      videoEl.getElementsByTagName("video")[0]['srcObject'] = stream;
      console.log(videoEl.getElementsByTagName("video")[0]['srcObject'])
      videoPlayer.addEventListener('play', async (videoEl) => {
         
        console.log(videoEl)
        this.showGraph=true;
        await this.myFunction(videoEl,canvas);
      
        
    });
    }).catch(err=>{
      console.log("unhanled error: "+ err);
    })
  



  
    //stream back the visual to the UI


  }



  async myFunction(videoEl,canvas) {
    // run face detection & recognition
    // ...
        console.log(videoEl['srcElement'])
        
       await this.videoFaceDetection(<HTMLVideoElement>videoEl['srcElement'], canvas)

        setTimeout(async () => await this.myFunction(videoEl,canvas))  
  }



  public async videoFaceDetection(input: HTMLVideoElement, canvas: HTMLCanvasElement, ) {

    console.log(input)
    let width = 400;
    let height = 240;

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
      minFaceSize: 20
    }
    const options = new faceapi.MtcnnOptions(mtcnnParams)
    const displaySize = { width: width, height: height }
     faceapi.matchDimensions(canvas, displaySize)

    //detects faces on a screen
    let fullFaceDescriptions = await faceapi.detectAllFaces(input, options).withFaceLandmarks().withFaceDescriptors().withFaceExpressions()
    if(fullFaceDescriptions.length>0){
      console.log(fullFaceDescriptions[0]['expressions'])
      fullFaceDescriptions = await faceapi.resizeResults(fullFaceDescriptions, input)
      //await faceapi.draw.drawDetections(canvas, fullFaceDescriptions)
  
     
  
      var max=Math.max.apply(null, Object.values(fullFaceDescriptions[0]['expressions']))
      //count expression
      var expression=this.getKeyByValue(fullFaceDescriptions[0]['expressions'],max)
    const box = fullFaceDescriptions[0]['detection']['box']
     const drawBox = new faceapi.draw.DrawBox(box, { label: expression})
     drawBox.draw(canvas)
      console.log(expression)
      this.chartData.map((val)=>{
        console.log(val['expression'])
        if(val['expression']===expression){
          val['frequency']++;
        }
        return val;
      })
      console.log(this.chartData)
      /// faceapi.draw.drawDetections(canvas, fullFaceDescriptions)
      this.createChart()
     
    }else{

    }
   
    


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
      this.saveExpression(text)

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
