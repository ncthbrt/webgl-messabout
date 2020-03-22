import { FunctionalComponent, h, Ref } from "preact";
import { useRef, useEffect } from "preact/hooks";
import frag from '../shaders/basic-cube.frag'
import vert from '../shaders/basic-cube.vert'
import { mat4 } from 'gl-matrix';
import { assertTrue, throwIfNotDefined } from "../asserts";
import { load } from "../loaders/obj-loader";
import { initMeshBuffers, ExtendedGLBuffer, MeshWithBuffers } from "webgl-obj-loader";

type ProgramInfo = {
    vertexPositionAttribute?: number,
    vertexNormalAttribute?: number,
    textureCoordAttribute?: number,
    uniformLocations?: {
        projectionMatrix: WebGLUniformLocation,
        modelViewMatrix: WebGLUniformLocation,
        vertexColor: WebGLUniformLocation,
        normalMatrix: WebGLUniformLocation
    }
};

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
                const shaderProgram: (WebGLProgram & ProgramInfo) | null = gl.createProgram();

                assertTrue(shaderProgram);
                gl.attachShader(shaderProgram, vertexShader);
                gl.attachShader(shaderProgram, fragmentShader);
                gl.linkProgram(shaderProgram);

                shaderProgram.uniformLocations = {
                    projectionMatrix: throwIfNotDefined(gl.getUniformLocation(shaderProgram, 'uProjectionMatrix')),
                    modelViewMatrix: throwIfNotDefined(gl.getUniformLocation(shaderProgram, 'uModelViewMatrix')),
                    vertexColor: throwIfNotDefined(gl.getUniformLocation(shaderProgram, 'uVertexColor')),
                    normalMatrix: throwIfNotDefined(gl.getUniformLocation(shaderProgram, 'uNormalMatrix'))
                };

                shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
                gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

                shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
                gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

                shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
                gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

                const mesh = await load('/Cube.obj');
                const mesh2 = await load('/Ellipsoid.obj');
                const meshWithBuffers = initMeshBuffers(gl, mesh);
                const mesh2WithBuffers = initMeshBuffers(gl, mesh2);

                const meshes = [meshWithBuffers, mesh2WithBuffers];

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

                // Tell WebGL to use our program when drawing
                gl.useProgram(shaderProgram);

                // Set the shader uniforms
                gl.uniformMatrix4fv(
                    shaderProgram.uniformLocations.projectionMatrix,
                    false,
                    projectionMatrix);
                gl.uniformMatrix4fv(
                    shaderProgram.uniformLocations.modelViewMatrix,
                    false,
                    modelViewMatrix);
                gl.uniform4f(shaderProgram.uniformLocations.vertexColor, 1.0, 1.0, 1.0, 1.0);

                let time = 0;
                function draw(now: number) {
                    const thisGl = gl!;
                    const thisShaderProgram = shaderProgram!;
                    now *= 0.001;  // convert to seconds
                    if (time === 0) {
                        time = now;
                    }
                    const deltaTime = (now - time);
                    mat4.rotate(modelViewMatrix,  // destination matrix
                        modelViewMatrix,  // matrix to rotate
                        deltaTime * 1.6,
                        [1, 0, 1]);       // axis to rotate around

                    thisGl.uniformMatrix4fv(
                        thisShaderProgram.uniformLocations!.modelViewMatrix,
                        false,
                        modelViewMatrix);

                    mat4.invert(normalMatrix, modelViewMatrix);
                    mat4.transpose(normalMatrix, normalMatrix);

                    thisGl.uniformMatrix4fv(
                        thisShaderProgram.uniformLocations!.normalMatrix,
                        false,
                        normalMatrix);

                    thisGl.clear(thisGl.COLOR_BUFFER_BIT | thisGl.DEPTH_BUFFER_BIT);

                    function bindBuffer(target: number, attribute: number, extended: ExtendedGLBuffer) {
                        thisGl.bindBuffer(target, extended);
                        thisGl.vertexAttribPointer(attribute, extended.itemSize, thisGl.FLOAT, false, 0, 0);
                    }

                    function drawMesh(mesh: MeshWithBuffers) {
                        if (!mesh.textures.length) {
                            thisGl.disableVertexAttribArray(thisShaderProgram.textureCoordAttribute!);
                        }
                        else {
                            // if the texture vertexAttribArray has been previously
                            // disabled, then it needs to be re-enabled
                            thisGl.enableVertexAttribArray(thisShaderProgram.textureCoordAttribute!);
                            bindBuffer(thisGl.ARRAY_BUFFER, thisShaderProgram.textureCoordAttribute!, mesh.textureBuffer);
                        }
                        bindBuffer(thisGl.ARRAY_BUFFER, thisShaderProgram.vertexPositionAttribute!, mesh.vertexBuffer);
                        bindBuffer(thisGl.ARRAY_BUFFER, thisShaderProgram.vertexNormalAttribute!, mesh.normalBuffer);
                        thisGl.bindBuffer(thisGl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
                        thisGl.drawElements(thisGl.TRIANGLES, mesh.indexBuffer.numItems, thisGl.UNSIGNED_SHORT, 0);
                    }

                    meshes.forEach(drawMesh);
                    time += deltaTime;
                    window.requestAnimationFrame(draw);
                }
                window.requestAnimationFrame(draw);

            })();
            return () => {
                if (canvasRef.current) {
                    canvasRef.current.getContext('webgl')?.getExtension('WEBGL_lose_context')?.loseContext();
                }
            };
        }
    }, [canvasRef])
    return <canvas ref={canvasRef} width='1024' height='768' id='cube-canvas'></canvas>
}
