import BallDetector from "./ballDetector.js";
import DrawingDecoderV1 from "./drawingDecoderV1.js";
import DrawingDecoderV2 from "./drawingDecoderV2.js";
import DrawingDecoderV3 from "./drawingDecoderV3.js";
import DrawingDecoderV4 from "./drawingDecoderV4.js";

import { downloadText, truncate } from "./utils.js";

let inputId;                    // input (video or data file) to be processed
let datafileMode = false;       // is input a video or data file

let videoPlaying = false;

let detectorTextUpdateInterval; // interval ids for updating textareas with output during video processing
let decoderTextUpdateInterval;

let ballDetector;               // class to detect balls in input video
let drawingDecoder;             // class to decode drawing based on detected ball positions/sizes

const video = document.createElement("video");

const inputCtx = inputCanvas.getContext("2d");
const drawingCtx = drawingCanvas.getContext("2d");


// Event handlers

// video loaded so begin processing of video frames
video.addEventListener("loadeddata", () => {
    clearTextareas();                               // clear previous output
    clearDrawingContext();

    inputCanvas.width = video.videoWidth;
    inputCanvas.height = video.videoHeight;

    ballDetector = new BallDetector();
    drawingDecoder = createDecoder();               // create decoder instance based on selected version

    // set up intervals to update textarea outputs
    decoderTextUpdateInterval = setInterval(() => updateText(xyCoords, drawingDecoder), 500);
    detectorTextUpdateInterval = setInterval(() => updateText(ballCoords, ballDetector), 500);

    videoPlaying = true;
    processVideoFrame();                            // start processing
});


// video finished so enable download buttons
video.addEventListener("ended", () => {
    videoPlaying = false;
    downloadReady();
});


// video input selector changed
videos.addEventListener("change", (e) => {
    datafileMode = false;

    downloadXYCoordsBtn.setAttribute("disabled", "true");       // disable download buttons until processing complete
    downloadBallCoordsJS.setAttribute("disabled", "true");

    inputId = e.target.value;

    video.src = `videos/${inputId}.mp4`;                        // prepare video element with the selected source and play
    video.muted = true;
    video.play();
});


// data file input selector changed
datafiles.addEventListener("change", (e) => {
    datafileMode = true;                                        // switch to data file input mode

    downloadXYCoordsBtn.setAttribute("disabled", "true");       // disable download buttons until processing complete
    downloadBallCoordsJS.setAttribute("disabled", "true");

    video.pause();                                              // stop video if there is one
    videoPlaying = false;
    videos.selectedIndex = 0;

    inputId = e.target.value;                                   // set the input id and start processing
    drawDatafile();
});


// decoder version selector changed
version.addEventListener("change", (e) => {

    if (e.target.value === "3") {                               // enable all settings for v3 decoder
        k1coeff.removeAttribute("disabled");
        smoothing.removeAttribute("disabled");
        zthresh.removeAttribute("disabled");
    } else {                                                    // disable all settings for v1 or v2 decoders
        k1coeff.setAttribute("disabled", "true");
        smoothing.setAttribute("disabled", "true");
        zthresh.setAttribute("disabled", "true");
    }

    if (datafileMode) {                                         // if a data file was already selected
        drawDatafile();                                         // reprocess it with the selected decoder
    }

});


k1coeff.addEventListener("change", (e) => {                     // distortion coefficient was changed
    if (datafileMode) {                                         // if a data file was already selected
        drawDatafile();                                         // reprocess it with the specified distortion coefficient
    }
});


smoothing.addEventListener("change", (e) => {                   // smoothing factor was changed
    if (datafileMode) {                                         // if a data file was already selected
        drawDatafile();                                         // reprocess it with the specified smoothing factor
    }
});


zthresh.addEventListener("change", (e) => {                     // zthresh (pen height threshold) was changed
    if (datafileMode) {                                         // if a data file was already selected
        drawDatafile();                                         // reprocess it with the specified zthresh (pen height threshold)
    }
});


// download the decoded XY image coordinates in TXT format for the https://radufromfinland.com/decodeTheDrawings/test/ test page
downloadXYCoordsBtn.addEventListener("click", () => {
    const content = drawingDecoder.toString();
    downloadText(content, 'coords_' + inputId + '.txt');
});


// download the detected ball positions and sizes as a JS const export to save having to play the video each time
downloadBallCoordsJS.addEventListener("click", () => {
    const content = ballDetector.toString(inputId);
    downloadText(content, 'balls_' + inputId + '.js', 'text/javascript');
});


// decode the selected data file input and draw to the canvas
function drawDatafile() {

    // clear previous output
    clearTextareas();
    clearDrawingContext();
    setTimeout(clearInputContext, 250);                         // clear input video canvas with a delay in case it is still playing

    const ballsDataFile = `../data/balls_${inputId}.js`;        // path to the selected data file

    import(ballsDataFile).then(ballsModule => {                 // dynamic import to handle error if it doesn't exist

        const limit = 100;
        let frame = 1;

        drawingDecoder = createDecoder();                       // get a decoder of the currently selected type
        for (const balls of ballsModule.balls) {
            drawingDecoder.decode(drawingCtx, balls);           // decode each set of balls and draw onto the drawing canvas
            frame++;
            if (frame === limit) {
                // break;
            }
        }

        updateText(xyCoords, drawingDecoder);                   // display the XY image coordinates and make available for download as TXT
        downloadReady();

    }).catch(error => {

        console.error(error);
        alert(`error processing balls_${inputId}.js - check console for more info`);
        datafiles.selectedIndex = 0;

    });
}


// process the selected video file input and draw to canvas
function processVideoFrame() {

    const { width, height } = inputCanvas;
    inputCtx.drawImage(video, 0, 0, width, height);                         // draw the video to the video input canvas

    const imageData = inputCtx.getImageData(0, 0, width, height);           // get the frame image data and perform ball detection
    const balls = ballDetector.detect(imageData);

    drawingDecoder.decode(drawingCtx, balls);                               // decode each set of balls and draw onto the drawing canvas

    for (const ballKey in balls) {                                          // draw detected ball outlines onto video input canvas
        const { centroid, radius } = balls[ballKey];                        // just to confirm they're being detected correctly
        inputCtx.beginPath();
        inputCtx.arc(centroid.x, centroid.y, radius, 0, Math.PI * 2);
        inputCtx.stroke();
    }

    if (videoPlaying) {
        video.requestVideoFrameCallback(processVideoFrame);                 // repeat for each video frame
    }
}


// factory function to create a DrawingDecoder of the selected version
function createDecoder() {
    if (version.value === "1") {
        return new DrawingDecoderV1();
    }
    if (version.value === "2") {
        return new DrawingDecoderV2();
    }
    if (version.value === "4") {
        return new DrawingDecoderV4();
    }
    return new DrawingDecoderV3(parseFloat(k1coeff.value), parseFloat(smoothing.value), parseFloat(zthresh.value));
}


// write text from any 'provider' with toString() method, to given textarea, truncated at 'limit' characters
function updateText(textArea, provider, limit = 10000) {
    const result = truncate(provider.toString(inputId), limit);
    textArea.value = result;
    textArea.scrollTop = textArea.scrollHeight;
}


// stop updating textareas and enable download buttons
function downloadReady() {
    clearInterval(decoderTextUpdateInterval);
    downloadXYCoordsBtn.removeAttribute("disabled");

    if (datafileMode) return;                                       // return early if ball detection was not performed

    clearInterval(detectorTextUpdateInterval);
    downloadBallCoordsJS.removeAttribute("disabled");
}


function clearTextareas() {
    xyCoords.value = "";
    ballCoords.value = "";
}


function clearDrawingContext() {
    drawingCtx.fillStyle = "white";
    drawingCtx.fillRect(0, 0, drawingCanvas.width, drawingCanvas.height);
}


function clearInputContext() {
    inputCtx.fillStyle = "white";
    inputCtx.fillRect(0, 0, inputCanvas.width, inputCanvas.height);
}