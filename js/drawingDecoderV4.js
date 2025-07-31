import { arrayToTextLines, map } from "./utils.js";
import { undistortPoint } from "./undistort.js";
import { roots } from "./quarticSolver.js";

export default class DrawingDecoder {

    constructor(fx = 615, fy = 615, s = 0, cx = 640, cy = 360, k1 = 0, rangeEstimate = { red: 18.5, green: 18.5, blue: 18.5 }) {

        this.collector = [];        // for storing output xy points

        this.k = [                  // camera calibration matrix (fx/fy=focal length, s=skew, cx/cy=center)
            [fx, s, cx],
            [0, fy, cy],
            [0, 0, 1]
        ];

        this.k_inv = math.inv(this.k);

        this.k1 = k1;               // distortion coefficient

        // known world points, xyz, (red, green, blue - clockwise from the top)
        this.x1_w_r = [0, 0, 5.196];
        this.x2_w_g = [4.5, 0, -2.598];
        this.x3_w_b = [-4.5, 0, -2.598];

        // distances between world points (should be 9cm each)
        this.a = math.distance(this.x2_w_g, this.x3_w_b);
        this.b = math.distance(this.x1_w_r, this.x3_w_b);
        this.c = math.distance(this.x1_w_r, this.x2_w_g);

        this.rangeEstimate = rangeEstimate;

    }


    decode(ctx, balls) {

        const centroids_image = {
            red: undistortPoint(balls.red.centroid, 1280, 720, this.k1),
            green: undistortPoint(balls.green.centroid, 1280, 720, this.k1),
            blue: undistortPoint(balls.blue.centroid, 1280, 720, this.k1)
        }

        const centroids_camera = {
            red: this.#imgToCameraCoords(centroids_image.red),
            green: this.#imgToCameraCoords(centroids_image.green),
            blue: this.#imgToCameraCoords(centroids_image.blue),
        }

        const { alpha, beta, gamma } = this.#getAngles(centroids_camera);
        const { A4, A3, A2, A1, A0 } = this.#getCoefficientsForV(this.a, this.b, this.c, alpha, beta, gamma);

        const v_solutions = roots(A4, A3, A2, A1, A0);
        const length_solutions = [];

        for (const v_solution of v_solutions.roots) {
            if (v_solution.im === 0 && v_solution.re >= 0) {
                const lengths = this.#getLengths(v_solution.re, this.a, this.b, alpha, beta);
                length_solutions.push(...lengths);
            }
        }


        const strokeStyles = ["black", "red", "green", "blue", "purple", "aqua", "navy", "olive"];
        let strokeStyleIdx = 0;
        // const lengthsEstimate = this.#chooseSolution(length_solutions);
        for (const lengthsEstimate of length_solutions) {

            this.rangeEstimate = {
                red: lengthsEstimate.s1,
                green: lengthsEstimate.s2,
                blue: lengthsEstimate.s3,
            };

            // scale unit vectors in camera coordinates by length estimates, to get 3D points in camera coordinates
            const cam_points_3d = {
                red: math.multiply(math.divide(centroids_camera.red, math.norm(centroids_camera.red)), this.rangeEstimate.red),
                green: math.multiply(math.divide(centroids_camera.green, math.norm(centroids_camera.green)), this.rangeEstimate.green),
                blue: math.multiply(math.divide(centroids_camera.blue, math.norm(centroids_camera.blue)), this.rangeEstimate.blue)
            }

            // find centroid of 3-point set in both camera and world coordinates
            const centroid_world = math.divide(math.add(this.x1_w_r, this.x2_w_g, this.x3_w_b), 3);
            const centroid_camera = math.divide(math.add(cam_points_3d.red, cam_points_3d.green, cam_points_3d.blue), 3);

            // subtract centroids to center points around 0,0,0
            const world_points_centered = {
                red: math.subtract(this.x1_w_r, centroid_world),
                green: math.subtract(this.x2_w_g, centroid_world),
                blue: math.subtract(this.x3_w_b, centroid_world)
            }

            const camera_points_centered = {
                red: math.subtract(cam_points_3d.red, centroid_camera),
                green: math.subtract(cam_points_3d.green, centroid_camera),
                blue: math.subtract(cam_points_3d.blue, centroid_camera)
            }

            // let H;              // H = cross-covariance matrix
            // H = math.multiply(math.transpose([camera_points_centered.red]), [world_points_centered.red]);
            // H = math.add(H, math.multiply(math.transpose([camera_points_centered.green]), [world_points_centered.green]));
            // H = math.add(H, math.multiply(math.transpose([camera_points_centered.blue]), [world_points_centered.blue]));

            let H;              // H = cross-covariance matrix  

            H = math.multiply(math.transpose([world_points_centered.red]), [camera_points_centered.red]);
            H = math.add(H, math.multiply(math.transpose([world_points_centered.green]), [camera_points_centered.green]));
            H = math.add(H, math.multiply(math.transpose([world_points_centered.blue]), [camera_points_centered.blue]));

            const { S, U, V } = numeric.svd(H);

            let R = math.multiply(V, math.transpose(U));

            if (numeric.det(R) < 0) {
                const V_corrected = math.multiply(V, math.diag([1, 1, -1]));
                R = math.multiply(V_corrected, math.transpose(U));
            }

            const t = math.subtract(centroid_camera, math.multiply(R, centroid_world));
            const camera_position_world = math.multiply(-1, math.multiply(math.transpose(R), t));

            ctx.beginPath();
            ctx.strokeStyle = strokeStyles[strokeStyleIdx];
            ctx.rect(this.#mapX(camera_position_world[0]), this.#mapY(camera_position_world[1]), 1, 1);
            ctx.stroke();

            strokeStyleIdx += 1;

        }

    }


    #mapX(x) {
        return map(x, -10, 10, 225, 475);
    }

    #mapY(y) {
        return map(y, -18, -38, 450, 700);
    }


    #getAngles(cameraPoints) {

        const x1_img_r_cam = cameraPoints.red;
        const x2_img_g_cam = cameraPoints.green;
        const x3_img_b_cam = cameraPoints.blue;

        const cos_alpha = math.dot(x2_img_g_cam, x3_img_b_cam) / (math.norm(x2_img_g_cam) * math.norm(x3_img_b_cam));
        const cos_beta = math.dot(x1_img_r_cam, x3_img_b_cam) / (math.norm(x1_img_r_cam) * math.norm(x3_img_b_cam));
        const cos_gamma = math.dot(x1_img_r_cam, x2_img_g_cam) / (math.norm(x1_img_r_cam) * math.norm(x2_img_g_cam));

        const alpha = math.acos(cos_alpha);
        const beta = math.acos(cos_beta);
        const gamma = math.acos(cos_gamma);

        return { alpha, beta, gamma };

    }


    #imgToCameraCoords(imagePoint) {
        const x = [imagePoint.x, imagePoint.y, 1];
        return math.multiply(this.k_inv, x);
    }


    #getCoefficientsForV(a, b, c, alpha, beta, gamma) {

        const aSqr = math.pow(a, 2);
        const bSqr = math.pow(b, 2);
        const cSqr = math.pow(c, 2);

        const cos_alpha = math.cos(alpha);
        const cos_beta = math.cos(beta);
        const cos_gamma = math.cos(gamma);

        return {
            A4: this.#getA4(aSqr, bSqr, cSqr, cos_alpha),
            A3: this.#getA3(aSqr, bSqr, cSqr, cos_alpha, cos_beta, cos_gamma),
            A2: this.#getA2(aSqr, bSqr, cSqr, cos_alpha, cos_beta, cos_gamma),
            A1: this.#getA1(aSqr, bSqr, cSqr, cos_alpha, cos_beta, cos_gamma),
            A0: this.#getA0(aSqr, bSqr, cSqr, cos_gamma)
        }

    }


    #getLengths(v, a, b, alpha, beta) {

        const cos_alpha = math.cos(alpha);
        const cos_beta = math.cos(beta);

        const s1 = math.sqrt(math.pow(b, 2) / (1 + math.pow(v, 2) - (2 * v * cos_beta)));

        const s3 = v * s1;

        const s2_solutions = math.polynomialRoot(
            math.pow(s3, 2) - math.pow(a, 2),
            -2 * s3 * cos_alpha,
            1
        );


        return s2_solutions.map(s2 => ({ s1, s2, s3 }));

    }


    #getA4(aSqr, bSqr, cSqr, cos_alpha) {
        const part1 = math.pow(((aSqr - cSqr) / bSqr) - 1, 2);
        const part2 = (((4 * cSqr) / bSqr) * math.pow(cos_alpha, 2));
        return part1 - part2;
    }


    #getA3(aSqr, bSqr, cSqr, cos_alpha, cos_beta, cos_gamma) {
        const part1 = ((aSqr - cSqr) / bSqr) * (1 - ((aSqr - cSqr) / bSqr)) * cos_beta;
        const part2 = (1 - ((aSqr + cSqr) / bSqr)) * cos_alpha * cos_gamma;
        const part3 = 2 * (cSqr / bSqr) * math.pow(cos_alpha, 2) * cos_beta;
        return 4 * (part1 - part2 + part3);
    }


    #getA2(aSqr, bSqr, cSqr, cos_alpha, cos_beta, cos_gamma) {
        const part1 = math.pow((aSqr - cSqr) / bSqr, 2) - 1 + (2 * math.pow((aSqr - cSqr) / bSqr, 2) * math.pow(cos_beta, 2));
        const part2 = 2 * ((bSqr - cSqr) / bSqr) * math.pow(cos_alpha, 2);
        const part3 = 4 * ((aSqr + cSqr) / bSqr) * cos_alpha * cos_beta * cos_gamma;
        const part4 = 2 * ((bSqr - aSqr) / bSqr) * math.pow(cos_gamma, 2);
        return 2 * (part1 + part2 - part3 + part4);
    }


    #getA1(aSqr, bSqr, cSqr, cos_alpha, cos_beta, cos_gamma) {
        const part1 = -((aSqr - cSqr) / bSqr) * (1 + ((aSqr - cSqr) / bSqr)) * cos_beta;
        const part2 = ((2 * aSqr) / bSqr) * math.pow(cos_gamma, 2) * cos_beta;
        const part3 = (1 - ((aSqr + cSqr) / bSqr)) * cos_alpha * cos_gamma;
        return 4 * (part1 + part2 - part3);
    }


    #getA0(aSqr, bSqr, cSqr, cos_gamma) {
        const part1 = math.pow(1 + ((aSqr - cSqr) / bSqr), 2);
        const part2 = ((4 * aSqr) / bSqr) * math.pow(cos_gamma, 2);
        return part1 - part2;
    }

    #chooseSolution(solutions) {
        // console.log(solutions);
        let minDistance = Number.MAX_VALUE;
        let bestSolution = 0;
        for (const i in solutions) {
            const solution = solutions[i];
            const distance = math.distance(
                [this.rangeEstimate.red, this.rangeEstimate.green, this.rangeEstimate.blue],
                [solution.s1, solution.s2, solution.s3]
            );
            if (distance < minDistance) {
                minDistance = distance;
                bestSolution = i;
            }
        }
        return solutions[bestSolution];
    }


    // return the string representation of the collector
    // a string of space-separated XY pairs on each line
    toString() {
        return arrayToTextLines(this.collector);
    }

}