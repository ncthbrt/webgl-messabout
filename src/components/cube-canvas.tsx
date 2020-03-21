import { FunctionalComponent, h, Ref } from "preact";
import { useRef, useEffect } from "preact/hooks";
import frag from '../shaders/basic-cube.frag'
import vert from '../shaders/basic-cube.vert'
import { mat4 } from 'gl-matrix';

import { assertTrue, throwIfNotDefined } from "../asserts";
import { ModelData, load } from "../loaders/binary-stl";

type ProgramInfo = {
    program: WebGLProgram,
    attribLocations: {
        vertexPosition: number,
        normals: number
    },
    uniformLocations: {
        projectionMatrix: WebGLUniformLocation,
        modelViewMatrix: WebGLUniformLocation,
        vertexColor: WebGLUniformLocation,
        normalMatrix: WebGLUniformLocation
    },
};

type Buffers = {
    position: WebGLBuffer,
    normals: WebGLBuffer
}


function loadShader(gl: WebGLRenderingContext, type: GLenum, source: string) {
    const shader: WebGLShader | null = gl.createShader(type);
    assertTrue(shader);
    // Send the source to the shader object

    gl.shaderSource(shader, source);

    // Compile the shader program

    gl.compileShader(shader);

    // See if it compiled successfully

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        throw new Error('Error');
    }

    return shader;
}

function initBuffers(gl: WebGLRenderingContext, data: ModelData): Buffers {

    // Create a buffer for the square's positions.

    const positionBuffer = gl.createBuffer();

    // Select the positionBuffer as the one to apply buffer
    // operations to from here out.
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Now pass the list of positions into WebGL to build the
    // shape. We do this by creating a Float32Array from the
    // JavaScript array, then use it to fill the current buffer.
    gl.bufferData(gl.ARRAY_BUFFER, data.position, gl.STATIC_DRAW);

    // const indexBuffer = gl.createBuffer();
    // gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    // gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeFaces), gl.STATIC_DRAW);

    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.normals, gl.STATIC_DRAW);

    return {
        position: throwIfNotDefined(positionBuffer),
        normals: throwIfNotDefined(normalBuffer),
    };
}

export const CubeCanvas: FunctionalComponent = () => {
    const canvasRef: Ref<HTMLCanvasElement> = useRef(null);

    useEffect(() => {
        if (canvasRef.current) {
            (async function () {
                const canvas = canvasRef.current!;
                const gl = canvas.getContext("webgl");
                if (gl == null) {
                    console.error("WebGL is not supported on this platform");
                    return;
                }
                gl.clearColor(0.0, 0.0, 0.0, 0.0);  // Clear to black, fully opaque
                gl.clearDepth(1.0);                 // Clear everything
                gl.enable(gl.DEPTH_TEST);           // Enable depth testing
                gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

                // Clear the canvas before we start drawing on it.
                const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vert);
                const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, frag);
                const shaderProgram = gl.createProgram();

                assertTrue(shaderProgram);
                gl.attachShader(shaderProgram, vertexShader);
                gl.attachShader(shaderProgram, fragmentShader);
                gl.linkProgram(shaderProgram);

                const programInfo: ProgramInfo = {
                    program: shaderProgram,
                    attribLocations: {
                        vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
                        normals: gl.getAttribLocation(shaderProgram, 'aVertexNormal')
                    },
                    uniformLocations: {
                        projectionMatrix: throwIfNotDefined(gl.getUniformLocation(shaderProgram, 'uProjectionMatrix')),
                        modelViewMatrix: throwIfNotDefined(gl.getUniformLocation(shaderProgram, 'uModelViewMatrix')),
                        vertexColor: throwIfNotDefined(gl.getUniformLocation(shaderProgram, 'uVertexColor')),
                        normalMatrix: throwIfNotDefined(gl.getUniformLocation(shaderProgram, 'uNormalMatrix'))
                    },
                };
                const data = await load('/Box.stl');
                const buffers = initBuffers(gl, data);



                // Create a perspective matrix, a special matrix that is
                // used to simulate the distortion of perspective in a camera.
                // Our field of view is 45 degrees, with a width/height
                // ratio that matches the display size of the canvas
                // and we only want to see objects between 0.1 units
                // and 100 units away from the camera.

                const fieldOfView = 60 * Math.PI / 180;   // in radians
                const aspect = gl.canvas.width / gl.canvas.height;
                const zNear = 0.1;
                const zFar = 100.0;
                const projectionMatrix = mat4.create();

                // note: glmatrix.js always has the first argument
                // as the destination to receive the result.
                mat4.perspective(projectionMatrix,
                    fieldOfView,
                    aspect,
                    zNear,
                    zFar);

                // Set the drawing position to the "identity" point, which is
                // the center of the scene.
                const modelViewMatrix = mat4.create();

                // Now move the drawing position a bit to where we want to
                // start drawing the square.

                mat4.translate(modelViewMatrix,     // destination matrix
                    modelViewMatrix,     // matrix to translate
                    [-0.0, 0.0, -6.0]);  // amount to translate

                const normalMatrix = mat4.create();
                mat4.invert(normalMatrix, modelViewMatrix);
                mat4.transpose(normalMatrix, normalMatrix);

                // Tell WebGL how to pull out the positions from the position
                // buffer into the vertexPosition attribute.
                {
                    const numComponents = 3;  // pull out 2 values per iteration
                    const type = gl.FLOAT;    // the data in the buffer is 32bit floats
                    const normalize = false;  // don't normalize
                    const stride = 0;         // how many bytes to get from one set of values to the next
                    // 0 = use type and numComponents above
                    const offset = 0;         // how many bytes inside the buffer to start from
                    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
                    gl.vertexAttribPointer(
                        programInfo.attribLocations.vertexPosition,
                        numComponents,
                        type,
                        normalize,
                        stride,
                        offset);
                    gl.enableVertexAttribArray(
                        programInfo.attribLocations.vertexPosition);
                }

                // Normals
                {
                    const numComponents = 3;
                    const type = gl.FLOAT;
                    const normalize = false;
                    const stride = 0;
                    const offset = 0;
                    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normals);
                    gl.vertexAttribPointer(
                        programInfo.attribLocations.normals,
                        numComponents,
                        type,
                        normalize,
                        stride,
                        offset);
                    gl.enableVertexAttribArray(
                        programInfo.attribLocations.normals);
                }


                // Tell WebGL to use our program when drawing
                gl.useProgram(programInfo.program);

                // Set the shader uniforms
                gl.uniformMatrix4fv(
                    programInfo.uniformLocations.projectionMatrix,
                    false,
                    projectionMatrix);
                gl.uniformMatrix4fv(
                    programInfo.uniformLocations.modelViewMatrix,
                    false,
                    modelViewMatrix);
                gl.uniform4f(programInfo.uniformLocations.vertexColor, 1.0, 1.0, 1.0, 1.0);

                let time = 0;
                function draw(now: number) {
                    now *= 0.001;  // convert to seconds
                    if (time === 0) {
                        time = now;
                    }
                    const deltaTime = (now - time);
                    const offset = 0;
                    mat4.rotate(modelViewMatrix,  // destination matrix
                        modelViewMatrix,  // matrix to rotate
                        deltaTime * 1.6,
                        [1, 0, 1]);       // axis to rotate around

                    gl!.uniformMatrix4fv(
                        programInfo.uniformLocations.modelViewMatrix,
                        false,
                        modelViewMatrix);

                    mat4.invert(normalMatrix, modelViewMatrix);
                    mat4.transpose(normalMatrix, normalMatrix);

                    gl!.uniformMatrix4fv(
                        programInfo.uniformLocations.normalMatrix,
                        false,
                        normalMatrix);

                    gl!.clear(gl!.COLOR_BUFFER_BIT | gl!.DEPTH_BUFFER_BIT);

                    gl!.drawArrays(gl!.TRIANGLES, 0, data.position.length / 3);
                    time += deltaTime;
                    window.requestAnimationFrame(draw);
                }
                window.requestAnimationFrame(draw);

            })();
        }
    }, [canvasRef])
    return <canvas ref={canvasRef} width='1024' height='768' id='cube-canvas'></canvas>
}
