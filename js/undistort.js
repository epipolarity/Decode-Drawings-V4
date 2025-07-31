// if original ball size was calculated based on a distorted image then undistort a set of
// uniformly distributed points around its circumference and calculate the size of that instead
// possible overly convoluted
export function undistortRadius(centroid, radius, imageWidth, imageHeight, k1) {
    const circPoints = [];
    const count = 10;

    for (let i = 0; i < count; i++) {                                   // calculate points on circumference of original 'distorted' ball
        const angle = (i / count) * Math.PI * 2;
        const x = centroid.x + (radius * Math.cos(angle));
        const y = centroid.y + (radius * Math.sin(angle));
        circPoints.push(undistortPoint({ x, y }, imageWidth, imageHeight, k1));                // undistort each point to create an 'undistorted' ball
    }

    let area = 0;                                                       // use shoelace formula: https://en.wikipedia.org/wiki/Shoelace_formula
    for (let i = 0; i < count; i++) {                                   // to calculate area of new 'undistorted' polygon
        const j = i === count - 1 ? 0 : i + 1;
        area += ((circPoints[i].x * circPoints[j].y) - (circPoints[j].x * circPoints[i].y));
    }
    area = area / 2;

    return Math.sqrt(area / Math.PI);                                   // calculate and return radius based on this 'undistorted' area
}


// transform any point in the original distorted image to a xy position in an ideal pinhole camera model
// using division model with single distortion term k1: https://en.wikipedia.org/wiki/Distortion_(optics)
// full distortion model uses multiple terms k1...kn and more for tangential and decentering distortion
// but more than 1 term would be hard to tune through trial and error, and 1 term gets us a lot of the way
// negative k1 = barrel distortion / positive k1 = pincushion
export function undistortPoint(point, imageWidth, imageHeight, k1) {
    const center = { x: imageWidth / 2, y: imageHeight / 2 };
    const r = Math.sqrt(Math.pow(point.x - center.x, 2) + Math.pow(point.y - center.y, 2));
    const newX = center.x + ((point.x - center.x) / (1 + (k1 * Math.pow(r, 2))));
    const newY = center.y + ((point.y - center.y) / (1 + (k1 * Math.pow(r, 2))));
    return { x: newX, y: newY };
}