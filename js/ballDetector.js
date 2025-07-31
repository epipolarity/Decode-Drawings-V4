import { objectToJSConst, round } from "./utils.js";

// Ball detector based heavily on Radu's Colored Marker Detector code: https://www.youtube.com/watch?v=jy-Mxbt0zww
export default class BallDetector {
    
    constructor(precision = 3) {
        this.collector = [];                // collector stores the detected balls for later export
        this.precision = precision;         // precision is decimal places - 3 is enough and reduces file size
    }


    // takes context image data and returns locations and sizes of red green and blue balls
    detect(imgData) {

        const rgbPoints = { red: [], green: [], blue: [] };             // arrays to hold pixels that the criteria for each color

        for (let i = 0; i < imgData.data.length; i += 4) {              // get the r g b values for each pixel
            const r = imgData.data[i + 0];
            const g = imgData.data[i + 1];
            const b = imgData.data[i + 2];

            const redness = r - Math.max(g, b);                         // find out how red, green or blue each pixel is
            const blueness = b - Math.max(r, g);                        
            const greenness = g - Math.max(r, b);

            const pIndex = i / 4;                                       // convert from 1D index to 2D XY coordinates
            const y = Math.floor(pIndex / imgData.width);
            const x = pIndex % imgData.width;

            if (redness > 40) {                                         // if each pixel exceeds color strength threshold (40)
                rgbPoints.red.push({ x, y });                           // add its XY position to the respective red, green or blue array
            }
            if (blueness > 40) {
                rgbPoints.blue.push({ x, y });
            }
            if (greenness > 40) {
                rgbPoints.green.push({ x, y });
            }

        }

        // calculate the centroid of each ball as the average position of points of that colour        
        this.redCentroid = this.#averagePoints(rgbPoints.red);
        this.greenCentroid = this.#averagePoints(rgbPoints.green);
        this.blueCentroid = this.#averagePoints(rgbPoints.blue);

        // calculate the radius as the sqrt of the area, divided by 1.8
        // 1.8 was found through trial and error and works well though I was expecting it to be nearer 3.14
        this.redRadius = round(Math.sqrt(rgbPoints.red.length) / 1.8, this.precision);
        this.greenRadius = round(Math.sqrt(rgbPoints.green.length) / 1.8, this.precision);
        this.blueRadius = round(Math.sqrt(rgbPoints.blue.length) / 1.8, this.precision);

        // assemble the results in an object to return
        const balls = {
            red: { centroid: this.redCentroid, radius: this.redRadius },
            green: { centroid: this.greenCentroid, radius: this.greenRadius },
            blue: { centroid: this.blueCentroid, radius: this.blueRadius }
        }

        const stringifiedBalls = JSON.stringify(balls);             // stringify the object to only add to collector if it has changed
        if (this.lastBalls != stringifiedBalls) {
            this.collector.push(balls);                             // add to collector for future reference/export
        }
        this.lastBalls = stringifiedBalls;                          // remember the stringified version to check for changes next time

        return balls;                                               // return the object (not stringified version)

    }


    // return the string representation of the collector - a js module with single 'balls' const export
    toString() {
        return objectToJSConst(this.collector, 'balls');
    }


    // calculate the mean XY point of an array of XY points
    #averagePoints(points) {
        const center = { x: 0, y: 0 };
        for (const point of points) {
            center.x += point.x;
            center.y += point.y;
        }
        center.x /= points.length;
        center.y /= points.length;
        return {
            x: round(center.x, this.precision),
            y: round(center.y, this.precision)
        };
    }
}